/**
 * M5 Solo 界面：脚本对手信息、特色目标进度、脚本意图提示与行动日志、回合调度与结算。
 * 复用 #game 对局页渲染棋盘；Solo 面板（#soloPanel）内嵌于对局页。
 * 玩家回合走 boardInteraction 交互；脚本回合由定时器串行推进（仅展示节奏，不改对局结果）。
 */
import { SoloController } from '../solo/soloFlow.js';
import { chooseScriptAction, SCRIPT_NAME, TARGETS } from '../solo/soloScript.js';
import { CARD_BY_ID } from '../core/cards.js';
import { ABILITY_DESCRIPTIONS } from '../core/abilities.js';
import { PHASE } from '../core/stateMachine.js';
import { canCatch } from '../core/rules.js';
import { getDrawInteraction, getCatchInteraction, buildBoardUi } from './interaction.js';
import { createBoardInteraction } from './boardInteraction.js';
import { getArtUrl } from '../data/artPrompts.js';
import * as render from './render.js';
import * as modal from './modal.js';
import { showScreen } from './screens.js';

const $ = (id) => document.getElementById(id);

const SCRIPT_STEP_MS = 700; // 脚本每步展示间隔（仅节奏，不影响结果）
const PHASE_NAMES = { ability: '能力阶段', draw: '抽牌阶段', catch: '钓走/放回', gameOver: '对局结束' };

/** 特色目标清单（与 soloFlow.getLiveGoals 的 key 对应，见 RULES.md 11.6） */
const GOAL_ITEMS = [
  { key: 'beatScript', label: '总分高于脚本对手' },
  { key: 'caughtKraken', label: '钓到克拉肯' },
  { key: 'noFoul', label: '全程未钓到污秽鱼' },
  { key: 'grabbedTargets', label: '抢到至少 3 张目标卡' },
];

let controller = null;
let lastConfig = null;
let scriptTimer = null;
let interaction = null;
let uiState = { selectedShoals: [], throwCardId: null, abilityCardId: null, swapStep: null, swapOwn: null };

export function isSolo() {
  return !!controller;
}

/** 测试钩子：暴露当前 SoloController（仅测试用） */
export function __getController() {
  return controller;
}

/** 停止 Solo 并还原对局页默认 UI */
export function stopSolo() {
  clearTimeout(scriptTimer);
  controller = null;
  interaction = null;
  $('soloPanel').style.display = 'none';
  $('soloResult').style.display = 'none';
  $('actionBar').style.display = '';
  $('statusLine').style.display = '';
  $('btnCoverToggle').style.display = '';
  $('gameTitle').textContent = '浅滩鱼悔';
}

/** 开始 Solo 挑战：创建控制器、绑定交互、渲染棋盘与面板；脚本先手则自动行动 */
export function startSolo(config) {
  stopSolo();
  lastConfig = config;
  controller = new SoloController(config);
  controller.onUpdate = renderAll;
  controller.onGameOver = onGameOver;
  uiState = { selectedShoals: [], throwCardId: null, abilityCardId: null, swapStep: null, swapOwn: null };
  interaction = createBoardInteraction({
    getState: () => controller.state,
    getUi: () => uiState,
    dispatch: (action) => {
      const err = controller.dispatch(action);
      if (err) {
        modal.showToast(err, 'error');
        return false;
      }
      // 玩家动作若结束了玩家回合（如钓走/放回最后一张），立即调度脚本回合
      if (controller.isScriptTurn()) runScript();
      return true;
    },
    renderAll,
  });

  $('gameTitle').textContent = 'Solo 挑战 · 渔夫与青蛙';
  $('btnCoverToggle').style.display = 'none';
  $('actionBar').style.display = '';
  $('statusLine').style.display = '';
  $('soloPanel').style.display = '';
  $('soloLog').innerHTML = '';
  $('soloResult').style.display = 'none';
  setIntent('等待你的行动…');

  renderTargets();
  showScreen('game');
  renderAll();
  if (!controller.isPlayerTurn()) runScript();
}

/** 以相同配置重开一局（结算页"再来一局"） */
export function restart() {
  if (lastConfig) startSolo(lastConfig);
}

/* ===== 渲染 ===== */
function getUi() {
  return buildBoardUi(controller.state, uiState, {
    canInteract: controller.isPlayerTurn(),
    statusText: getStatusText(),
  });
}

