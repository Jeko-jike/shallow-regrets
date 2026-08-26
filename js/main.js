/**
 * 前端入口：初始化、模式路由、启动游戏。
 * 持有对局状态，派发动作，驱动渲染与交互。
 * 玩家交互统一走 ui/boardInteraction.js（能力瞄准 + 反应窗口弹窗）。
 */
import { createInitialState } from './core/gameState.js';
import { applyAction, ACTION, PHASE } from './core/stateMachine.js';
import { getWinners } from './core/scoring.js';
import { CARD_BY_ID } from './core/cards.js';
import { canCatch, getCatchLimit } from './core/rules.js';
import { logger, setLogLevel } from './utils/logger.js';
import { chooseAction } from './ai/heuristicAI.js';
import { SocketClient } from './net/socketClient.js';
import { MSG } from './net/protocol.js';
import * as render from './ui/render.js';
import * as anim from './ui/animations.js';
import * as modal from './ui/modal.js';
import * as inter from './ui/interaction.js';
import { createBoardInteraction } from './ui/boardInteraction.js';
import * as spectateUI from './ui/spectateUI.js';
import * as soloUI from './ui/soloUI.js';
import { showScreen } from './ui/screens.js';

const $ = (id) => document.getElementById(id);

const game = {
  state: null,
  mode: null,
  ai: [], // 每个玩家是否为 AI（M2）
  lastConfig: null,
  settings: { anim: true, cover: true },
  ui: {
    selectedShoals: [], // 抽牌阶段已选浅滩（含重复，表示同一浅滩抽 2 张）
    throwCardId: null, // 放回阶段正在选择目标浅滩的牌
    abilityCardId: null, // 正在选择目标的能力鱼
    aimShoals: [], // peek_multi 已选浅滩
    swapStep: null, // swap_* 步骤：'own' | 'opp'
    swapOwn: null, // swap_* 已选自己的鱼
  },
  interaction: null,
  aiTimer: null,
};

// M3 联机会话状态
const online = {
  client: null,
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [], // 房间/对局玩家元信息（含 ai/connected）
  inGame: false,
  myReady: false,
  myName: '',
  connected: false, // socket 传输层是否已连接
  connectTimer: null, // 进房等待超时定时器
};

const ONLINE_CONNECT_TIMEOUT = 6000;

setLogLevel('info');

/* ===== 对局控制器 ===== */
function startGame(config) {
  clearTimeout(game.aiTimer);
  game.lastConfig = config;
  game.mode = config.mode;
  game.settings.cover = config.cover ?? true;
  game.ai = config.aiFlags || config.names.map(() => false);
  game.state = createInitialState({ seed: config.seed, playerNames: config.names });
  game.ui = { selectedShoals: [], throwCardId: null, abilityCardId: null, aimShoals: [], swapStep: null, swapOwn: null };
  game.interaction = makeInteraction();
  $('soloResult').style.display = 'none';
  showScreen('game');
  renderAll();
  logger.info('game', 'start', { mode: config.mode, names: config.names, seed: config.seed });
  if (game.mode === 'm1' && game.settings.cover) {
    showTurnCover();
  } else {
    maybeRunAI();
  }
}

/** 用当前 game.ui/state 重建交互器（单局一次即可；闭包读取实时状态） */
function makeInteraction() {
  return createBoardInteraction({
    getState: () => game.state,
    getUi: () => game.ui,
    dispatch: (action) => dispatch(action),
    renderAll,
  });
}

function dispatch(action) {
  if (!game.state) return false;
  // M3 联机：动作交给服务端权威校验，本地不直接推进（等 STATE_SYNC）
  if (game.mode === 'm3') {
    online.client?.action(action);
    return true;
  }
  const res = applyAction(game.state, action);
  if (res.error) {
    modal.showToast(res.error, 'error');
    logger.warn('game', 'illegal_action', { action, error: res.error });
    return false;
  }
  game.state = res.state;
  logger.info('game', 'action', { action, phase: res.state.phase });
  handleEvents(res.events);
  renderAll();
  if (res.state.phase === PHASE.GAME_OVER) {
    showResult();
    return true;
  }
  if (res.state.phase === PHASE.PENDING && game.interaction) {
    game.interaction.showPendingResolution();
  }
  maybeRunAI();
  return true;
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev === 'turn_end' && game.mode === 'm1' && game.settings.cover && game.state.phase !== PHASE.GAME_OVER) {
      showTurnCover();
    }
  }
}

