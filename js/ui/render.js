/**
 * 视图渲染：浅滩堆 / 抽出牌 / 玩家钓获区 / 操作区 / 结算面板。
 * 纯渲染：输入 (state, ui, handlers) 更新 DOM；不持有业务规则。
 */
import { CARD_BY_ID } from '../core/cards.js';
import { getHooks } from '../core/gameState.js';
import { getResults, getWinners, getRawScore } from '../core/scoring.js';
import { getArtUrl } from '../data/artPrompts.js';
import { ABILITIES } from '../core/abilities.js';
import { PHASE } from '../core/stateMachine.js';

const artCache = new Map();

function artUrl(card) {
  if (!artCache.has(card.id)) artCache.set(card.id, getArtUrl(card.id));
  return artCache.get(card.id);
}

/** 卡背难度区间（固定三段，不分层 ±）：
 *  难度 0 → "0"；难度 1、2 → "1-2"；难度 3、4、5 → "3-5" */
export function difficultyRange(strength) {
  if (strength <= 0) return '0';
  if (strength <= 2) return '1-2';
  return '3-5';
}

/**
 * 构建一张卡面元素。
 * 布局：上半 50% 插画，下半 50% 信息区（分值 / 需钩（难度）/ 供钩（钩数）/ 名称 / 能力）。
 * @param {object} card 鱼卡数据
 * @param {{size?:string, selectable?:boolean, selected?:boolean, exhausted?:boolean, legalTarget?:boolean, data?:Record<string,string|number>}} opts
 */
export function buildCardFront(card, { size = '', selectable = false, selected = false, exhausted = false, legalTarget = false, data = {} } = {}) {
  const el = document.createElement('div');
  el.className = ['card-front', card.type === 'foul' ? 'foul' : '', size].filter(Boolean).join(' ');
  if (selectable) el.classList.add('selectable');
  if (selected) el.classList.add('selected');
  if (exhausted) el.classList.add('exhausted');
  if (legalTarget) el.classList.add('legal-target');
  for (const [k, v] of Object.entries(data)) el.dataset[k] = String(v);

  // —— 上半：插画区（约 50%）——
  const artWrap = document.createElement('div');
  artWrap.className = 'cf-art-wrap';
  const img = document.createElement('img');
  img.className = 'cf-art';
  img.alt = card.name;
  img.draggable = false;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = artUrl(card);
  img.addEventListener('error', () => {
    img.remove();
    artWrap.classList.add('art-fallback');
  }, { once: true });
  artWrap.appendChild(img);
  if (card.type === 'foul') {
    const tag = document.createElement('div');
    tag.className = 'cf-foul-tag';
    tag.textContent = '污秽';
    artWrap.appendChild(tag);
  }
  el.appendChild(artWrap);

  // —— 下半：信息区（约 50%）——
  const info = document.createElement('div');
  info.className = 'cf-info';

  const stats = document.createElement('div');
  stats.className = 'cf-stats';
  const pts = document.createElement('span');
  pts.className = 'cf-points';
  pts.textContent = `${card.points}分`;
  stats.appendChild(pts);
  const need = document.createElement('span');
  need.className = 'cf-need';
  need.title = `获取难度：钓起需消耗 ${card.strength} 钩`;
  need.innerHTML = `需${card.strength}<span class="hook">⚓</span>`;
  stats.appendChild(need);
  const give = document.createElement('span');
  give.className = 'cf-give' + (card.hooks === 0 ? ' zero' : '');
  give.title = `获取钩子数：钓获后提供 ${card.hooks} 钩`;
  give.innerHTML = `供${card.hooks}<span class="hook">⚓</span>`;
  stats.appendChild(give);
  info.appendChild(stats);

  const name = document.createElement('div');
  name.className = 'cf-name';
  name.textContent = card.name;
  info.appendChild(name);

  if (card.ability) {
    const ab = document.createElement('div');
    ab.className = 'cf-ability';
    ab.textContent = ABILITIES[card.ability]?.desc || '';
    info.appendChild(ab);
  }

  el.appendChild(info);
  return el;
}

const PHASE_NAMES = { ability: '能力阶段', draw: '抽牌阶段', catch: '钓走/放回', pending: '待决策', gameOver: '对局结束' };

export function renderTurnInfo(el, state) {
  el.textContent = `第 ${state.turn} 回合 · ${state.players[state.currentPlayer].name} · ${PHASE_NAMES[state.phase] || state.phase}`;
}

