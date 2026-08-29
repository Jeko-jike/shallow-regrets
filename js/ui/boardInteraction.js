/**
 * 玩家棋盘交互处理器（M1/M2/M3 与 M5 Solo 共用）。
 * 纯交互：根据 (state, ui) 处理点击并派发动作；不持有业务规则。
 * 通过工厂注入 getState/getUi/dispatch/renderAll，避免与具体控制器耦合。
 *
 * 含两大部分：
 *  1) 常规动作分发（抽牌 / 钓走 / 放回 / 能力目标选择）
 *  2) 反应窗口（pending：REDIRECT/COUNTER/REARRANGE/PASS_LEFT）的玩家解析弹窗
 */
import { CARD_BY_ID } from '../core/cards.js';
import { ABILITIES } from '../core/abilities.js';
import { ACTION, PHASE } from '../core/stateMachine.js';
import { getLegalThrowTargets, getCatchableDrawn, getRequiredDrawCount } from '../core/rules.js';
import { getArtUrl } from '../data/artPrompts.js';
import { abilityAim, aimShoalTargets } from './interaction.js';
import * as modal from './modal.js';
import * as render from './render.js';

/** 无目标的主动能力（直接确认发动） */
const NO_TARGET_KEYS = new Set([
  'draw_plus2', 'draw_plus1', 'power_plus3', 'reveal_all', 'shuffle_all', 'snow_guard', 'pass_left',
]);

/**
 * @param {object} ctx
 * @param {()=>object} ctx.getState 返回当前对局状态
 * @param {()=>object} ctx.getUi 返回可变的 UI 选择状态
 * @param {(action:object)=>boolean} ctx.dispatch 派发动作并推进状态（返回是否成功）
 * @param {()=>void} ctx.renderAll 重渲染
 */