function getStatusText() {
  const s = controller.state;
  const ui = uiState;
  switch (s.phase) {
    case PHASE.ABILITY:
      if (ui.abilityCardId) {
        const ability = CARD_BY_ID[ui.abilityCardId].ability;
        if (ability === 'peek_shoal') return '点击一个浅滩偷看其顶牌';
        if (ability === 'force_exhaust') return '点击对方的一条鱼强制横置';
        if (ability === 'swap_fish') return ui.swapStep === 'own' ? '点击你要交换出去的一条鱼' : '点击对方的一条鱼进行交换';
      }
      return '可点击已钓的能力鱼发动能力，或跳过';
    case PHASE.DRAW:
      return getDrawInteraction(s, ui).hint;
    case PHASE.CATCH:
      return getCatchInteraction(s).hint;
    default:
      return '';
  }
}

function renderAll() {
  if (!controller) return;
  const s = controller.state;
  const ui = getUi();
  render.renderTurnInfo($('turnInfo'), s);
  render.renderPlayersBar($('playersBar'), s);
  render.renderShoals($('shoalsRow'), s, ui, { onShoalClick: interaction.onShoalClick });
  render.renderDrawn($('drawnArea'), s, ui, {
    canCatch: (cardId) => canCatch(s, s.currentPlayer, cardId) && !s.caughtThisTurn,
    onCatch: interaction.onCatch,
    onThrowClick: interaction.onThrowClick,
    onPassAbilities: interaction.onPassAbilities,
    onConfirmDraw: interaction.onConfirmDraw,
    onClearDraw: interaction.onClearDraw,
    onCancelThrow: interaction.onCancelThrow,
    onCardInfo: (cardId) => interaction.showCardDetail?.(cardId),
  });
  render.renderCaught($('playersCaught'), s, ui, { onFishClick: interaction.onFishClick });
  render.renderActionBar($('actionBar'), s, ui, {
    onPassAbilities: interaction.onPassAbilities,
    onConfirmDraw: interaction.onConfirmDraw,
    onCancelThrow: interaction.onCancelThrow,
  });
  render.renderStatus($('statusLine'), s, ui);
  renderGoals();
}

/** 渲染脚本对手的 6 张固定目标卡（对手信息） */
function renderTargets() {
  const el = $('soloTargets');
  el.innerHTML = '';
  TARGETS.forEach((id) => {
    const c = CARD_BY_ID[id];
    const mini = document.createElement('div');
    mini.className = 'solo-target';
    mini.title = `${c.name}（${c.points} 分，需 ${c.strength} 钩）`;
    const img = document.createElement('img');
    img.src = getArtUrl(c.art);
    img.alt = c.name;
    img.addEventListener('error', () => img.remove(), { once: true });
    mini.appendChild(img);
    const pts = document.createElement('div');
    pts.className = 'solo-target-pts';
    pts.textContent = c.points;
    mini.appendChild(pts);
    el.appendChild(mini);
  });
}

/** 渲染特色目标实时进度（三态：进行中 ○ / 已失败 ✗ / 已达成 ✓） */
function renderGoals() {
  const el = $('soloGoals');
  const goals = controller.getLiveGoals();
  el.innerHTML = '';
  GOAL_ITEMS.forEach(({ key, label }) => {
    const g = goals[key];
    const state = g.done ? 'done' : g.status === 'failed' ? 'failed' : 'progress';
    const item = document.createElement('div');
    item.className = `solo-goal ${state}`;
    const mark = document.createElement('span');
    mark.className = 'solo-goal-mark';
    mark.textContent = state === 'done' ? '✓' : state === 'failed' ? '✗' : '○';
    const text = document.createElement('span');
    text.className = 'solo-goal-text';
    text.textContent = label;
    const val = document.createElement('span');
    val.className = 'solo-goal-val';
    val.textContent = g.text;
    item.append(mark, text, val);
    el.appendChild(item);
  });
}

/* ===== 脚本回合调度 ===== */
function runScript() {
  clearTimeout(scriptTimer);
  if (!controller || !controller.isScriptTurn()) return;
  const action = chooseScriptAction(controller.state);
  if (!action) return;
  const { desc, reason } = describeScriptAction(action);
  setIntent(`${desc}（${reason}）`);
  scriptTimer = setTimeout(() => {
    if (!controller || !controller.isScriptTurn()) return;
    controller.runScriptAction();
    appendScriptLog(action, desc, reason);
    renderAll();
    if (controller.isScriptTurn()) runScript();
  }, SCRIPT_STEP_MS);
}