export function renderPlayersBar(el, state, meta) {
  el.innerHTML = '';
  // meta：联机时玩家元信息 [{id, connected, ai}]，用于显示在线/掉线；离线模式不传则无徽标
  const statusMap = {};
  if (Array.isArray(meta)) for (const m of meta) if (m && m.id != null) statusMap[m.id] = m;
  state.players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (i === state.currentPlayer ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'p-name';
    const mInfo = statusMap[p.id];
    if (mInfo) {
      const badge = document.createElement('span');
      badge.className = 'p-status ' + (mInfo.connected ? 'online' : 'offline');
      badge.textContent = mInfo.connected ? '在线' : (mInfo.ai ? '掉线·AI托管' : '掉线');
      name.appendChild(badge);
    }
    const nameText = document.createElement('span');
    nameText.textContent = p.name;
    name.appendChild(nameText);
    const stats = document.createElement('div');
    stats.className = 'p-stats';
    const score = document.createElement('div');
    score.className = 'p-score';
    score.innerHTML = `<span class="score-label">分</span>${getRawScore(state, i)}`;
    const hooks = document.createElement('div');
    hooks.className = 'p-hooks';
    hooks.innerHTML = `${getHooks(state, i)}<span class="hook-icon">⚓</span>`;
    stats.appendChild(score);
    stats.appendChild(hooks);
    chip.appendChild(name);
    chip.appendChild(stats);
    if (p.snowGuard) {
      const imm = document.createElement('div');
      imm.className = 'p-foul';
      imm.textContent = '🛡 雪鳗护体';
      chip.appendChild(imm);
    }
    el.appendChild(chip);
  });
}

/**
 * 渲染 6 个浅滩堆。
 * ui 字段：shoalClickable(i)、shoalSelected(i)、shoalSelectCount、throwTargets、peekTargets
 */
export function renderShoals(el, state, ui, handlers) {
  el.innerHTML = '';
  state.shoals.forEach((shoal, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'shoal' + (shoal.length === 0 ? ' empty' : '');
    if (ui.throwTargets?.includes(i) || ui.peekTargets?.includes(i) || ui.aimShoals?.includes(i)) wrap.classList.add('highlight');

    const stack = document.createElement('div');
    stack.className = 'shoal-stack';
    const clickable = (ui.shoalClickable?.(i) ?? false) && ui.canInteract !== false;
    if (shoal.length === 0) {
      // 空浅滩没有卡背可点，需让整个空堆可点（否则放回到空浅滩时点不动=卡死）
      if (clickable && handlers.onShoalClick) {
        stack.classList.add('selectable');
        const hint = document.createElement('div');
        hint.className = 'shoal-drop-hint';
        hint.textContent = '放回';
        stack.appendChild(hint);
        stack.addEventListener('click', () => handlers.onShoalClick(i));
      } else {
        stack.textContent = '空';
      }
    } else {
      const show = Math.min(shoal.length, 3);
      // 注意：shoal[0] 是顶牌（stateMachine 用 shift 抽走 shoal[0]）。
      // 堆叠渲染必须倒序 append（从底到顶），让 shoal[0] 位于视觉最上层，
      // 否则玩家看到的"顶牌卡背"其实是栈底的鱼，与实际抽到的牌完全错位。
      for (let k = show - 1; k >= 0; k--) {
        const back = document.createElement('div');
        back.className = 'card-back';
        // 卡背显示该卡难度的模糊区间（如难度 4 → "3-5"）
        const range = document.createElement('div');
        range.className = 'cb-range';
        range.textContent = difficultyRange(CARD_BY_ID[shoal[k]].strength);
        range.title = `鱼群难度区间（低难度鱼 0 / 1-2，高难度鱼 3-5）`;
        back.appendChild(range);
        if (clickable) back.classList.add('selectable');
        if (ui.shoalSelected?.(i)) back.classList.add('selected');
        back.dataset.shoal = i;
        if (clickable && handlers.onShoalClick) {
          back.addEventListener('click', () => handlers.onShoalClick(i));
        }
        stack.appendChild(back);
      }
      // 凯尔派揭示：将顶牌翻面公示（覆盖在顶牌上方，不插进卡背序列以免破坏 nth-child 层序）
      if (state.revealedTops && Array.isArray(state.revealedTops.shoalIndexes) &&
          state.revealedTops.shoalIndexes.includes(i)) {
        const reveal = document.createElement('div');
        reveal.className = 'shoal-reveal';
        // 与该位置顶牌卡背同框对齐：顶牌偏移 (show-1)*5px 纵向 / (show-1)*4px 横向
        reveal.style.top = `${(show - 1) * 5}px`;
        reveal.style.left = `${(show - 1) * 4}px`;
        const front = buildCardFront(CARD_BY_ID[shoal[0]], { data: { shoal: i, cardIndex: 0 } });
        front.classList.add('revealed');
        if (clickable) front.classList.add('selectable');
        if (ui.shoalSelected?.(i)) front.classList.add('selected');
        if (clickable && handlers.onShoalClick) {
          front.addEventListener('click', () => handlers.onShoalClick(i));
        }
        reveal.appendChild(front);
        const badge = document.createElement('div');
        badge.className = 'shoal-reveal-badge';
        badge.textContent = '公示';
        reveal.appendChild(badge);
        stack.appendChild(reveal);
      }
    }
    wrap.appendChild(stack);

    const label = document.createElement('div');
    label.className = 'shoal-label';
    label.textContent = `浅滩${i + 1}`;
    wrap.appendChild(label);

    const count = document.createElement('div');
    count.className = 'shoal-count';
    count.textContent = `${shoal.length} 张`;
    wrap.appendChild(count);

    const selCount = ui.shoalSelectCount?.[i] || 0;
    if (selCount > 0) {
      const badge = document.createElement('div');
      badge.className = 'shoal-badge';
      badge.textContent = selCount;
      wrap.appendChild(badge);
    }

    el.appendChild(wrap);
  });
}