function maybeRunAI() {
  const s = game.state;
  if (!s || s.phase === PHASE.GAME_OVER || s.phase === PHASE.PENDING) return; // 反应窗口留给玩家，AI 不抢答
  if (game.mode === 'm3') return; // 联机 AI 托管由服务端驱动
  if (!game.ai[s.currentPlayer]) return;
  clearTimeout(game.aiTimer);
  game.aiTimer = setTimeout(() => {
    if (!game.state || game.state.phase === PHASE.GAME_OVER) return;
    const action = chooseAction(game.state);
    if (action) dispatch(action);
  }, 600);
}

function showTurnCover() {
  const s = game.state;
  const p = s.players[s.currentPlayer];
  $('tcTitle').textContent = `轮到 ${p.name}`;
  $('tcSub').textContent = `第 ${s.turn} 回合 · 请 ${p.name} 拿好设备，确认后开始`;
  $('turnCover').style.display = 'flex';
}

function showResult() {
  render.renderResult($('result'), game.state);
  showScreen('result');
  logger.info('game', 'game_over', { winners: getWinners(game.state) });
}

/* ===== 交互描述（供渲染层读取） ===== */
function getUi() {
  const s = game.state;
  // 联机模式：仅当前行动者（本地玩家）可交互
  const canInteract = game.mode !== 'm3' || s.currentPlayer === online.playerId;
  return inter.buildBoardUi(s, game.ui, { canInteract, statusText: getStatusText() });
}

function getStatusText() {
  const s = game.state;
  const ui = game.ui;
  switch (s.phase) {
    case PHASE.ABILITY:
      if (ui.abilityCardId) {
        const aim = inter.abilityAim(s, ui);
        if (aim?.mode === 'shoalPeek') return (ui.aimShoals?.length ?? 0) ? `已选 ${ui.aimShoals.length}/3 个，点击"确认查看"` : '点击 1-3 个浅滩查看其顶牌';
        if (aim?.mode === 'removeZero') return '点击浅滩的难度0顶牌，或对方已钓的难度0鱼';
        if (aim?.mode === 'shoal') return '点击要重排的鱼群';
        if (aim?.mode === 'swapOwn') return '点击你要交换出去的一条鱼';
        if (aim?.mode === 'swapOpp') return '点击对方的一条鱼进行交换';
        if (aim?.mode === 'player') return '点击对方的一位玩家（把断脚交给他）';
        if (aim?.mode === 'oppFish') return '点击对方的一条鱼';
      }
      return '可点击已钓的能力鱼发动能力，或跳过';
    case PHASE.DRAW:
      return inter.getDrawInteraction(s, ui).hint;
    case PHASE.CATCH:
      return inter.getCatchInteraction(s).hint;
    case PHASE.PENDING:
      return '待决策：请查看弹窗并选择';
    default:
      return '';
  }
}

