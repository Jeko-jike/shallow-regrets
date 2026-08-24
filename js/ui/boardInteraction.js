/**
 * 玩家棋盘交互处理器（M1/M2/M3 与 M5 Solo 共用）。
 * 纯交互：根据 (state, ui) 处理点击并派发动作；不持有业务规则。
 * 通过工厂注入 getState/getUi/dispatch/renderAll，避免与具体控制器耦合。
 */
import { CARD_BY_ID } from '../core/cards.js';
import { ABILITY_DESCRIPTIONS } from '../core/abilities.js';
import { ACTION, PHASE } from '../core/stateMachine.js';
import { getLegalThrowTargets, getCatchableDrawn, getRequiredDrawCount } from '../core/rules.js';
import * as modal from './modal.js';

/**
 * @param {object} ctx
 * @param {()=>object} ctx.getState 返回当前对局状态
 * @param {()=>object} ctx.getUi 返回可变的 UI 选择状态（selectedShoals/throwCardId/abilityCardId/swapStep/swapOwn）
 * @param {(action:object)=>boolean} ctx.dispatch 派发动作并推进状态
 * @param {()=>void} ctx.renderAll 重渲染
 */
export function createBoardInteraction({ getState, getUi, dispatch, renderAll }) {
  function onShoalClick(i) {
    const s = getState();
    const ui = getUi();

    if (s.phase === PHASE.DRAW) {
      const count = ui.selectedShoals.filter((x) => x === i).length;
      const max = Math.min(2, s.shoals[i].length); // 同一浅滩最多抽其现有张数
      if (count >= max) {
        ui.selectedShoals = ui.selectedShoals.filter((x) => x !== i);
      } else {
        ui.selectedShoals.push(i);
      }
      renderAll();
      return;
    }

    if (s.phase === PHASE.CATCH && ui.throwCardId != null) {
      const legal = getLegalThrowTargets(s);
      if (legal.includes(i)) {
        const cardId = ui.throwCardId;
        ui.throwCardId = null;
        dispatch({ type: ACTION.THROW_BACK, cardId, shoalIndex: i });
      }
      return;
    }

    if (s.phase === PHASE.ABILITY && ui.abilityCardId) {
      const ability = CARD_BY_ID[ui.abilityCardId].ability;
      if (ability === 'peek_shoal') {
        if (s.shoals[i].length === 0) {
          modal.showToast('该浅滩为空，无法偷看', 'error');
          return;
        }
        const cardId = ui.abilityCardId;
        ui.abilityCardId = null;
        dispatch({ type: ACTION.USE_ABILITY, cardId, target: { shoalIndex: i } });
        const lastPeek = getState().lastPeek;
        if (lastPeek) {
          const c = CARD_BY_ID[lastPeek.cardId];
          modal.showModal({
            title: '偷看结果',
            body: `<p>浅滩${lastPeek.shoalIndex + 1} 的顶牌是：<strong>「${c.name}」</strong>（${c.points} 分，需 ${c.strength} 钩）</p>`,
            actions: [{ text: '知道了' }],
          });
        }
      }
    }
  }

  function onFishClick(playerIndex, cardId) {
    const s = getState();
    const ui = getUi();
    const me = s.currentPlayer;

    // 自己已钓的能力鱼：能力阶段发动
    if (playerIndex === me && s.phase === PHASE.ABILITY) {
      const card = CARD_BY_ID[cardId];
      if (!card.ability || s.players[me].exhausted.includes(cardId)) return;
      if (ui.abilityCardId && ui.swapStep === 'own') {
        // swap_fish：选择自己要交换出去的鱼
        ui.swapOwn = cardId;
        ui.swapStep = 'opp';
        modal.showToast('请点击对方的一条鱼进行交换', 'info');
        renderAll();
        return;
      }
      activateAbility(cardId);
      return;
    }

    // 对方鱼：能力目标选择
    if (playerIndex !== me && s.phase === PHASE.ABILITY && ui.abilityCardId) {
      const ability = CARD_BY_ID[ui.abilityCardId].ability;
      if (ability === 'force_exhaust') {
        const cardId2 = ui.abilityCardId;
        ui.abilityCardId = null;
        dispatch({ type: ACTION.USE_ABILITY, cardId: cardId2, target: { cardId } });
        return;
      }
      if (ability === 'swap_fish' && ui.swapStep === 'opp') {
        const cardId2 = ui.abilityCardId;
        const ownCardId = ui.swapOwn;
        ui.abilityCardId = null;
        ui.swapStep = null;
        ui.swapOwn = null;
        dispatch({ type: ACTION.USE_ABILITY, cardId: cardId2, target: { ownCardId, oppCardId: cardId } });
      }
    }
  }

  function activateAbility(cardId) {
    const card = CARD_BY_ID[cardId];
    const ability = card.ability;
    const desc = ABILITY_DESCRIPTIONS[ability] || '';
    const ui = getUi();

    const noTarget = ['draw_extra', 'shuffle_shoals', 'immunity'].includes(ability);
    if (noTarget) {
      modal.showConfirm({
        title: `发动「${card.name}」`,
        message: `发动能力：${desc}？发动后该鱼将横置（整局仅一次）。`,
        confirmText: '发动',
        onConfirm: () => dispatch({ type: ACTION.USE_ABILITY, cardId }),
      });
      return;
    }

    // 需要选择目标
    ui.abilityCardId = cardId;
    if (ability === 'swap_fish') {
      ui.swapStep = 'own';
      modal.showToast('请点击你要交换出去的一条鱼', 'info');
    } else {
      modal.showToast(ability === 'peek_shoal' ? '请点击一个浅滩偷看其顶牌' : '请点击对方的一条鱼', 'info');
    }
    renderAll();
  }

  function onPassAbilities() {
    const ui = getUi();
    ui.abilityCardId = null;
    ui.swapStep = null;
    ui.swapOwn = null;
    dispatch({ type: ACTION.PASS_ABILITIES });
  }

  function onConfirmDraw() {
    const ui = getUi();
    const required = getRequiredDrawCount(getState());
    if (ui.selectedShoals.length !== required) return;
    const from = ui.selectedShoals;
    ui.selectedShoals = [];
    dispatch({ type: ACTION.DRAW, from });
  }

  function onCatch(cardId) {
    dispatch({ type: ACTION.CATCH, cardId });
  }

  function onThrowClick(cardId) {
    const s = getState();
    if (!s.caughtThisTurn && getCatchableDrawn(s).length > 0) {
      modal.showToast('有可钓走的鱼，请先钓走一条', 'error');
      return;
    }
    getUi().throwCardId = cardId;
    modal.showToast('请点击一个浅滩放回该牌', 'info');
    renderAll();
  }

  function onCancelThrow() {
    getUi().throwCardId = null;
    renderAll();
  }

  return { onShoalClick, onFishClick, onPassAbilities, onConfirmDraw, onCatch, onThrowClick, onCancelThrow };
}