/**
 * 渲染抽出牌区（含钓走/放回按钮；观战模式 spectate 隐藏按钮）。
 * ui 字段：drawnHint、mustCatchFirst
 */
export function renderDrawn(el, state, ui, handlers, { spectate = false } = {}) {
  const hintEl = el.querySelector('#daHint');
  const cardsEl = el.querySelector('#drawnCards');
  cardsEl.innerHTML = '';
  if (state.drawn.length === 0) {
    hintEl.textContent = ui.drawnHint || '尚未抽牌';
  } else {
    hintEl.textContent = ui.drawnHint || '';
    state.drawn.forEach((cardId, idx) => {
      const card = CARD_BY_ID[cardId];
      const slot = document.createElement('div');
      slot.className = 'drawn-card-slot';

      const front = buildCardFront(card, { size: 'lg', data: { cardId, drawnIdx: idx } });
      front.addEventListener('click', () => handlers.onCardInfo?.(cardId));
      slot.appendChild(front);

      if (!spectate) {
        const actions = document.createElement('div');
        actions.className = 'dc-actions';

        const canAct = ui.canInteract !== false;
        const btnCatch = document.createElement('button');
        btnCatch.className = 'btn btn-sm btn-primary';
        btnCatch.textContent = '钓走';
        btnCatch.disabled = !canAct || !handlers.canCatch(cardId);
        btnCatch.addEventListener('click', () => handlers.onCatch(cardId));
        actions.appendChild(btnCatch);

        const btnThrow = document.createElement('button');
        btnThrow.className = 'btn btn-sm';
        btnThrow.textContent = '放回';
        btnThrow.disabled = !canAct || !!ui.mustCatchFirst;
        btnThrow.addEventListener('click', () => handlers.onThrowClick(cardId));
        actions.appendChild(btnThrow);

        slot.appendChild(actions);
      }
      cardsEl.appendChild(slot);
    });
  }

  // 阶段性上下文字段按钮：跳过能力阶段 / 确认抽牌 / 清空重选 / 取消放回
  renderDrawnContext(el, state, ui, handlers, spectate);
}

/**
 * 阶段性上下文按钮行：统一放在抽出牌卡片下方（与"跳过能力阶段"同一位置），
 * 让"跳过能力阶段 / 确认抽牌 / 清空重选 / 取消放回"布局一致、移动端更好点中。
 */
function renderDrawnContext(el, state, ui, handlers, spectate) {
  const prev = el.querySelector('.dc-ctx');
  if (prev) prev.remove();
  if (spectate) return;
  const canAct = ui.canInteract !== false;
  const row = document.createElement('div');
  row.className = 'dc-ctx';
  const add = (text, className, disabled, onClick) => {
    if (!onClick) return;
    const b = document.createElement('button');
    b.className = `btn btn-sm ${className}`.trim();
    b.textContent = text;
    b.disabled = disabled || !canAct;
    b.addEventListener('click', onClick);
    row.appendChild(b);
  };

  switch (state.phase) {
    case PHASE.ABILITY:
      add('跳过能力阶段（不发动）', 'btn-ghost dc-skip', false, () => handlers.onPassAbilities?.());
      if (ui.peekCanConfirm) add('确认查看', 'btn-primary', false, () => handlers.onConfirmPeek?.());
      if (ui.aim?.mode === 'shoalPeek') add('取消查看', 'btn-ghost', false, () => handlers.onCancelAim?.());
      break;
    case PHASE.DRAW:
      add('确认抽牌', 'btn-primary', !ui.drawCanConfirm, () => handlers.onConfirmDraw?.());
      if (ui.drawSelectedTotal > 0) add('清空重选', 'btn-ghost', false, () => handlers.onClearDraw?.());
      break;
    case PHASE.CATCH:
      add('取消放回', 'btn-ghost', !ui.throwCardId, () => handlers.onCancelThrow?.());
      break;
    default:
      break;
  }
  if (row.childElementCount > 0) el.appendChild(row);
}

