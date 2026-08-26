/**
 * 联机消息协议（前后端共享，纯函数，可单测）。
 * 所有消息均为 JSON；字段/类型/校验在此统一，保证前后端同构。
 * 依赖方向：net → core（协议与状态机）；server 复用本模块，禁止反向依赖。
 */

export const MSG = {
  // 客户端 → 服务端
  CREATE: 'CREATE',
  JOIN: 'JOIN',
  READY: 'READY',
  START: 'START',
  ACTION: 'ACTION',
  KICK: 'KICK',
  LEAVE: 'LEAVE',
  PING: 'PING',
  // 服务端 → 客户端
  JOINED: 'JOINED',
  ROOM_UPDATE: 'ROOM_UPDATE',
  JOIN_ERROR: 'JOIN_ERROR',
  GAME_START: 'GAME_START',
  STATE_SYNC: 'STATE_SYNC',
  PEEK_RESULT: 'PEEK_RESULT',
  ACTION_REJECTED: 'ACTION_REJECTED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  RECONNECT: 'RECONNECT',
  GAME_OVER: 'GAME_OVER',
  PONG: 'PONG',
  ERROR: 'ERROR',
};

export const ROOM_CODE_LEN = 4;
export const MAX_PLAYERS = 3;
export const MIN_PLAYERS = 2;
export const MAX_NAME_LEN = 8;
/** 房间码字符集：去掉易混淆的 0/O、1/I/L */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 生成 4 位房间码。
 * @param {{int:(n:number)=>number}} rng 可注入随机源（便于测试复现）
 * @returns {string}
 */
export function genRoomCode(rng) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += ROOM_CODE_CHARS[rng.int(ROOM_CODE_CHARS.length)];
  }
  return code;
}

/** 校验房间码格式（4 位大写字母/数字） */
export function validateRoomCode(code) {
  if (typeof code !== 'string') return false;
  const re = new RegExp(`^[${ROOM_CODE_CHARS}]{${ROOM_CODE_LEN}}$`);
  return re.test(code.toUpperCase());
}

/** 规范化昵称：去首尾空白、限长、兜底 */
export function normalizeName(name) {
  const n = String(name ?? '').trim().slice(0, MAX_NAME_LEN);
  return n || '玩家';
}

/** 校验 JOIN 载荷 @returns {string|null} */
export function validateJoin(payload) {
  if (!payload || typeof payload !== 'object') return '无效的加入请求';
  if (typeof payload.roomCode !== 'string' || !validateRoomCode(payload.roomCode)) {
    return '房间码格式不正确（4 位大写字母/数字）';
  }
  return null;
}

/** 校验 READY 载荷 @returns {string|null} */
export function validateReady(payload) {
  if (!payload || typeof payload.ready !== 'boolean') return '无效的准备状态';
  return null;
}

/** 校验 ACTION 载荷（动作本体由状态机校验，这里只做结构检查） @returns {string|null} */
export function validateActionMsg(payload) {
  if (!payload || typeof payload.action !== 'object' || payload.action === null) return '无效的动作消息';
  if (typeof payload.action.type !== 'string' || payload.action.type.length === 0) return '动作缺少类型';
  return null;
}

/** 校验 KICK 载荷 @returns {string|null} */
export function validateKick(payload) {
  if (!payload || typeof payload.playerId !== 'number') return '无效的踢人请求';
  return null;
}

/**
 * 状态快照：剥离隐藏信息（lastPeek 偷看结果）与回放数据（actions）。
 * 浅滩堆内容保留（快照契约要求"浅滩各堆"完整，客户端规则函数依赖顶牌强度判定放回合法性）；
 * 服务端为权威，动作一律经状态机校验，客户端无法用快照信息作弊。
 * 返回可序列化纯数据，用于渲染、重连恢复。
 */
export function toSnapshot(state) {
  return {
    version: state.version,
    seed: state.seed,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      caught: p.caught,
      exhausted: p.exhausted,
      snowGuard: p.snowGuard,
      powerBonus: p.powerBonus,
    })),
    shoals: state.shoals.map((s) => s.slice()),
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    pending: state.pending || null,
    turn: state.turn,
    drawn: state.drawn,
    drawnFrom: state.drawnFrom,
    extraDraw: state.extraDraw,
    caughtThisTurn: state.caughtThisTurn,
    gameOver: state.gameOver,
    winner: state.winner,
  };
}
