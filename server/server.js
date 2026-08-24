/**
 * M3 联机服务端入口：静态托管 + Socket.IO + 房间/对局事件。
 * 运行：node server/server.js（默认监听 3000）。
 * 公网暴露：cloudflared tunnel --url http://localhost:3000（详见 tools/README.md）。
 * 局域网兜底：http://主机内网IP:3000 直接发给同一网络的好友。
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './room.js';
import { GameServer } from './gameServer.js';
import {
  MSG,
  validateJoin,
  validateReady,
  validateActionMsg,
  validateKick,
  normalizeName,
} from '../js/net/protocol.js';
import { createRng } from '../js/utils/rng.js';
import { logger, setLogLevel } from '../js/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ROOM_IDLE_MS = 30 * 60 * 1000; // 30 分钟无活动销毁房间
const REPLAY_TTL_MS = 60 * 60 * 1000; // 回放保留 1 小时

setLogLevel(process.env.LOG_LEVEL || 'info');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// 静态托管：优先 dist（构建产物，双击可玩），否则根目录源码
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use(express.static(path.join(__dirname, '..')));

const roomManager = new RoomManager({ rng: createRng(Date.now() >>> 0) });
const games = new Map(); // roomCode -> GameServer
const replays = new Map(); // roomCode -> { seed, actions, endedAt }
const socketRooms = new Map(); // socketId -> { roomCode, playerId }
const socketByPlayer = new Map(); // `${roomCode}:${playerId}` -> socketId

/** 定向发送给某玩家（按 roomCode+playerId 查 socket） */
function sendToPlayer(roomCode, playerId, type, payload) {
  const socketId = socketByPlayer.get(`${roomCode}:${playerId}`);
  if (socketId) io.to(socketId).emit(type, payload);
}

function createGame(room) {
  const seed = Math.floor(Math.random() * 1e9);
  const game = new GameServer({
    room,
    io,
    send: (playerId, type, payload) => sendToPlayer(room.code, playerId, type, payload),
  });
  games.set(room.code, game);
  game.start(seed);
}

function cleanupRoom(roomCode) {
  const game = games.get(roomCode);
  if (game) {
    replays.set(roomCode, { ...game.replay, endedAt: Date.now() });
    games.delete(roomCode);
  }
  roomManager.remove(roomCode);
  for (const [sid, info] of socketRooms) {
    if (info.roomCode === roomCode) socketRooms.delete(sid);
  }
  for (const [key, sid] of socketByPlayer) {
    if (key.startsWith(`${roomCode}:`)) socketByPlayer.delete(key);
  }
}

function handleLeave(socket, disconnected = false) {
  const info = socketRooms.get(socket.id);
  if (!info) return;
  socketRooms.delete(socket.id);
  socketByPlayer.delete(`${info.roomCode}:${info.playerId}`);
  const room = roomManager.get(info.roomCode);
  if (!room) return;

  const game = games.get(room.code);
  if (game && game.state && game.state.phase !== 'gameOver') {
    // 对局中掉线 → AI 托管（保留席位，可重连）
    game.onDisconnect(info.playerId);
    return;
  }

  room.removePlayer(info.playerId);
  if (room.hostId === info.playerId && room.players.length > 0) {
    room.hostId = room.players[0].id; // 房主离开 → 转移给最早加入者
  }
  if (room.isEmpty()) {
    cleanupRoom(room.code);
  } else {
    io.to(room.code).emit(MSG.ROOM_UPDATE, room.toPublic());
  }
  logger.info('net', 'leave', { code: room.code, playerId: info.playerId, disconnected });
}