/**
 * 渲染操作区（阶段上下文按钮）。
 * 说明：阶段按钮（跳过/确认/清空/取消放回）已统一移至抽出牌区下方（renderDrawn 的 .dc-ctx），
 * 此处不再重复生成按钮，仅保留占位（清空）。
 */
export function renderActionBar(el) {
  el.innerHTML = '';
}

/**
 * 渲染玩家钓获区。
 * ui 字段：fishClickable(playerIndex, cardId)
 */
export function renderCaught(el, state, ui, handlers) {
  el.innerHTML = '';
  state.players.forEach((p, i) => {
    const panel = document.createElement('div');
    panel.className = 'caught-panel';
    const head = document.createElement('div');
    head.className = 'cp-head';
    const name = document.createElement('div');
    name.className = 'cp-name';
    name.textContent = p.name + (i === state.currentPlayer ? '（当前）' : '');
    const meta = document.createElement('div');
    meta.className = 'cp-meta';
    meta.innerHTML = `<span class="cp-score">${getRawScore(state, i)} 分</span><span class="cp-hooks">${getHooks(state, i)}⚓ 钩</span>`;
    head.appendChild(name);
    head.appendChild(meta);
    panel.appendChild(head);

    const cards = document.createElement('div');
    cards.className = 'cp-cards';
    p.caught.forEach((cardId) => {
      const card = CARD_BY_ID[cardId];
      const exhausted = p.exhausted.includes(cardId);
      const clickable = (ui.fishClickable?.(i, cardId) ?? false) && ui.canInteract !== false;
      const front = buildCardFront(card, { selectable: clickable, exhausted, data: { player: i, cardId } });
      // 所有已钓的鱼都可点击查看详情（含无能力鱼、已横置的能力鱼）；
      // 能力阶段选择目标时，onFishClick 会优先当作目标选择而非打开详情。
      if (handlers.onFishClick) {
        front.addEventListener('click', () => handlers.onFishClick(i, cardId));
      }
      cards.appendChild(front);
    });
    panel.appendChild(cards);
    el.appendChild(panel);
  });
}

export function renderStatus(el, state, ui) {
  el.textContent = ui.statusText || '';
}

/** 渲染结算页 */
export function renderResult(el, state) {
  const results = getResults(state);
  const winners = getWinners(state);
  document.getElementById('resultSubtitle').textContent =
    winners.length > 1 ? '平局！' : `胜者：${state.players[winners[0]].name}`;
  const grid = document.getElementById('resultGrid');
  grid.innerHTML = '';
  results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'result-card' + (winners.includes(r.playerIndex) ? ' winner' : '');
    const head = document.createElement('div');
    head.className = 'rc-head';
    const name = document.createElement('div');
    name.className = 'rc-name';
    name.textContent = r.name;
    const score = document.createElement('div');
    score.className = 'rc-score';
    score.textContent = r.score;
    head.appendChild(name);
    head.appendChild(score);
    card.appendChild(head);

    const caught = document.createElement('div');
    caught.className = 'rc-caught';
    r.caught.forEach((c) => {
      const mini = document.createElement('div');
      mini.className = 'mini-card';
      mini.style.backgroundImage = `url("${artUrl(c)}")`;
      const pts = document.createElement('div');
      pts.className = 'mini-pts';
      pts.textContent = c.points;
      mini.appendChild(pts);
      caught.appendChild(mini);
    });
    card.appendChild(caught);

    const meta = document.createElement('div');
    meta.className = 'rc-meta';
    meta.textContent = `钓获 ${r.caught.length} 条 · 污秽 ${r.foulCount} 条${r.foulCount > 0 ? '（-2 分）' : ''}`;
    card.appendChild(meta);

    grid.appendChild(card);
  });
}
