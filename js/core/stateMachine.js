/**
 * 状态机：状态枚举 / 转移表 / 动作分发。
 * 纯函数 applyAction(state, action) → { state, events } | { error }，
 * 同一状态 + 同一动作序列必然得到同一结果（确定性），
 * 因此可被单机、联机服务端（权威）、回放与测试复用。
 *
 * 回合流程：ability（能力阶段）→ draw（抽牌）→ catch（钓走/放生）→ 下一位玩家。
 */
import { CARD_BY_ID } from './cards.js';
import { cloneState, getHooks } from './gameState.js';
import {
  canCatch,
  getCatchableDrawn,
  getDrawableShoals,
  getLegalThrowTargets,
  getRequiredDrawCount,
  checkGameOver,
} from './rules.js';
import { applyAbilityEffect, validateAbilityTarget, createAbilityRng } from './abilities.js';
import { getWinners } from './scoring.js';

export const ACTION = {
  USE_ABILITY: 'USE_ABILITY',
  PASS_ABILITIES: 'PASS_ABILITIES',
  DRAW: 'DRAW',
  CATCH: 'CATCH',
  THROW_BACK: 'THROW_BACK',
};

export const PHASE = {
  ABILITY: 'ability',
  DRAW: 'draw',
  CATCH: 'catch',
  GAME_OVER: 'gameOver',
};

/**
 * 校验动作合法性。
 * @returns {string|null} 错误信息，null 表示合法
 */
export function validateAction(state, action) {
  const playerIndex = state.currentPlayer;
  const me = state.players[playerIndex];

  if (state.phase === PHASE.GAME_OVER) return '对局已结束';

  switch (action.type) {
    case ACTION.USE_ABILITY: {
      if (state.phase !== PHASE.ABILITY) return '只能在回合开始的能力阶段发动能力';
      const card = CARD_BY_ID[action.cardId];
      if (!card) return '卡牌不存在';
      if (!me.caught.includes(action.cardId)) return '你还没有钓到这条鱼';
      if (me.exhausted.includes(action.cardId)) return '这条鱼的能力已使用过（已横置）';
      if (!card.ability) return '这条鱼没有能力';
      return validateAbilityTarget(state, playerIndex, card.ability, action.target);
    }

    case ACTION.PASS_ABILITIES:
      if (state.phase !== PHASE.ABILITY) return '当前不在能力阶段';
      return null;

    case ACTION.DRAW: {
      if (state.phase !== PHASE.DRAW) return '当前不在抽牌阶段';
      const required = getRequiredDrawCount(state);
      if (!Array.isArray(action.from) || action.from.length !== required) {
        return `本回合需抽 ${required} 张牌`;
      }
      const drawable = getDrawableShoals(state);
      for (const idx of action.from) {
        if (!drawable.includes(idx)) return '所选浅滩无牌可抽';
      }
      return null;
    }

    case ACTION.CATCH: {
      if (state.phase !== PHASE.CATCH) return '当前不在钓走阶段';
      if (state.caughtThisTurn) return '本回合只能钓走一条鱼';
      if (!state.drawn.includes(action.cardId)) return '这张牌不在本回合抽出的牌中';
      if (!canCatch(state, playerIndex, action.cardId)) {
        return `钩数不足：需要 ${CARD_BY_ID[action.cardId].strength}，当前 ${getHooks(state, playerIndex)}`;
      }
      return null;
    }

    case ACTION.THROW_BACK: {
      if (state.phase !== PHASE.CATCH) return '当前不在放生阶段';
      if (!state.drawn.includes(action.cardId)) return '这张牌不在本回合抽出的牌中';
      // 官方规则：能钓则必须钓走一条，之后才能放生
      if (!state.caughtThisTurn && getCatchableDrawn(state).length > 0) {
        return '有可钓走的鱼，必须先钓走一条';
      }
      const legal = getLegalThrowTargets(state);
      if (!legal.includes(action.shoalIndex)) return '该浅滩不是合法的放回目标';
      return null;
    }

    default:
      return '未知动作类型';
  }
}

/** 回合结束：终局判定或轮到下一位玩家 */
function endTurn(state, events) {
  if (checkGameOver(state)) {
    state.phase = PHASE.GAME_OVER;
    state.gameOver = true;
    state.winner = getWinners(state);
    events.push('game_over');
    return;
  }
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  if (state.currentPlayer === 0) state.turn += 1;
  state.phase = PHASE.ABILITY;
  state.drawn = [];
  state.drawnFrom = [];
  state.extraDraw = 0;
  state.caughtThisTurn = false;
  state.lastPeek = null;
  for (const p of state.players) p.immune = false;
  events.push('turn_end');
}

/**
 * 应用一个动作到状态快照（不可变，返回新状态）。
 * @param {object} state 当前状态
 * @param {object} action 动作 {type, ...}
 * @returns {{state?:object, events?:string[], error?:string}}
 */
export function applyAction(state, action) {
  const s = cloneState(state);
  const err = validateAction(s, action);
  if (err) return { error: err };

  const events = [];
  const playerIndex = s.currentPlayer;
  const me = s.players[playerIndex];

  switch (action.type) {
    case ACTION.USE_ABILITY: {
      const card = CARD_BY_ID[action.cardId];
      const { events: ev } = applyAbilityEffect(s, playerIndex, card.ability, action.target, {
        rng: createAbilityRng(s),
      });
      events.push(...ev);
      me.exhausted.push(action.cardId);
      events.push('ability_used');
      break;
    }

    case ACTION.PASS_ABILITIES:
      s.phase = PHASE.DRAW;
      events.push('phase_draw');
      break;

    case ACTION.DRAW: {
      for (const shoalIndex of action.from) {
        const cardId = s.shoals[shoalIndex].shift();
        s.drawn.push(cardId);
        s.drawnFrom.push(shoalIndex);
      }
      s.phase = PHASE.CATCH;
      events.push('draw');
      break;
    }

    case ACTION.CATCH: {
      const idx = s.drawn.indexOf(action.cardId);
      s.drawn.splice(idx, 1);
      s.drawnFrom.splice(idx, 1);
      me.caught.push(action.cardId);
      s.caughtThisTurn = true;
      events.push('catch');
      if (s.drawn.length === 0) endTurn(s, events);
      break;
    }

    case ACTION.THROW_BACK: {
      const idx = s.drawn.indexOf(action.cardId);
      s.drawn.splice(idx, 1);
      s.drawnFrom.splice(idx, 1);
      s.shoals[action.shoalIndex].unshift(action.cardId);
      events.push('throw_back');
      if (s.drawn.length === 0) endTurn(s, events);
      break;
    }
  }

  s.actions.push({ player: playerIndex, turn: s.turn, action });
  return { state: s, events };
}