function renderAll() {
  const s = game.state;
  if (!s) return;
  const ui = getUi();
  const I = game.interaction;
  render.renderTurnInfo($('turnInfo'), s);
  render.renderPlayersBar($('playersBar'), s, game.mode === 'm3' ? online.players : undefined);
  render.renderShoals($('shoalsRow'), s, ui, { onShoalClick: I.onShoalClick });
  render.renderDrawn($('drawnArea'), s, ui, {
    canCatch: (cardId) => canCatch(s, s.currentPlayer, cardId) && s.caughtThisTurn < getCatchLimit(s),
    onCatch: I.onCatch,
    onThrowClick: I.onThrowClick,
    onPassAbilities: I.onPassAbilities,
    onConfirmDraw: I.onConfirmDraw,
    onClearDraw: I.onClearDraw,
    onCancelThrow: I.onCancelThrow,
    onConfirmPeek: I.onConfirmPeek,
    onCancelAim: I.onCancelAim,
    onCardInfo: (cardId) => I.showCardDetail(s.currentPlayer, cardId),
  });
  render.renderCaught($('playersCaught'), s, ui, { onFishClick: I.onFishClick });
  render.renderActionBar($('actionBar'), s, ui, {
    onPassAbilities: I.onPassAbilities,
    onConfirmDraw: I.onConfirmDraw,
    onCancelThrow: I.onCancelThrow,
  });
  render.renderStatus($('statusLine'), s, ui);
}