/** 将脚本动作翻译为中文描述与理由（确定性剧本的可观测依据） */
function describeScriptAction(action) {
  switch (action.type) {
    case 'USE_ABILITY': {
      const c = CARD_BY_ID[action.cardId];
      return { desc: `发动「${c.name}」能力`, reason: ABILITY_DESCRIPTIONS[c.ability] || '固定顺序发动' };
    }
    case 'PASS_ABILITIES':
      return { desc: '跳过能力阶段', reason: '无可发动的能力鱼' };
    case 'DRAW':
      return { desc: `从浅滩 ${action.from.map((i) => i + 1).join('、')} 抽牌`, reason: '优先目标浅滩取牌' };
    case 'CATCH': {
      const c = CARD_BY_ID[action.cardId];
      return { desc: `钓走「${c.name}」`, reason: TARGETS.includes(action.cardId) ? '目标清单内，优先抢鱼' : '目标不可钓，钓最高分非污秽' };
    }
    case 'THROW_BACK': {
      const c = CARD_BY_ID[action.cardId];
      return { desc: `放回「${c.name}」`, reason: c.type === 'foul' ? '无可钓牌，先放回污秽' : '无可钓牌，全部放回' };
    }
    default:
      return { desc: '行动', reason: '' };
  }
}

function setIntent(text) {
  $('soloIntent').textContent = text;
}

/** 追加一条脚本行动日志 */
function appendScriptLog(action, desc, reason) {
  const logEl = $('soloLog');
  const item = document.createElement('div');
  item.className = 'sp-log-item';
  if (action.type === 'USE_ABILITY') item.classList.add('hl-ability');
  if (action.type === 'CATCH' && CARD_BY_ID[action.cardId]?.type === 'foul') item.classList.add('hl-foul');

  const head = document.createElement('div');
  head.className = 'sp-li-head';
  const turn = document.createElement('span');
  turn.className = 'sp-li-turn';
  turn.textContent = `回合${controller.state.turn}`;
  const who = document.createElement('span');
  who.className = 'sp-li-who';
  who.textContent = SCRIPT_NAME;
  const phase = document.createElement('span');
  phase.className = 'sp-li-phase';
  phase.textContent = PHASE_NAMES[controller.state.phase] || controller.state.phase;
  head.append(turn, who, phase);
  item.appendChild(head);

  const descEl = document.createElement('div');
  descEl.className = 'sp-li-desc';
  descEl.textContent = desc;
  item.appendChild(descEl);

  if (reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'sp-li-reason';
    reasonEl.textContent = reason;
    item.appendChild(reasonEl);
  }

  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}

/* ===== 结算 ===== */
function onGameOver() {
  render.renderResult($('result'), controller.state);
  renderSoloEvaluation();
  showScreen('result');
}

/** 渲染 Solo 结算评价：星级 + 等级 + 特色目标达成情况（见 RULES.md 11.6） */
function renderSoloEvaluation() {
  const el = $('soloResult');
  const ev = controller.getEvaluation();
  el.style.display = '';
  el.innerHTML = `
    <div class="solo-eval">
      <div class="solo-eval-head">
        <span class="solo-eval-rank">${ev.rank}</span>
        <span class="solo-eval-stars">${'★'.repeat(ev.stars)}${'☆'.repeat(4 - ev.stars)}</span>
      </div>
      <div class="solo-eval-goals">
        ${GOAL_ITEMS.map(({ key, label }) => {
          const done = ev.goals[key];
          return `<div class="solo-eval-goal${done ? ' done' : ''}"><span class="solo-eval-mark">${done ? '✓' : '✗'}</span>${label}</div>`;
        }).join('')}
      </div>
    </div>
  `;
}

/* ===== 设置弹窗 ===== */
export function openM5Setup() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-field"><label>你的名称</label><input type="text" id="m5Name" value="你" maxlength="8" /></div>
    <div class="setup-field">
      <label>先后手</label>
      <div class="setup-seg" id="m5First">
        <button type="button" data-first="player" class="seg-btn active">你先手</button>
        <button type="button" data-first="script" class="seg-btn">脚本先手</button>
      </div>
    </div>
    <div class="setup-hint">对手「${SCRIPT_NAME}」由 6 张固定卡牌构成，严格按剧本行动，无随机。</div>
  `;
  let first = 'player';
  body.querySelectorAll('#m5First .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      first = b.dataset.first;
      body.querySelectorAll('#m5First .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    });
  });
  modal.showModal({
    title: 'Solo 挑战 · 设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '开始挑战',
        className: 'btn-primary',
        onClick: () => {
          const playerName = body.querySelector('#m5Name').value.trim() || '你';
          startSolo({ playerName, seed: Math.floor(Math.random() * 1e9), first });
        },
      },
    ],
  });
}