export function createBoardInteraction({ getState, getUi, dispatch, renderAll }) {
  function clearAbilityAim(ui) {
    ui.abilityCardId = null;
    ui.aimShoals = [];
    ui.swapStep = null;
    ui.swapOwn = null;
  }

  function onShoalClick(i) {
    const s = getState();
    const ui = getUi();

    if (s.phase === PHASE.DRAW) {
      const required = getRequiredDrawCount(s);
      const count = ui.selectedShoals.filter((x) => x === i).length;
      const max = Math.min(2, s.shoals[i].length); // 同一浅滩最多抽其现有张数
      if (count > 0 && (count >= max || ui.selectedShoals.length >= required)) {
        ui.selectedShoals = ui.selectedShoals.filter((x) => x !== i);
      } else if (ui.selectedShoals.length < required && count < max) {
        ui.selectedShoals.push(i);
      } else {
        modal.showToast(`本回合需抽 ${required} 张，已选 ${ui.selectedShoals.length} 张，点击已选浅滩可取消`, 'info');
      }
      renderAll();
      return;
    }

    if (s.phase === PHASE.CATCH && ui.throwCardId != null) {
      const legal = getLegalThrowTargets(s);
      if (!legal.includes(i)) {
        modal.showToast(legal.length ? '只能放回高亮（可操作）的浅滩' : '当前回合不允许放回这张牌', 'info');
        return;
      }
      const cardId = ui.throwCardId;
      ui.throwCardId = null;
      dispatch({ type: ACTION.THROW_BACK, cardId, shoalIndex: i });
      return;
    }

    if (s.phase === PHASE.ABILITY && ui.abilityCardId) {
      const aim = abilityAim(s, ui);
      if (!aim) return;
      const cardId = ui.abilityCardId;
      if (aim.mode === 'shoalPeek') {
        if (!aimShoalTargets(s, aim).includes(i)) return;
        ui.aimShoals = ui.aimShoals || [];
        if (ui.aimShoals.includes(i)) ui.aimShoals = ui.aimShoals.filter((x) => x !== i);
        else if (ui.aimShoals.length < 3) ui.aimShoals.push(i);
        renderAll();
        return;
      }
      if (s.shoals[i].length === 0) {
        modal.showToast('该浅滩为空，无法选择', 'error');
        return;
      }
      if (aim.mode === 'removeZero' && CARD_BY_ID[s.shoals[i][0]].strength !== 0) {
        modal.showToast('只能移除一张难度 0 的鱼牌', 'error');
        return;
      }
      ui.abilityCardId = null;
      ui.aimShoals = [];
      dispatch({ type: ACTION.USE_ABILITY, cardId, target: { shoalIndex: i, cardIndex: 0 } });
    }
  }

  /** 确认查看（peek_multi） */
  function onConfirmPeek() {
    const s = getState();
    const ui = getUi();
    const aim = abilityAim(s, ui);
    if (aim?.mode !== 'shoalPeek' || !(ui.aimShoals || []).length) return;
    const cardId = ui.abilityCardId;
    const shoalIndexes = [...(ui.aimShoals || [])];
    ui.abilityCardId = null;
    ui.aimShoals = [];
    dispatch({ type: ACTION.USE_ABILITY, cardId, target: { shoalIndexes } });
    const lastPeek = getState().lastPeek;
    if (lastPeek && Array.isArray(lastPeek.cardIds)) {
      const rows = lastPeek.cardIds
        .map(
          ({ shoalIndex, cardId: cid }) => {
            const c = CARD_BY_ID[cid];
            return `<li>浅滩${shoalIndex + 1}：<strong>${c.name}</strong>（${c.points} 分 · 需 ${c.strength} 钩）</li>`;
          },
        )
        .join('');
      modal.showModal({ title: '偷看结果', body: `<ul class="peek-list">${rows}</ul>`, actions: [{ text: '知道了' }] });
    }
  }

  function onFishClick(playerIndex, cardId) {
    const s = getState();
    const ui = getUi();
    const me = s.currentPlayer;

    if (s.phase === PHASE.ABILITY && ui.abilityCardId) {
      const aim = abilityAim(s, ui);
      // 永续能力等无法目标的瞄准态：abilityCardId 已置位但 aim 为 null 时点击必被吞。
      // 兜底自清并走详情，避免界面卡死无法点其他牌。
      if (!aim) {
        clearAbilityAim(ui);
        renderAll();
      } else {
        const cardId2 = ui.abilityCardId;
        if (aim.mode === 'swapOwn' && playerIndex === me) {
          ui.swapOwn = cardId;
          ui.swapStep = 'opp';
          modal.showToast('请点击对方的一条鱼进行交换', 'info');
          renderAll();
          return;
        }
        if (playerIndex !== me) {
          if (aim.mode === 'removeZero' && CARD_BY_ID[cardId].strength !== 0) {
            modal.showToast('只能移除难度 0 的鱼牌', 'error');
            return;
          }
          const target = (() => {
            if (aim.mode === 'swapOpp') return { playerIndex, ownCardId: ui.swapOwn, oppCardId: cardId };
            if (aim.mode === 'player') return { playerIndex };
            return { playerIndex, cardId };
          })();
          ui.abilityCardId = null;
          ui.aimShoals = [];
          ui.swapStep = null;
          ui.swapOwn = null;
          dispatch({ type: ACTION.USE_ABILITY, cardId: cardId2, target });
          return;
        }
        return;
      }
    }

    // 所有已钓的鱼（含可发动能力的能力鱼）点击都打开详情弹窗；
    // 详情内提供「发动能力」按钮，避免点击能力鱼时直接跳过详情。
    showCardDetail(playerIndex, cardId);
  }

  function activateAbility(cardId) {
    const card = CARD_BY_ID[cardId];
    const ability = card.ability;
    const desc = ABILITIES[ability]?.desc || '';
    const ui = getUi();

    if (NO_TARGET_KEYS.has(ability)) {
      modal.showConfirm({
        title: `发动「${card.name}」`,
        message: `发动能力：${desc}？发动后该鱼将横置（整局仅一次）。`,
        confirmText: '发动',
        onConfirm: () => dispatch({ type: ACTION.USE_ABILITY, cardId }),
      });
      return;
    }

    clearAbilityAim(ui);
    ui.abilityCardId = cardId;
    ui.aimShoals = [];
    if (ability === 'swap_any' || ability === 'swap_fair' || ability === 'swap_zero') {
      ui.swapStep = 'own';
      modal.showToast('请点击你要交换出去的一条鱼', 'info');
    } else if (ability === 'peek_multi') {
      modal.showToast('请点击 1-3 个浅滩查看其顶牌', 'info');
    } else if (ability === 'give_card') {
      modal.showToast('请点击对方的一位玩家', 'info');
    } else if (ability === 'remove_zero') {
      modal.showToast('点击浅滩的难度0顶牌，或对方已钓的难度0鱼', 'info');
    } else {
      modal.showToast('请点击对方的一条鱼', 'info');
    }
    renderAll();
  }

  /** 卡牌详情弹窗；能力阶段可顺带发动能力 */
  function showCardDetail(playerIndex, cardId) {
    const s = getState();
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    const owner = playerIndex != null ? s.players[playerIndex] : null;
    const exhausted = !!(owner && owner.exhausted.includes(cardId));
    // 仅一次性主动能力可发动；永续能力（passive）为常驻被动，无「发动能力」入口
    const canAct =
      s.phase === PHASE.ABILITY && owner && playerIndex === s.currentPlayer &&
      ABILITIES[card.ability]?.kind === 'active' && !exhausted;

    const body = document.createElement('div');
    body.className = 'card-detail';
    const art = document.createElement('div');
    art.className = 'cd-art';
    const img = document.createElement('img');
    img.src = getArtUrl(card.id);
    img.alt = card.name;
    art.appendChild(img);
    const info = document.createElement('div');
    info.className = 'cd-info';
    info.innerHTML = `
      <div class="cd-name">${card.name}<span class="cd-en"> ${card.nameEn}</span></div>
      <div class="cd-tags">
        ${card.type === 'foul' ? '<span class="cd-tag foul">污秽</span>' : ''}
        <span class="cd-tag">${card.points} 分</span>
        <span class="cd-tag">需 ${card.strength}⚓</span>
        <span class="cd-tag">供 ${card.hooks}⚓</span>
      </div>
      <div class="cd-ability"><b>能力：</b>${card.ability ? ABILITIES[card.ability]?.desc : '无'}</div>
    `;
    body.appendChild(art);
    body.appendChild(info);

    const actions = [{ text: '知道了', className: 'btn-ghost' }];
    if (canAct) {
      actions.unshift({ text: '发动能力', className: 'btn-primary', onClick: () => activateAbility(cardId) });
    }
    modal.showModal({ title: '卡牌详情', body, actions });
  }

  /* ===== 反应窗口解析 ===== */

  /** 正在等待决策的人：若在 Solo 中需要脚本自动结算，调用方会先行处理；此处针对玩家弹窗 */
  function showPendingResolution() {
    const s = getState();
    const pending = s.pending;
    if (s.phase !== PHASE.PENDING || !pending) return;

    const done = () => {
      const after = getState();
      if (after.phase === PHASE.PENDING && after.pending) showPendingResolution();
    };

    switch (pending.type) {
      case 'REDIRECT': {
        const init = statePlayer(s, pending.initiatorIdx);
        const name = init ? init.name : '对方';
        const acts = [{ text: '拒绝改向', className: 'btn-ghost', onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { use: false } }); done(); } }];
        pending.candidates.forEach((ci, k) => {
          acts.push({
            text: `用 ${s.players[ci].name} 的女妖改向`,
            className: 'btn-primary',
            onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { use: true, candidateIdx: k } }); done(); },
          });
        });
        modal.showModal({
          title: '女妖的凝视 · 改向？',
          body: `<p>${name} 将某一目标指向一条鱼。<br>持有女妖的玩家可把目标改成女妖以保护原目标。</p>`,
          actions: acts,
        });
        break;
      }
      case 'COUNTER': {
        const bodyEl = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = `${s.players[pending.counterP].name} 的僧帽水母被惊动了——可横置攻击者的一条鱼以先发制人。`;
        bodyEl.appendChild(p);
        const acts = [{ text: '放弃反击', className: 'btn-ghost', onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { use: false } }); done(); } }];
        pending.counterTargets.forEach((cid) => {
          const c = CARD_BY_ID[cid];
          acts.push({
            text: `横置「${c.name}」`,
            className: 'btn-primary',
            onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { use: true, cardId: cid } }); done(); },
          });
        });
        modal.showModal({ title: '僧帽反击', body: bodyEl, actions: acts });
        break;
      }
      case 'REARRANGE': {
        if ((pending.cards || []).length <= 1) {
          dispatch({ type: ACTION.RESOLVE, resolution: { order: (pending.cards || []).slice() } });
          done();
          break;
        }
        buildRearrangeModal(s, pending, dispatch, done);
        break;
      }
      case 'PASS_LEFT': {
        const fromIdx = pending.playerIndices[pending.current];
        const p = s.players[fromIdx];
        const bodyEl = document.createElement('div');
        const pEl = document.createElement('p');
        pEl.textContent = `${p.name} 请选择要传给下一位玩家的一条鱼（腐鱼：全员传递）。`;
        bodyEl.appendChild(pEl);
        const acts = [];
        p.caught.forEach((cid) => {
          const c = CARD_BY_ID[cid];
          acts.push({
            text: `传「${c.name}」`,
            className: 'btn-primary',
            onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { pick: cid } }); done(); },
          });
        });
        acts.push({
          text: '无牌可传（跳过）',
          className: 'btn-ghost',
          onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: {} }); done(); },
        });
        modal.showModal({ title: '腐鱼 · 传牌', body: bodyEl, actions: acts });
        break;
      }
      default:
        break;
    }
  }

  function onPassAbilities() {
    const ui = getUi();
    clearAbilityAim(ui);
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

  function onClearDraw() {
    const ui = getUi();
    if (ui.selectedShoals.length === 0) return;
    ui.selectedShoals = [];
    renderAll();
  }

  function onCatch(cardId) {
    dispatch({ type: ACTION.CATCH, cardId });
  }

  function onThrowClick(cardId) {
    const s = getState();
    if (s.caughtThisTurn === 0 && getCatchableDrawn(s).length > 0) {
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

  function onCancelAim() {
    const ui = getUi();
    clearAbilityAim(ui);
    renderAll();
  }

  return {
    onShoalClick,
    onFishClick,
    onPassAbilities,
    onConfirmDraw,
    onClearDraw,
    onCatch,
    onThrowClick,
    onCancelThrow,
    onConfirmPeek,
    onCancelAim,
    showCardDetail,
    showPendingResolution,
  };
}

function statePlayer(state, idx) {
  return state.players[idx] || null;
}

/** 眼球团：在弹窗中通过 上移/下移 重排一个鱼群的牌 */
function buildRearrangeModal(state, pending, dispatch, done) {
  const cards = pending.cards.slice();
  const bodyEl = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = '调整鱼群的牌序（上→下 = 顶→底，第一张为下一次抽到的牌）。';
  bodyEl.appendChild(p);
  const list = document.createElement('ul');
  list.className = 'rearrange-list';
  bodyEl.appendChild(list);

  const renderList = () => {
    list.innerHTML = '';
    cards.forEach((cid, idx) => {
      const c = CARD_BY_ID[cid];
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'rr-name';
      name.textContent = `${idx + 1}. ${c.name}`;
      li.appendChild(name);
      const up = document.createElement('button');
      up.className = 'btn btn-sm';
      up.textContent = '上移';
      up.disabled = idx === 0;
      up.addEventListener('click', () => {
        [cards[idx - 1], cards[idx]] = [cards[idx], cards[idx - 1]];
        renderList();
      });
      const down = document.createElement('button');
      down.className = 'btn btn-sm';
      down.textContent = '下移';
      down.disabled = idx === cards.length - 1;
      down.addEventListener('click', () => {
        [cards[idx + 1], cards[idx]] = [cards[idx], cards[idx + 1]];
        renderList();
      });
      const btnWrap = document.createElement('span');
      btnWrap.className = 'rr-actions';
      btnWrap.appendChild(up);
      btnWrap.appendChild(down);
      li.appendChild(btnWrap);
      list.appendChild(li);
    });
  };
  renderList();

  modal.showModal({
    title: '眼球团 · 重排鱼群',
    body: bodyEl,
    actions: [{ text: '确认顺序', className: 'btn-primary', onClick: () => { dispatch({ type: ACTION.RESOLVE, resolution: { order: cards.slice() } }); done(); } }],
  });
}