/* ===== M3 联机对战 ===== */
function openM3Setup() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-seg" id="m3Tab">
      <button type="button" data-tab="create" class="seg-btn active">创建房间</button>
      <button type="button" data-tab="join" class="seg-btn">加入房间</button>
    </div>
    <div class="setup-field"><label>你的昵称</label><input type="text" id="m3Name" value="${online.myName || '玩家'}" maxlength="8" /></div>
    <div class="setup-field" id="m3CodeWrap" style="display:none"><label>房间码</label><input type="text" id="m3Code" placeholder="4 位字母/数字" maxlength="4" style="text-transform:uppercase" /></div>
    <div class="setup-hint" id="m3Hint">创建房间后，把房间码发给好友加入</div>
  `;
  let tab = 'create';
  body.querySelectorAll('#m3Tab .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      body.querySelectorAll('#m3Tab .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      body.querySelector('#m3CodeWrap').style.display = tab === 'join' ? '' : 'none';
      body.querySelector('#m3Hint').textContent =
        tab === 'create' ? '创建房间后，把房间码发给好友加入' : '输入好友分享的房间码加入对局';
    });
  });
  modal.showModal({
    title: '联机对战 · 设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '进入房间',
        className: 'btn-primary',
        onClick: () => {
          const name = body.querySelector('#m3Name').value.trim() || '玩家';
          const code = (body.querySelector('#m3Code').value || '').trim().toUpperCase();
          if (tab === 'join' && !/^[A-Z0-9]{4}$/.test(code)) {
            modal.showToast('请输入 4 位房间码', 'error');
            return;
          }
          online.myName = name;
          openLobbyWaiting();
          connectOnline();
          if (tab === 'create') online.client.create(name);
          else online.client.join(code, name);
        },
      },
    ],
  });
}

function openLobbyWaiting() {
  // 点击"进入房间"立即展示等待大厅：连接中、房间码占位，待服务器回包后回填
  clearTimeout(online.connectTimer);
  online.inGame = false;
  online.roomCode = null;
  online.playerId = null;
  online.isHost = false;
  online.myReady = false;
  online.connected = false;
  online.players = [];
  $('lobbyCode').textContent = '----';
  $('lobbyConn').textContent = '连接中…';
  $('lobbyConn').className = 'lobby-conn';
  $('lobbyPlayers').innerHTML = '';
  $('lobbyHint').textContent = '正在连接服务器，请稍候…';
  $('btnReady').disabled = true;
  $('btnStart').style.display = 'none';
  showScreen('lobby');
}

function connectOnline() {
  if (online.client) return;
  const client = new SocketClient();
  online.client = client;

  const clearConnectTimer = () => clearTimeout(online.connectTimer);
  client.connect({
    onConnect: () => {
      online.connected = true;
      $('lobbyConn').textContent = '已连接';
      $('lobbyConn').className = 'lobby-conn online';
    },
    onDisconnect: () => {
      online.connected = false;
      $('lobbyConn').textContent = '连接断开';
      $('lobbyConn').className = 'lobby-conn offline';
      if (!online.inGame) clearConnectTimer();
    },
  });

  // 进房等待超时：连接不上（如用 file:// 双击离线版打开、或服务器未启动）时给明确提示
  online.connectTimer = setTimeout(() => {
    if (online.inGame || online.roomCode != null) return;
    online.client?.disconnect();
    $('lobbyConn').textContent = '连接超时';
    $('lobbyConn').className = 'lobby-conn offline';
    $('lobbyHint').textContent = '无法连接服务器，请用「一键启动联网游戏.bat」打开游戏后再进联机';
    modal.showToast('无法连接服务器，请用「一键启动联网游戏.bat」启动后重试', 'error');
  }, ONLINE_CONNECT_TIMEOUT);

  client.on(MSG.JOINED, (payload) => {
    clearConnectTimer();
    online.roomCode = payload.roomCode;
    online.playerId = payload.playerId;
    online.isHost = payload.isHost;
    online.inGame = false;
    online.myReady = false;
    renderLobby(payload.room);
    showScreen('lobby');
  });

  client.on(MSG.ROOM_UPDATE, (room) => {
    if (online.inGame) return; // 对局中大厅信息不覆盖对局视图
    renderLobby(room);
  });

  client.on(MSG.JOIN_ERROR, (payload) => {
    clearTimeout(online.connectTimer);
    modal.showToast(payload.message || '加入失败', 'error');
  });

  client.on(MSG.GAME_START, (payload) => {
    online.inGame = true;
    startOnlineGame(payload.state, payload.players);
  });

  client.on(MSG.STATE_SYNC, (payload) => {
    if (!game.state || game.mode !== 'm3') return;
    game.state = payload.state;
    online.players = payload.players || [];
    renderAll();
  });

  client.on(MSG.PEEK_RESULT, (payload) => {
    const c = CARD_BY_ID[payload.cardId];
    if (!c) return;
    modal.showModal({
      title: '偷看结果',
      body: `<p>浅滩${payload.shoalIndex + 1} 的顶牌是：<strong>「${c.name}」</strong>（${c.points} 分，需 ${c.strength} 钩）</p>`,
      actions: [{ text: '知道了' }],
    });
  });

  client.on(MSG.ACTION_REJECTED, (payload) => {
    modal.showToast(payload.error || '操作被拒绝', 'error');
    renderAll();
  });

  client.on(MSG.PLAYER_LEFT, (payload) => {
    modal.showToast(payload.message || '有玩家掉线', 'info');
  });

  client.on(MSG.GAME_OVER, () => {
    if (game.state) showResult();
  });

  client.on(MSG.RECONNECT, (payload) => {
    game.state = payload.state;
    renderAll();
  });

  client.on(MSG.ERROR, (payload) => {
    modal.showToast(payload.message || '出错了', 'error');
  });
}

function renderLobby(room) {
  $('lobbyCode').textContent = room.code;
  const list = $('lobbyPlayers');
  list.innerHTML = '';
  room.players.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'lobby-player';
    const name = document.createElement('div');
    name.className = 'lp-name';
    name.textContent = p.name + (p.id === online.playerId ? '（你）' : '');
    row.appendChild(name);
    if (p.id === room.hostId) {
      const tag = document.createElement('span');
      tag.className = 'lp-tag host';
      tag.textContent = '房主';
      row.appendChild(tag);
    }
    if (p.ready) {
      const tag = document.createElement('span');
      tag.className = 'lp-tag ready';
      tag.textContent = '已准备';
      row.appendChild(tag);
    }
    if (p.connected) {
      const tag = document.createElement('span');
      tag.className = 'lp-tag online';
      tag.textContent = '在线';
      row.appendChild(tag);
    }
    if (!p.connected) {
      const tag = document.createElement('span');
      tag.className = 'lp-tag offline';
      tag.textContent = '离线';
      row.appendChild(tag);
    }
    if (online.isHost && p.id !== online.playerId) {
      const kick = document.createElement('button');
      kick.className = 'btn btn-sm lp-kick';
      kick.textContent = '踢出';
      kick.addEventListener('click', () => online.client.kick(p.id));
      row.appendChild(kick);
    }
    list.appendChild(row);
  });

  const me = room.players.find((p) => p.id === online.playerId);
  online.myReady = !!me?.ready;
  $('btnReady').disabled = false;
  $('btnReady').textContent = online.myReady ? '取消准备' : '准备';
  $('btnReady').classList.toggle('btn-primary', !online.myReady);
  $('btnReady').classList.toggle('btn-ghost', online.myReady);
  $('btnStart').style.display = online.isHost ? '' : 'none';
  $('btnStart').disabled = !room.players.every((p) => p.ready) || room.players.length < 2;
  $('lobbyHint').textContent = online.isHost
    ? '等待所有玩家准备后即可开始对局'
    : '点击「准备」，等待房主开始对局';
}

function startOnlineGame(state, players) {
  clearTimeout(game.aiTimer);
  game.mode = 'm3';
  game.ai = [];
  game.state = state;
  game.ui = { selectedShoals: [], throwCardId: null, abilityCardId: null, aimShoals: [], swapStep: null, swapOwn: null };
  game.interaction = makeInteraction();
  online.players = players || [];
  // 联机模式隐藏热座遮挡按钮
  $('btnCoverToggle').style.display = 'none';
  showScreen('game');
  renderAll();
}

function leaveOnline() {
  online.client?.leave();
  online.client?.disconnect();
  online.client = null;
  online.roomCode = null;
  online.playerId = null;
  online.isHost = false;
  online.players = [];
  online.inGame = false;
  online.myReady = false;
  game.state = null;
  game.mode = null;
  $('btnCoverToggle').style.display = '';
  showScreen('home');
}

/* ===== 首页 ===== */
function openM1Setup() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-field">
      <label>玩家人数</label>
      <div class="setup-seg" id="m1Count">
        <button type="button" data-n="2" class="seg-btn active">2 人</button>
        <button type="button" data-n="3" class="seg-btn">3 人</button>
      </div>
    </div>
    <div class="setup-field"><label>玩家 1 名称</label><input type="text" id="m1Name0" value="玩家1" maxlength="8" /></div>
    <div class="setup-field"><label>玩家 2 名称</label><input type="text" id="m1Name1" value="玩家2" maxlength="8" /></div>
    <div class="setup-field" id="m1Name2Wrap" style="display:none"><label>玩家 3 名称</label><input type="text" id="m1Name2" value="玩家3" maxlength="8" /></div>
    <div class="setup-field"><label class="check"><input type="checkbox" id="m1Cover" checked /> 开启遮挡切换（防作弊）</label></div>
  `;
  let count = 2;
  body.querySelectorAll('#m1Count .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      count = Number(b.dataset.n);
      body.querySelectorAll('#m1Count .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      body.querySelector('#m1Name2Wrap').style.display = count === 3 ? '' : 'none';
    });
  });
  modal.showModal({
    title: '本地对战 · 设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '开始对局',
        className: 'btn-primary',
        onClick: () => {
          const names = [
            body.querySelector('#m1Name0').value.trim() || '玩家1',
            body.querySelector('#m1Name1').value.trim() || '玩家2',
          ];
          if (count === 3) names.push(body.querySelector('#m1Name2').value.trim() || '玩家3');
          startGame({
            mode: 'm1',
            names,
            seed: Math.floor(Math.random() * 1e9),
            cover: body.querySelector('#m1Cover').checked,
            aiFlags: names.map(() => false),
          });
        },
      },
    ],
  });
}

