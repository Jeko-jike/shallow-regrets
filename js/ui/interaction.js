/**
 * 交互逻辑：根据 (state, ui) 计算"哪些元素可点、如何提示"。
 * 纯计算，不直接操作 DOM；点击后的动作派发由 main.js / boardInteraction.js 负责。
 *
 * 能力目标选择采用"瞄准模式"（aim）：决定正在选取哪类目标。
 * 模式：
 *   player    选取一位玩家（give_card）
 *   oppFish   选取对方的一条鱼（exhaust_*）
 *   swapOwn   先选自己要换出的鱼（swap_* 第一步）
 *   swapOpp   再选对方的鱼（swap_* 第二步）
 *   shoal     选取一个鱼群（rearrange）
 *   shoalZero 选取顶牌难度 0 的鱼群（remove_zero）
 *   shoalPeek 选取 1-3 个鱼群（peek_multi）
 */
import { CARD_BY_ID } from '../core/cards.js';
import { PHASE } from '../core/stateMachine.js';
import { getDrawableShoals, getRequiredDrawCount, getCatchableDrawn, getLegalThrowTargets, getCatchLimit } from '../core/rules.js';

/** 当前能力的目标瞄准模式；无目标主动能力返回 null */
export function abilityAim(state, ui) {
  const ability = ui.abilityCardId ? CARD_BY_ID[ui.abilityCardId].ability : null;
  if (!ability) return null;
  switch (ability) {
    case 'give_card': return { mode: 'player' };
    case 'exhaust_foul': return { mode: 'oppFish', typeFilter: 'foul' };
    case 'exhaust_fair': return { mode: 'oppFish', typeFilter: 'fair' };
    case 'exhaust_any': return { mode: 'oppFish', typeFilter: null };
    case 'swap_any':
    case 'swap_fair':
    case 'swap_zero':
      return { mode: ui.swapStep === 'own' ? 'swapOwn' : 'swapOpp' };
    case 'rearrange_shoal': return { mode: 'shoal' };
    case 'remove_zero': return { mode: 'removeZero' };
    case 'peek_multi': return { mode: 'shoalPeek' };
    default: return null; // 无目标：draw_plus/power/reveal/shuffle/snow/pass_left
  }
}

/** 一目标模式下手动可点的鱼群索引（shoal / shoalZero / shoalPeek） */
export function aimShoalTargets(state, aim) {
  if (!aim) return [];
  switch (aim.mode) {
    case 'shoal': return state.shoals.map((s, i) => (s.length > 0 ? i : -1)).filter((i) => i !== -1);
    case 'shoalZero':
    case 'removeZero': return state.shoals.map((s, i) => (s.length > 0 && CARD_BY_ID[s[0]].strength === 0 ? i : -1)).filter((i) => i !== -1);
    case 'shoalPeek': return state.shoals.map((s, i) => (s.length > 0 ? i : -1)).filter((i) => i !== -1);
    default: return [];
  }
}

/** 瞄准池里是否包含指定鱼群 */
export function isPeekSelected(ui, i) {
  return Array.isArray(ui.aimShoals) && ui.aimShoals.includes(i);
}

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
    hint:
      total === 0
        ? `请选择 ${required} 张牌：点击浅滩加选（同一浅滩最多 2 张）`
        : `已选 ${total}/${required} · 点击已选浅滩可取消`,
  };
}

/**
 * 钓走/放回阶段交互。
 * @returns {{catchable:string[], mustCatchFirst:boolean, limit:number, hint:string}}
 */
export function getCatchInteraction(state) {
  const catchable = getCatchableDrawn(state);
  const limit = getCatchLimit(state);
  const mustCatchFirst = state.caughtThisTurn === 0 && catchable.length > 0;
  return {
    catchable,
    mustCatchFirst,
    limit,
    hint: mustCatchFirst
      ? '有可钓走的鱼，请先钓走一条'
      : state.caughtThisTurn > 0
        ? `已钓走 ${state.caughtThisTurn}/${limit} 条，其余放回`
        : '无牌可钓，请全部放回',
  };
}