io.on('connection', (socket) => {
  logger.info('net', 'connect', { socketId: socket.id });

  socket.on(MSG.CREATE, (payload) => {
    const name = normalizeName(payload?.name);
    const room = roomManager.create(name);
    socket.join(room.code);
    socketRooms.set(socket.id, { roomCode: room.code, playerId: 0 });
    socketByPlayer.set(`${room.code}:0`, socket.id);
    socket.emit(MSG.JOINED, { roomCode: room.code, playerId: 0, isHost: true, room: room.toPublic() });
    logger.info('net', 'create', { code: room.code, name });
  });

  socket.on(MSG.JOIN, (payload) => {
    const err = validateJoin(payload);
    if (err) return socket.emit(MSG.JOIN_ERROR, { message: err });
    const code = payload.roomCode.toUpperCase();
    const room = roomManager.get(code);
    if (!room) return socket.emit(MSG.JOIN_ERROR, { message: '房间不存在，请检查房间码' });
    const name = normalizeName(payload.name);

    // 对局已开始：仅允许"同名掉线玩家"重连
    if (room.game) {
      const target = room.players.find((p) => !p.connected && p.name === name);
      if (!target) return socket.emit(MSG.JOIN_ERROR, { message: '对局已开始，无法加入' });
      target.connected = true;
      target.ai = false;
      socket.join(code);
      socketRooms.set(socket.id, { roomCode: code, playerId: target.id });
      socketByPlayer.set(`${code}:${target.id}`, socket.id);
      socket.emit(MSG.JOINED, { roomCode: code, playerId: target.id, isHost: target.id === room.hostId, room: room.toPublic() });
      games.get(code)?.onReconnect(target.id);
      logger.info('net', 'reconnect', { code, playerId: target.id, name });
      return;
    }

    if (room.isFull()) return socket.emit(MSG.JOIN_ERROR, { message: '房间已满（最多 3 人）' });
    const player = room.addPlayer(name);
    if (!player) return socket.emit(MSG.JOIN_ERROR, { message: '加入失败' });
    socket.join(code);
    socketRooms.set(socket.id, { roomCode: code, playerId: player.id });
    socketByPlayer.set(`${code}:${player.id}`, socket.id);
    socket.emit(MSG.JOINED, { roomCode: code, playerId: player.id, isHost: player.id === room.hostId, room: room.toPublic() });
    io.to(code).emit(MSG.ROOM_UPDATE, room.toPublic());
    logger.info('net', 'join', { code, playerId: player.id, name });
  });

  socket.on(MSG.READY, (payload) => {
    if (validateReady(payload)) return;
    const info = socketRooms.get(socket.id);
    if (!info) return;
    const room = roomManager.get(info.roomCode);
    if (!room || room.game) return;
    room.setReady(info.playerId, payload.ready);
    io.to(room.code).emit(MSG.ROOM_UPDATE, room.toPublic());
  });

  socket.on(MSG.START, () => {
    const info = socketRooms.get(socket.id);
    if (!info) return;
    const room = roomManager.get(info.roomCode);
    if (!room || room.game) return;
    if (info.playerId !== room.hostId) return socket.emit(MSG.ERROR, { message: '只有房主可以开始对局' });
    if (!room.allReady()) return socket.emit(MSG.ERROR, { message: '所有玩家准备后才能开始' });
    createGame(room);
  });

  socket.on(MSG.ACTION, (payload) => {
    if (validateActionMsg(payload)) return;
    const info = socketRooms.get(socket.id);
    if (!info) return;
    const game = games.get(info.roomCode);
    if (!game) return;
    game.handleAction(info.playerId, payload.action);
  });

  socket.on(MSG.KICK, (payload) => {
    if (validateKick(payload)) return;
    const info = socketRooms.get(socket.id);
    if (!info) return;
    const room = roomManager.get(info.roomCode);
    if (!room) return;
    if (info.playerId !== room.hostId) return;
    const target = room.getPlayer(payload.playerId);
    if (!target) return;
    const targetSocketId = socketByPlayer.get(`${room.code}:${target.id}`);
    if (targetSocketId) {
      io.to(targetSocketId).emit(MSG.ERROR, { message: '你已被房主移出房间' });
      io.sockets.sockets.get(targetSocketId)?.disconnect(true);
    }
  });

  socket.on(MSG.LEAVE, () => handleLeave(socket));

  socket.on(MSG.PING, () => socket.emit(MSG.PONG, { t: Date.now() }));

  socket.on('disconnect', () => handleLeave(socket, true));
});

// 回放接口：GET /api/replay/:roomCode 返回该局动作序列（用于复现 Bug 与平衡性调试）
app.get('/api/replay/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const replay = replays.get(code);
  if (!replay) return res.status(404).json({ error: '回放不存在或已过期' });
  res.json(replay);
});

// 定期清理空闲房间与过期回放
setInterval(() => {
  roomManager.cleanup(ROOM_IDLE_MS);
  const now = Date.now();
  for (const [code, r] of replays) {
    if (now - r.endedAt > REPLAY_TTL_MS) replays.delete(code);
  }
}, 60 * 1000);

httpServer.listen(PORT, () => {
  logger.info('server', 'listen', { port: PORT, url: `http://localhost:${PORT}` });
  console.log(`\n浅滩鱼悔联机服务已启动：http://localhost:${PORT}`);
  console.log('公网暴露（好友加入）：cloudflared tunnel --url http://localhost:3000');
  console.log('局域网兜底：把 http://本机内网IP:3000 发给同一网络的好友\n');
});
