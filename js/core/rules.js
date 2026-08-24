/**
 * 规则引擎：取牌合法性、强度判定、放生（放回）合法性、终局判定。
 * 全部为纯函数，输入状态快照，输出判定结果，可 100% 单测。
 *
 * 放回浅滩规则（以官方权威来源 thefamilygamers.com/shallow-regrets/ 为准）：
 *  - 若有空浅滩，必须放回空浅滩；
 *  - 否则应盖在"大阴影"（顶牌 strength>=1）之上；
 *  - 除非所有浅滩顶牌都是小阴影（strength<=0），否则不能盖小阴影。
 */
import { CARD_BY_ID } from './cards.js';
import { getHooks, getTotalCaught } from './gameState.js';

/** 浅滩顶牌是否为"小阴影"（strength<=0 的小鱼） */
export function isSmallShadow(shoal) {
  return shoal.length > 0 && CARD_BY_ID[shoal[0]].strength <= 0;
}

/** 某玩家能否钓起某张牌（当前钩子数 >= 所需钩数） */
export function canCatch(state, playerIndex, cardId) {
  return getHooks(state, playerIndex) >= CARD_BY_ID[cardId].strength;
}

/** 当前抽出牌中可被当前玩家钓走的牌 */
export function getCatchableDrawn(state) {
  const p = state.currentPlayer;
  return state.drawn.filter((id) => canCatch(state, p, id));
}

/** 合法放回目标浅滩索引列表（按官方放回规则） */
export function getLegalThrowTargets(state) {
  const empty = [];
  const large = [];
  const all = [];
  state.shoals.forEach((s, i) => {
    all.push(i);
    if (s.length === 0) empty.push(i);
    else if (!isSmallShadow(s)) large.push(i);
  });
  if (empty.length > 0) return empty;
  if (large.length > 0) return large;
  return all;
}

/** 可抽牌的浅滩索引（非空） */
export function getDrawableShoals(state) {
  const out = [];
  state.shoals.forEach((s, i) => {
    if (s.length > 0) out.push(i);
  });
  return out;
}

/** 当前回合应抽牌数（基础 2 + 额外抽卡） */
export function getRequiredDrawCount(state) {
  return Math.min(2 + state.extraDraw, getDrawableShoals(state).length);
}

/**
 * 终局判定：全部鱼被钓光，或没有任何玩家能钓起"可接触"的鱼。
 * 可接触 = 每个浅滩的顶牌与次顶牌（每回合最多从同一浅滩抽 2 张）。
 * 若所有可接触牌都无人能钓，则任何回合都只能抽牌后放回，对局必然卡死，理应结束。
 */
export function checkGameOver(state) {
  if (getTotalCaught(state) >= 18) return true;
  for (const shoal of state.shoals) {
    for (const id of shoal.slice(0, 2)) {
      for (let i = 0; i < state.players.length; i++) {
        if (canCatch(state, i, id)) return false;
      }
    }
  }
  return true;
}
