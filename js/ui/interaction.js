/**
 * 交互逻辑：根据 (state, ui) 计算"哪些元素可点、如何提示"。
 * 纯计算，不直接操作 DOM；点击后的动作派发由 main.js 负责。
 */
import { CARD_BY_ID } from '../core/cards.js';
import { PHASE } from '../core/stateMachine.js';
import { getDrawableShoals, getRequiredDrawCount, getCatchableDrawn, getLegalThrowTargets } from '../core/rules.js';

/**
 * 抽牌阶段交互：可点浅滩、选择计数、能否确认。
 * @returns {{required:number, drawable:number[], selectCount:Record<number,number>, total:number, canConfirm:boolean, hint:string}}
 */
export function getDrawInteraction(state, ui) {
  const required = getRequiredDrawCount(state);
  const drawable = getDrawableShoals(state);
  const selectCount = {};
  for (const idx of ui.selectedShoals) selectCount[idx] = (selectCount[idx] || 0) + 1;
  const total = ui.selectedShoals.length;
  return {
    required,
    drawable,
    selectCount,
    total,
    canConfirm: total === required,
    hint: total === 0 ? `请选择 ${required} 个浅滩抽牌` : `已选 ${total}/${required}，可重复点同一浅滩`,
  };
}

/**
 * 钓走/放回阶段交互：可钓牌、是否必须先钓、提示文案。
 * @returns {{catchable:string[], mustCatchFirst:boolean, hint:string}}
 */
export function getCatchInteraction(state) {
  const catchable = getCatchableDrawn(state);
  const mustCatchFirst = !state.caughtThisTurn && catchable.length > 0;
  return {
    catchable,
    mustCatchFirst,
    hint: mustCatchFirst
      ? '有可钓走的鱼，请先钓走一条'
      : state.caughtThisTurn
        ? '已钓走一条，其余放回'
        : '无牌可钓，请全部放回',
  };
}

/**
 * 构建渲染层所需的棋盘 UI 描述（浅滩可点/选中、放回目标、能力目标、状态文案）。
 * 供 main.js（M1/M2/M3）与 soloUI.js（M5）共用，避免重复。
 * @param {object} state 当前对局状态
 * @param {object} ui 可变的 UI 选择状态（selectedShoals/throwCardId/abilityCardId/swapStep/swapOwn）
 * @param {{canInteract:boolean, statusText:string}} ctx 是否可交互与状态提示文案
 */
export function buildBoardUi(state, ui, { canInteract, statusText }) {
  const phase = state.phase;
  const me = state.currentPlayer;
  const drawInter = phase === PHASE.DRAW ? getDrawInteraction(state, ui) : null;
  const catchInter = phase === PHASE.CATCH ? getCatchInteraction(state) : null;
  return {
    phase,
    canInteract,
    shoalClickable: (i) => {
      if (!canInteract) return false;
      if (phase === PHASE.DRAW && drawInter) {
        const count = ui.selectedShoals.filter((x) => x === i).length;
        return drawInter.drawable.includes(i) && count < Math.min(2, state.shoals[i].length);
      }
      if (phase === PHASE.CATCH && ui.throwCardId != null) {
        return getLegalThrowTargets(state).includes(i);
      }
      if (phase === PHASE.ABILITY && ui.abilityCardId && CARD_BY_ID[ui.abilityCardId].ability === 'peek_shoal') {
        return state.shoals[i].length > 0;
      }
      return false;
    },
    shoalSelected: (i) => (phase === PHASE.DRAW && drawInter ? drawInter.selectCount[i] > 0 : false),
    shoalSelectCount: drawInter ? drawInter.selectCount : {},
    throwTargets: phase === PHASE.CATCH && ui.throwCardId != null ? getLegalThrowTargets(state) : null,
    peekTargets:
      phase === PHASE.ABILITY && ui.abilityCardId && CARD_BY_ID[ui.abilityCardId].ability === 'peek_shoal'
        ? getDrawableShoals(state)
        : null,
    drawnHint: catchInter ? catchInter.hint : phase === PHASE.DRAW ? drawInter.hint : '',
    mustCatchFirst: catchInter ? catchInter.mustCatchFirst : false,
    drawCanConfirm: drawInter ? drawInter.canConfirm : false,
    throwCardId: ui.throwCardId,
    fishClickable: (i, cardId) => {
      if (!canInteract) return false;
      if (phase !== PHASE.ABILITY) return false;
      if (i === me) {
        if (ui.abilityCardId && ui.swapStep === 'own') {
          return !state.players[i].exhausted.includes(cardId);
        }
        const card = CARD_BY_ID[cardId];
        return !!card.ability && !state.players[i].exhausted.includes(cardId);
      }
      if (!ui.abilityCardId) return false;
      const ability = CARD_BY_ID[ui.abilityCardId].ability;
      if (ability === 'force_exhaust') return !state.players[i].exhausted.includes(cardId);
      if (ability === 'swap_fish' && ui.swapStep === 'opp') return true;
      return false;
    },
    statusText,
  };
}