function openM2Setup() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-field"><label>你的名称</label><input type="text" id="m2Name" value="你" maxlength="8" /></div>
    <div class="setup-field"><label class="check"><input type="checkbox" id="m2First" checked /> 你先手</label></div>
    <div class="setup-field"><label>对手 AI</label><input type="text" id="m2AiName" value="AI 渔夫" maxlength="8" /></div>
  `;
  modal.showModal({
    title: '单人 AI 对战 · 设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '开始对局',
        className: 'btn-primary',
        onClick: () => {
          const playerName = body.querySelector('#m2Name').value.trim() || '你';
          const aiName = body.querySelector('#m2AiName').value.trim() || 'AI 渔夫';
          const humanFirst = body.querySelector('#m2First').checked;
          startGame({
            mode: 'm2',
            names: humanFirst ? [playerName, aiName] : [aiName, playerName],
            seed: Math.floor(Math.random() * 1e9),
            cover: false,
            aiFlags: humanFirst ? [false, true] : [true, false],
          });
        },
      },
    ],
  });
}

function openSettings() {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setup-field"><label class="check"><input type="checkbox" id="setAnim" ${game.settings.anim ? 'checked' : ''} /> 启用动画</label></div>
  `;
  modal.showModal({
    title: '设置',
    body,
    actions: [
      { text: '取消', className: 'btn-ghost' },
      {
        text: '保存',
        className: 'btn-primary',
        onClick: () => {
          game.settings.anim = body.querySelector('#setAnim').checked;
          anim.setAnimEnabled(game.settings.anim);
          modal.showToast('设置已保存', 'success');
        },
      },
    ],
  });
}