/**
 * 构建渲染层所需的棋盘 UI 描述（浅滩可点/选中、放回目标、能力目标、状态文案）。
 * @param {object} state 当前对局状态
 * @param {object} ui 可变的 UI 选择状态（selectedShoals/throwCardId/abilityCardId/aimShoals/swapStep/swapOwn）
 * @param {{canInteract:boolean, statusText:string}} ctx 是否可交互与状态提示文案
 */
export function buildBoardUi(state, ui, { canInteract, statusText }) {
  const phase = state.phase;
  const me = state.currentPlayer;
  const aim = phase === PHASE.ABILITY ? abilityAim(state, ui) : null;
  const aimShoals = aimShoalTargets(state, aim);
  const drawInter = phase === PHASE.DRAW ? getDrawInteraction(state, ui) : null;
  const catchInter = phase === PHASE.CATCH ? getCatchInteraction(state) : null;

  // peek_multi 的多选计数并入浅滩徽标/选中态
  const peekCounts = {};
  if (aim?.mode === 'shoalPeek' && Array.isArray(ui.aimShoals)) {
    for (const i of ui.aimShoals) peekCounts[i] = (peekCounts[i] || 0) + 1;
  }

  return {
    phase,
    canInteract,
    aim,
    aimShoals,
    shoalClickable: (i) => {
      if (!canInteract) return false;
      if (phase === PHASE.DRAW && drawInter) {
        const count = ui.selectedShoals.filter((x) => x === i).length;
        if (count > 0) return drawInter.drawable.includes(i);
        return drawInter.drawable.includes(i) && drawInter.total < drawInter.required;
      }
      if (phase === PHASE.CATCH && ui.throwCardId != null) {
        return getLegalThrowTargets(state).includes(i);
      }
      if (phase === PHASE.ABILITY && aim && aimShoals.includes(i)) return true;
      return false;
    },
    shoalSelected: (i) => {
      if (phase === PHASE.DRAW && drawInter) return drawInter.selectCount[i] > 0;
      if (aim?.mode === 'shoalPeek') return isPeekSelected(ui, i);
      return false;
    },
    shoalSelectCount: { ...(drawInter ? drawInter.selectCount : {}), ...peekCounts },
    throwTargets: phase === PHASE.CATCH && ui.throwCardId != null ? getLegalThrowTargets(state) : null,
    drawCanConfirm: drawInter ? drawInter.canConfirm : false,
    drawSelectedTotal: drawInter ? drawInter.total : 0,
    peekCanConfirm: aim?.mode === 'shoalPeek' && (ui.aimShoals?.length ?? 0) > 0,
    throwCardId: ui.throwCardId,
    fishClickable: (i, cardId) => {
      if (!canInteract) return false;
      if (phase !== PHASE.ABILITY) return false;
      if (aim?.mode === 'swapOwn' && i === me) {
        return !state.players[i].exhausted.includes(cardId) || cardId === ui.abilityCardId;
      }
      if (aim && i !== me) {
        if (aim.mode === 'oppFish' || aim.mode === 'swapOpp' || aim.mode === 'player') {
          const o = state.players[i];
          // oppFish 对目标卡本身有类型校验；这里仅提供可点性，非法目标由派发校验拒绝
          return !o.exhausted.includes(cardId) || aim.mode === 'player';
        }
        // removeZero：对方已钓的难度 0 鱼可点（移除游戏）
        if (aim.mode === 'removeZero') {
          return state.players[i].caught.some((cid) => CARD_BY_ID[cid].strength === 0);
        }
        return false;
      }
      // 非瞄准：自己可发动的能力鱼（详情入口由 onFishClick 打开）
      return i === me && !!CARD_BY_ID[cardId].ability && !state.players[i].exhausted.includes(cardId);
    },
    drawnHint: catchInter ? catchInter.hint : '',
    mustCatchFirst: catchInter ? catchInter.mustCatchFirst : false,
    statusText,
  };
}