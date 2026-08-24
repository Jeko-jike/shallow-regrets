/**
 * M4 观战界面：AI 面板、速度/回合控制按钮、日志滚动区。
 * 绑定 SpectateController 与渲染层；仅负责 DOM，不含业务规则。
 * 复用 #game 对局页渲染棋盘，观战面板（#spectatePanel）内嵌于对局页。
 */
import { SpectateController } from '../spectate/spectate.js';
import { CARD_BY_ID } from '../core/cards.js';
import { TOTAL_CARDS } from '../core/gameState.js';
import { PHASE } from '../core/stateMachine.js';
import * as render from './render.js';
import * as modal from './modal.js';
import { showScreen } from './screens.js';

const $ = (id) => document.getElementById(id);

let controller = null;
let lastConfig = null;

const PHASE_NAMES = { ability: '能力阶段', draw: '抽牌阶段', catch: '钓走/放回', gameOver: '对局结束' };
const SPEED_NAMES = { slow: '慢速', medium: '中速', fast: '快速' };

/** 结算事件 → 中文标签（战斗反馈） */
const RESULT_LABELS = {
  ability_used: '能力发动',
  phase_draw: '进入抽牌',
  draw: '抽牌',
  catch: '钓走',
  throw_back: '放回',
  turn_end: '回合结束',
  game_over: '对局结束',
  draw_extra: '多抽1张',
  peek_shoal: '偷看',
  force_exhaust: '强制横置',
  swap_fish: '交换',
  shuffle_shoals: '洗牌',
  immunity: '免疫',
};

function resultLabels(events) {
  return (events || []).map((e) => RESULT_LABELS[e] || e);
}

function bindSeg(container, onPick) {
  container.querySelectorAll('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      container.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      onPick(b.dataset);
    });
  });
}

export function isSpectating() {
  return !!controller;
}

/** 停止观战并还原对局页默认 UI */
export function stopSpectate() {
  controller?.pause();
  controller = null;
  $('spectatePanel').style.display = 'none';
  $('actionBar').style.display = '';
  $('statusLine').style.display = '';
  $('btnCoverToggle').style.display = '';
  $('gameTitle').textContent = '浅滩鱼悔';
}

/** 开始观战：创建控制器、切换对局页为观战布局、绑定渲染与日志 */
export function startSpectate(config) {
  stopSpectate();
  lastConfig = config;
  controller = new SpectateController(config);
  controller.onUpdate = renderBoard;
  controller.onLog = appendLog;
  controller.onGameOver = onGameOver;

  $('gameTitle').textContent = 'AI 斗蛐蛐 · 观战';
  $('btnCoverToggle').style.display = 'none';
  $('actionBar').style.display = 'none';
  $('statusLine').style.display = 'none';
  $('spectatePanel').style.display = '';

  setModeUI(controller.mode);
  setSpeedUI(controller.speed);
  $('spLog').innerHTML = '';
  showScreen('game');
  renderBoard();
  if (controller.mode === 'auto') controller.start();
  updateStatus();
}

/** 以相同配置重开一局（结算页"再来一局"） */
export function restart() {
  if (lastConfig) startSpectate(lastConfig);
}

function setModeUI(mode) {
  $('spModeSeg').querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('spManualWrap').style.display = mode === 'manual' ? '' : 'none';
}

function setSpeedUI(speed) {
  $('spSpeedSeg').querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.speed === speed));
}

function updateStatus() {
  if (!controller) return;
  const modeName = controller.mode === 'auto' ? '自动' : '手动';
  const speedName = SPEED_NAMES[controller.speed] || controller.speed;
  const phaseName = PHASE_NAMES[controller.state.phase] || controller.state.phase;
  $('spStatus').textContent = `${modeName} · ${speedName} · ${phaseName}`;
}

/** 渲染棋盘（只读，无交互） */
function renderBoard() {
  const s = controller.state;
  const ui = {
    canInteract: false,
    phase: s.phase,
    shoalClickable: () => false,
    shoalSelected: () => false,
    shoalSelectCount: {},
    throwTargets: null,
    peekTargets: null,
    fishClickable: () => false,
    drawnHint: PHASE_NAMES[s.phase] || '',
    mustCatchFirst: false,
    throwCardId: null,
    statusText: '',
  };
  render.renderTurnInfo($('turnInfo'), s);
  render.renderPlayersBar($('playersBar'), s);
  render.renderShoals($('shoalsRow'), s, ui, {});
  render.renderDrawn($('drawnArea'), s, ui, {}, { spectate: true });
  render.renderCaught($('playersCaught'), s, ui, {});
  // 即将终局提示：剩余未钓牌 ≤ 4 时高亮回合信息
  const remaining = TOTAL_CARDS - s.players.reduce((sum, p) => sum + p.caught.length, 0);
  $('turnInfo').classList.toggle('near-end', remaining <= 4 && s.phase !== PHASE.GAME_OVER);
  updateStatus();
}

