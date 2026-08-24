/**
 * 联机冒烟测试：真实启动 server，用 socket.io-client 模拟 2 名玩家
 * 完成 建房 → 加入 → 准备 → 开局 → 行动 → 终局 的完整链路。
 * 运行：node tests/server/smoke.mjs
 */
import { io } from 'socket.io-client';
import { MSG } from '../../js/net/protocol.js';

const URL = process.env.SMOKE_URL || 'http://localhost:3000';
const log = (...a) => console.log('[smoke]', ...a);

function connect(name) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('连接超时')), 5000);
  });
}

function waitFor(socket, type, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${type} 超时`)), timeout);
    socket.once(type, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

async function main() {
  log('连接服务端', URL);
  const host = await connect('host');
  const guest = await connect('guest');
  log('两个客户端已连接');

  // 建房
  host.emit(MSG.CREATE, { name: '房主' });
  const joinedHost = await waitFor(host, MSG.JOINED);
  const roomCode = joinedHost.roomCode;
  log('房主建房成功，房间码', roomCode);

  // 加入
  guest.emit(MSG.JOIN, { roomCode, name: '好友' });
  const joinedGuest = await waitFor(guest, MSG.JOINED);
  log('好友加入成功，playerId', joinedGuest.playerId);

  // 双方准备
  host.emit(MSG.READY, { ready: true });
  guest.emit(MSG.READY, { ready: true });
  await waitFor(host, MSG.ROOM_UPDATE);
  log('双方已准备');

  // 房主开始
  host.emit(MSG.START);
  const gameStart = await waitFor(host, MSG.GAME_START);
  log('对局开始，seed', gameStart.seed, '玩家数', gameStart.players.length);

  // 等待 STATE_SYNC
  const sync1 = await waitFor(host, MSG.STATE_SYNC);
  log('收到 STATE_SYNC，阶段', sync1.state.phase, '当前玩家', sync1.state.currentPlayer);

  // 当前玩家（房主 playerId=0）行动：PASS_ABILITIES
  if (sync1.state.currentPlayer === 0) {
    host.emit(MSG.ACTION, { action: { type: 'PASS_ABILITIES' } });
  } else {
    guest.emit(MSG.ACTION, { action: { type: 'PASS_ABILITIES' } });
  }
  const sync2 = await waitFor(host, MSG.STATE_SYNC);
  log('行动后阶段', sync2.state.phase);

  // 非法动作应被拒绝（非当前玩家）
  const wrongPlayer = sync2.state.currentPlayer === 0 ? guest : host;
  const rightPlayer = sync2.state.currentPlayer === 0 ? host : guest;
  wrongPlayer.emit(MSG.ACTION, { action: { type: 'PASS_ABILITIES' } });
  const rejected = await waitFor(wrongPlayer, MSG.ACTION_REJECTED);
  log('非法动作被拒绝：', rejected.error);

  // 正确玩家抽牌
  rightPlayer.emit(MSG.ACTION, { action: { type: 'DRAW', from: [0, 1] } });
  const sync3 = await waitFor(host, MSG.STATE_SYNC);
  log('抽牌后阶段', sync3.state.phase, '抽出牌数', sync3.state.drawn.length);

  log('冒烟测试通过 ✓');
  host.close();
  guest.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke] 失败：', e.message);
  process.exit(1);
});
