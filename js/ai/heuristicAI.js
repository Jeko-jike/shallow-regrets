/**
 * 启发式 AI（M2 单人 AI 对战 与 M4 AI 斗蛐蛐 共享）。
 * 输入状态快照，返回动作；必须走与玩家完全相同的动作接口与 rules 校验，禁止作弊。
 *
 * 决策优先级（提示词四.7）：
 *   能否满足钩数 → 优先高分且非污秽 → 评估污秽风险 → 抢关键能力鱼。
 */
import { CARD_BY_ID } from '../core/cards.js';
import { getHooks } from '../core/gameState.js';
import {
  canCatch,
  getCatchableDrawn,
  getDrawableShoals,
  getLegalThrowTargets,
  getRequiredDrawCount,
} from '../core/rules.js';

/** 能力对 AI 的额外价值（"抢关键能力鱼"的量化） */
const ABILITY_BONUS = {
  draw_extra: 2,
  swap_fish: 2,
  force_exhaust: 1.5,
  immunity: 1.5,
  peek_shoal: 1,
  shuffle_shoals: 1,
};

/**
 * AI 对一张卡的价值评估：分值 - 污秽风险 + 能力价值。
 * @returns {number}
 */
export function aiCardValue(card, state, playerIndex) {
  let v = card.points;
  if (card.type === 'foul') v -= 2; // 污秽风险（含 -2 惩罚与负分倾向）
  if (card.ability) v += ABILITY_BONUS[card.ability] || 0;
  return v;
}

/** 选择当前玩家本回合的下一步动作 */
export function chooseAction(state) {
  switch (state.phase) {
    case 'ability':
      return chooseAbilityAction(state);
    case 'draw':
      return chooseDrawAction(state);
    case 'catch':
      return chooseCatchAction(state);
    default:
      return null;
  }
}

/** 能力阶段：按价值依次评估可用的能力鱼，决定发动哪个或跳过 */
function chooseAbilityAction(state) {
  const p = state.currentPlayer;
  const me = state.players[p];
  const opp = state.players[(p + 1) % state.players.length];
  const ready = me.caught.filter((id) => !me.exhausted.includes(id) && CARD_BY_ID[id].ability);

  for (const cardId of ready) {
    const action = buildAbilityAction(state, CARD_BY_ID[cardId], opp);
    if (action) return action;
  }
  return { type: 'PASS_ABILITIES' };
}

function buildAbilityAction(state, card, opp) {
  const p = state.currentPlayer;
  const me = state.players[p];
  switch (card.ability) {
    case 'draw_extra':
      // 多抽一张总是有利（更多选择）
      return { type: 'USE_ABILITY', cardId: card.id };

    case 'peek_shoal': {
      const nonEmpty = getDrawableShoals(state);
      if (nonEmpty.length === 0) return null;
      return { type: 'USE_ABILITY', cardId: card.id, target: { shoalIndex: nonEmpty[0] } };
    }

    case 'force_exhaust':
      // 横置对方仍有能力且未横置的鱼，废掉其能力
      if (opp.immune) return null;
      const target = opp.caught.find((id) => !opp.exhausted.includes(id) && CARD_BY_ID[id].ability);
      if (target) return { type: 'USE_ABILITY', cardId: card.id, target: { cardId: target } };
      return null;

    case 'swap_fish': {
      if (opp.immune) return null;
      if (me.caught.length === 0 || opp.caught.length === 0) return null;
      const myWorst = [...me.caught].sort(
        (a, b) => aiCardValue(CARD_BY_ID[a], state, p) - aiCardValue(CARD_BY_ID[b], state, p)
      )[0];
      const oppBest = [...opp.caught].sort(
        (a, b) => aiCardValue(CARD_BY_ID[b], state, p) - aiCardValue(CARD_BY_ID[a], state, p)
      )[0];
      if (aiCardValue(CARD_BY_ID[oppBest], state, p) > aiCardValue(CARD_BY_ID[myWorst], state, p)) {
        return { type: 'USE_ABILITY', cardId: card.id, target: { ownCardId: myWorst, oppCardId: oppBest } };
      }
      return null;
    }

    case 'shuffle_shoals': {
      // 顶牌小阴影不足 3 时洗牌，改善抽牌前景
      const smallTops = state.shoals.filter((s) => s.length > 0 && CARD_BY_ID[s[0]].strength <= 0).length;
      if (smallTops < 3) return { type: 'USE_ABILITY', cardId: card.id };
      return null;
    }

    case 'immunity': {
      // 对方有可用的交换/横置能力时开免疫自保
      const threat = opp.caught.some(
        (id) =>
          !opp.exhausted.includes(id) &&
          (CARD_BY_ID[id].ability === 'swap_fish' || CARD_BY_ID[id].ability === 'force_exhaust')
      );
      if (threat) return { type: 'USE_ABILITY', cardId: card.id };
      return null;
    }

    default:
      return null;
  }
}

/** 抽牌阶段：优先选"顶牌或次顶牌可钓且价值高"的浅滩 */
function chooseDrawAction(state) {
  const required = getRequiredDrawCount(state);
  const drawable = getDrawableShoals(state);
  const hooks = getHooks(state, state.currentPlayer);
  const me = state.currentPlayer;

  const scored = drawable.map((i) => {
    const shoal = state.shoals[i];
    const top = CARD_BY_ID[shoal[0]];
    const second = shoal.length > 1 ? CARD_BY_ID[shoal[1]] : null;
    let score = aiCardValue(top, state, me);
    if (hooks >= top.strength) score += 10;
    else if (second && hooks >= second.strength) score += 6; // 抽掉顶牌即可钓到次顶牌
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const from = scored.slice(0, required).map((s) => s.i);
  return { type: 'DRAW', from };
}

/** 钓走/放生阶段：钓价值最高的可钓牌，其余放回合法浅滩（避免放回来源浅滩，防止埋住可钓牌） */
function chooseCatchAction(state) {
  const catchable = getCatchableDrawn(state);
  if (catchable.length > 0 && !state.caughtThisTurn) {
    const best = catchable
      .map((id) => ({ id, v: aiCardValue(CARD_BY_ID[id], state, state.currentPlayer) }))
      .sort((a, b) => b.v - a.v)[0];
    return { type: 'CATCH', cardId: best.id };
  }
  const idx = 0;
  const sourceShoal = state.drawnFrom[idx];
  const legal = getLegalThrowTargets(state);
  const target = legal.find((i) => i !== sourceShoal) ?? legal[0];
  return { type: 'THROW_BACK', cardId: state.drawn[idx], shoalIndex: target };
}

export { canCatch };
