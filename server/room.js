/**
 * 房间管理：4 位房间码、成员、准备状态、生命周期。
 * 纯逻辑（不依赖 Socket.IO），便于单测；由 server.js 驱动。
 */
import { genRoomCode, MAX_PLAYERS, MIN_PLAYERS, normalizeName } from '../js/net/protocol.js';

export class Room {
  /**
   * @param {{code:string, hostId:number, hostName:string}} opts
   */
  constructor({ code, hostId, hostName }) {
    this.code = code;
    this.players = [{ id: hostId, name: normalizeName(hostName), ready: false, connected: true, ai: false }];
    this.hostId = hostId;
    this.game = null; // 对局状态（权威）
    this.seed = null;
    this.lastActive = Date.now();
    this.nextId = 1;
  }

  touch() {
    this.lastActive = Date.now();
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  isFull() {
    return this.players.length >= MAX_PLAYERS;
  }

  /** 加入玩家，返回新玩家对象；房间已满返回 null */
  addPlayer(name) {
    if (this.isFull()) return null;
    const p = { id: this.nextId++, name: normalizeName(name), ready: false, connected: true, ai: false };
    this.players.push(p);
    this.touch();
    return p;
  }

  /** 移除玩家，返回被移除者；不存在返回 null */
  removePlayer(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const [removed] = this.players.splice(i, 1);
    this.touch();
    return removed;
  }

  setReady(id, ready) {
    const p = this.getPlayer(id);
    if (!p) return false;
    p.ready = ready;
    this.touch();
    return true;
  }

  /** 人数达标且全员准备 */
  allReady() {
    return this.players.length >= MIN_PLAYERS && this.players.every((p) => p.ready);
  }

  setConnected(id, connected) {
    const p = this.getPlayer(id);
    if (!p) return;
    p.connected = connected;
    this.touch();
  }

  isEmpty() {
    return this.players.length === 0;
  }

  /** 公开房间信息（不含内部状态） */
  toPublic() {
    return {
      code: this.code,
      hostId: this.hostId,
      inGame: !!this.game,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        connected: p.connected,
        ai: p.ai,
      })),
    };
  }
}

export class RoomManager {
  /**
   * @param {{rng:object}} opts 房间码随机源
   */
  constructor({ rng }) {
    this.rooms = new Map();
    this.rng = rng;
  }

  /** 创建房间（房主即 hostId=0 的玩家） */
  create(hostName) {
    let code;
    do {
      code = genRoomCode(this.rng);
    } while (this.rooms.has(code));
    const room = new Room({ code, hostId: 0, hostName });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.has(code) ? this.rooms.get(code) : null;
  }

  remove(code) {
    this.rooms.delete(code);
  }

  /** 清理超时空闲房间（无人在线超过 maxIdleMs） */
  cleanup(maxIdleMs) {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActive > maxIdleMs) this.rooms.delete(code);
    }
  }
}
