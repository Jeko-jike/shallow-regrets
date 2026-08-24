/**
 * M3 客户端联网层：只与 server 通信，不跑规则。
 * 封装 Socket.IO 连接与消息收发，向 UI 层暴露回调。
 * 依赖：socket.io-client（随 Vite 打包内联，单机模式不连接即可离线）。
 */
import { io } from 'socket.io-client';
import { MSG } from './protocol.js';
import { logger } from '../utils/logger.js';

export class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  /** 建立连接（默认连当前页面同源；开发/联机时即 server 托管页面） */
  connect({ onConnect, onDisconnect } = {}) {
    if (this.socket) return;
    this.socket = io();
    this.socket.on('connect', () => {
      this.connected = true;
      logger.info('net', 'connect', {});
      onConnect?.();
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
      logger.warn('net', 'disconnect', {});
      onDisconnect?.();
    });
  }

  /** 注册消息回调（type 见 protocol.MSG） */
  on(type, handler) {
    this.socket.on(type, handler);
  }

  create(name) {
    this.socket.emit(MSG.CREATE, { name });
  }

  join(roomCode, name) {
    this.socket.emit(MSG.JOIN, { roomCode, name });
  }

  ready(ready) {
    this.socket.emit(MSG.READY, { ready });
  }

  start() {
    this.socket.emit(MSG.START);
  }

  action(action) {
    this.socket.emit(MSG.ACTION, { action });
  }

  kick(playerId) {
    this.socket.emit(MSG.KICK, { playerId });
  }

  leave() {
    this.socket.emit(MSG.LEAVE);
  }

  ping() {
    this.socket.emit(MSG.PING);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}