/* ===== 事件绑定 ===== */
document.querySelectorAll('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'm1') openM1Setup();
    else if (mode === 'm2') openM2Setup();
    else if (mode === 'm3') openM3Setup();
    else if (mode === 'm4') spectateUI.openM4Setup();
    else if (mode === 'm5') soloUI.openM5Setup();
    else modal.showToast('该模式开发中，敬请期待', 'info');
  });
});

$('btnRules').addEventListener('click', () => modal.showRules());
$('btnSettings').addEventListener('click', openSettings);
$('btnBackHome').addEventListener('click', () => {
  clearTimeout(game.aiTimer);
  if (spectateUI.isSpectating()) {
    spectateUI.stopSpectate();
    showScreen('home');
    return;
  }
  if (soloUI.isSolo()) {
    soloUI.stopSolo();
    showScreen('home');
    return;
  }
  if (game.mode === 'm3') {
    leaveOnline();
    return;
  }
  game.state = null;
  showScreen('home');
});
$('btnCoverToggle').addEventListener('click', () => {
  game.settings.cover = !game.settings.cover;
  $('btnCoverToggle').textContent = game.settings.cover ? '遮挡：开' : '遮挡：关';
  modal.showToast(game.settings.cover ? '遮挡切换已开启' : '遮挡切换已关闭', 'info');
});
$('tcBtn').addEventListener('click', () => {
  $('turnCover').style.display = 'none';
  maybeRunAI();
});
$('btnReplay').addEventListener('click', () => {
  if (spectateUI.isSpectating()) {
    spectateUI.restart();
    return;
  }
  if (soloUI.isSolo()) {
    soloUI.restart();
    return;
  }
  if (game.mode === 'm3') {
    leaveOnline();
    return;
  }
  if (game.lastConfig) startGame(game.lastConfig);
});
$('btnResultHome').addEventListener('click', () => {
  if (spectateUI.isSpectating()) {
    spectateUI.stopSpectate();
    showScreen('home');
    return;
  }
  if (soloUI.isSolo()) {
    soloUI.stopSolo();
    showScreen('home');
    return;
  }
  if (game.mode === 'm3') {
    leaveOnline();
    return;
  }
  game.state = null;
  showScreen('home');
});

/* ===== 联机大厅按钮 ===== */
$('btnReady').addEventListener('click', () => {
  if (!online.client) return;
  online.myReady = !online.myReady;
  online.client.ready(online.myReady);
});
$('btnStart').addEventListener('click', () => {
  if (online.isHost) online.client.start();
});
$('btnLeaveRoom').addEventListener('click', leaveOnline);

/* ===== 全局错误捕获 ===== */
window.addEventListener('error', (e) => {
  logger.error('global', 'error', { message: e.message, file: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  logger.error('global', 'unhandledrejection', { reason: String(e.reason) });
});

// 初始化：默认显示首页
showScreen('home');