/** 追加一条战斗日志（关键节点高亮：能力发动 / 污秽鱼被钓 / 终局） */
function appendLog(entry) {
  const logEl = $('spLog');
  const item = document.createElement('div');
  item.className = 'sp-log-item';
  if (entry.action.type === 'USE_ABILITY') item.classList.add('hl-ability');
  if (entry.action.type === 'CATCH' && CARD_BY_ID[entry.action.cardId]?.type === 'foul') item.classList.add('hl-foul');
  if ((entry.result || []).includes('game_over')) item.classList.add('hl-over');

  const head = document.createElement('div');
  head.className = 'sp-li-head';
  const turn = document.createElement('span');
  turn.className = 'sp-li-turn';
  turn.textContent = `回合${entry.turn}`;
  const who = document.createElement('span');
  who.className = 'sp-li-who';
  who.textContent = controller.state.players[entry.playerIndex]?.name || `玩家${entry.playerIndex + 1}`;
  const phase = document.createElement('span');
  phase.className = 'sp-li-phase';
  phase.textContent = PHASE_NAMES[entry.phase] || entry.phase;
  head.append(turn, who, phase);
  item.appendChild(head);

  const desc = document.createElement('div');
  desc.className = 'sp-li-desc';
  desc.textContent = entry.description;
  item.appendChild(desc);

  if (entry.reason) {
    const reason = document.createElement('div');
    reason.className = 'sp-li-reason';
    reason.textContent = entry.reason;
    item.appendChild(reason);
  }

  const labels = resultLabels(entry.result);
  if (labels.length) {
    const tags = document.createElement('div');
    tags.className = 'sp-li-tags';
    labels.forEach((label) => {
      const tag = document.createElement('span');
      tag.className = 'sp-li-tag';
      tag.textContent = label;
      tags.appendChild(tag);
    });
    item.appendChild(tags);
  }

  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}

function onGameOver() {
  updateStatus();
  render.renderResult($('result'), controller.state);
  showScreen('result');
}

function exportReplay() {
  if (!controller) return;
  const json = controller.exportReplay();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shallow-regrets-m4-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  modal.showToast('回放已导出', 'success');
}

/** M4 设置弹窗：AI 数量/名称、初始模式、速度档位 */
export function openM4Setup() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-field">
      <label>AI 数量</label>
      <div class="setup-seg" id="m4Count">
        <button type="button" data-n="2" class="seg-btn active">2 个</button>
        <button type="button" data-n="3" class="seg-btn">3 个</button>
      </div>
    </div>
    <div class="setup-field"><label>AI 甲名称</label><input type="text" id="m4Name0" value="AI 甲" maxlength="8" /></div>
    <div class="setup-field"><label>AI 乙名称</label><input type="text" id="m4Name1" value="AI 乙" maxlength="8" /></div>
    <div class="setup-field" id="m4Name2Wrap" style="display:none"><label>AI 丙名称</label><input type="text" id="m4Name2" value="AI 丙" maxlength="8" /></div>
    <div class="setup-field">
      <label>初始模式</label>
      <div class="setup-seg" id="m4Mode">
        <button type="button" data-mode="auto" class="seg-btn active">自动进行</button>
        <button type="button" data-mode="manual" class="seg-btn">手动进行</button>
      </div>
    </div>
    <div class="setup-field">
      <label>速度档位</label>
      <div class="setup-seg" id="m4Speed">
        <button type="button" data-speed="slow" class="seg-btn">慢</button>
        <button type="button" data-speed="medium" class="seg-btn active">中</button>
        <button type="button" data-speed="fast" class="seg-btn">快</button>
      </div>
    </div>
  `;
  let count = 2;
  let mode = 'auto';
  let speed = 'medium';
  bindSeg(body.querySelector('#m4Count'), (d) => {
    count = Number(d.n);
    body.querySelector('#m4Name2Wrap').style.display = count === 3 ? '' : 'none';
  });
  bindSeg(body.querySelector('#m4Mode'), (d) => {
    mode = d.mode;
  });
  bindSeg(body.querySelector('#m4Speed'), (d) => {
    speed = d.speed;
  });
  modal.showModal({
    title: 'AI 斗蛐蛐 · 设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '开始观战',
        className: 'btn-primary',
        onClick: () => {
          const names = [
            body.querySelector('#m4Name0').value.trim() || 'AI 甲',
            body.querySelector('#m4Name1').value.trim() || 'AI 乙',
          ];
          if (count === 3) names.push(body.querySelector('#m4Name2').value.trim() || 'AI 丙');
          startSpectate({ names, seed: Math.floor(Math.random() * 1e9), mode, speed });
        },
      },
    ],
  });
}

/* ===== 静态控件绑定（模块加载一次） ===== */
bindSeg($('spModeSeg'), (d) => {
  if (!controller) return;
  controller.setMode(d.mode);
  setModeUI(d.mode);
  updateStatus();
});
bindSeg($('spSpeedSeg'), (d) => {
  if (!controller) return;
  controller.setSpeed(d.speed);
  updateStatus();
});
$('spNextTurn').addEventListener('click', () => {
  if (controller) controller.nextTurn();
});
$('spAutoN').addEventListener('click', () => {
  if (controller) controller.autoAdvanceTurns(5);
});
$('spFinish').addEventListener('click', () => {
  if (controller) controller.finishNow();
});
$('spExport').addEventListener('click', exportReplay);
