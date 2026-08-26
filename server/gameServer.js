/**
 * 主机权威对局服务：复用 js/core/stateMachine.js 校验动作并广播状态。
 * 不写 UI；只负责：开局、动作校验/推进、状态快照广播、断线 AI 托管、回放保存。
 */
import { createInitialState } from '../js/core/gameState.js';
import { applyAction, ACTION, PHASE } from '../js/core/stateMachine.js';
import { autoResolution } from '../js/core/abilities.js';
import { chooseAction } from '../js/ai/heuristicAI.js';
import { toSnapshot, MSG } from '../js/net/protocol.js';
import { logger } from '../js/utils/logger.js';

const AI_DELAY_MS = 500;

export class GameServer {
  /**
   * @param {{room:object, io:object, send:(playerId:number,type:string,payload:object)=>void}} opts
   *   io 为 Socket.IO 实例（to(roomCode).emit）；send 由 server.js 注入（按 playerId 定向发送）。
   */
  constructor({ room, io, send }) {
    this.room = room;
    this.io = io;
    this.send = send;
    this.state = null;
    this.aiTimers = new Map(); // playerId -> timer
    this.replay = { seed: null, actions: [] };
  }

  /** 开局：生成权威状态并广播 */
  start(seed) {
    const names = this.room.players.map((p) => p.name);
    this.state = createInitialState({ seed, playerNames: names });
    this.room.game = this.state;
    this.room.seed = seed;
    this.replay = { seed, actions: [] };
    logger.info('net', 'game_start', { code: this.room.code, seed, names });
    this.broadcast(MSG.GAME_START, {
      seed,
      players: this.room.players.map((p) => ({ id: p.id, name: p.name })),
      state: toSnapshot(this.state),
    });
    this.broadcastState();
    this.maybeRunAI();
  }

  /** 处理客户端动作：先校验轮到谁，再交给状态机；非法动作拒绝并回滚 */
  handleAction(playerId, action) {
    if (!this.state || this.state.phase === PHASE.GAME_OVER) {
      this.send(playerId, MSG.ACTION_REJECTED, { action, error: '对局未开始或已结束' });
      return;
    }
    const playerIndex = this.room.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== this.state.currentPlayer) {
      this.send(playerId, MSG.ACTION_REJECTED, { action, error: '还没轮到你行动' });
      return;
    }
    const res = applyAction(this.state, action);
    if (res.error) {
      this.send(playerId, MSG.ACTION_REJECTED, { action, error: res.error });
      logger.warn('net', 'action_rejected', { code: this.room.code, playerId, error: res.error });
      return;
    }
    this.state = res.state;
    this.replay.actions.push({ player: playerIndex, turn: this.state.turn, action });
    this.drainPending();
    this.handleEvents(res.events, playerId);
    this.broadcastState();
    if (this.state.phase === PHASE.GAME_OVER) {
      logger.info('net', 'game_over', { code: this.room.code, winner: this.state.winner });
      this.broadcast(MSG.GAME_OVER, {});
      return;
    }
    this.maybeRunAI();
  }

  /**
   * 联机权威端确定性自动消解所有反应窗口（REDIRECT/COUNTER/REARRANGE/PASS_LEFT）。
   * 说明：联机暂不提供逐玩家反应抉择，统一走确定性结算以保证对局不卡死、回放可复现。
   */
  drainPending() {
    let guard = 0;
    while (this.state.phase === PHASE.PENDING && this.state.pending && guard++ < 30) {
      const res = applyAction(this.state, { type: ACTION.RESOLVE, resolution: autoResolution(this.state) });
      if (res.error) break;
      this.state = res.state;
      this.replay.actions.push({ player: -1, turn: this.state.turn, action: { type: 'RESOLVE_AUTO' } });
    }
  }

  /** 处理状态机事件中的定向消息（如偷看结果只发给发动者） */
  handleEvents(events, playerId) {
    for (const ev of events) {
      if (ev === 'peek_shoal' && this.state.lastPeek) {
        this.send(playerId, MSG.PEEK_RESULT, {
          shoalIndex: this.state.lastPeek.shoalIndex,
          cardId: this.state.lastPeek.cardId,
        });
      }
    }
  }

  /** 若当前行动者是 AI（掉线托管），调度其行动 */
  maybeRunAI() {
    if (!this.state || this.state.phase === PHASE.GAME_OVER) return;
    const roomPlayer = this.room.players[this.state.currentPlayer];
    if (!roomPlayer || !roomPlayer.ai) return;
    clearTimeout(this.aiTimers.get(roomPlayer.id));
    const timer = setTimeout(() => {
      if (!this.state || this.state.phase === PHASE.GAME_OVER) return;
      const action = chooseAction(this.state);
      if (action) this.handleAction(roomPlayer.id, action);
    }, AI_DELAY_MS);
    this.aiTimers.set(roomPlayer.id, timer);
  }

  /** 对局中掉线 → AI 托管并明示 */
  onDisconnect(playerId) {
    const p = this.room.getPlayer(playerId);
    if (!p) return;
    p.connected = false;
    if (this.state && this.state.phase !== PHASE.GAME_OVER) {
      p.ai = true;
      logger.info('net', 'player_left', { code: this.room.code, playerId, name: p.name });
      this.broadcast(MSG.PLAYER_LEFT, { playerId, message: `${p.name} 掉线，已由 AI 托管` });
      this.broadcastState();
      this.maybeRunAI();
    }
  }

  /** 重连恢复：补发当前快照 */
  onReconnect(playerId) {
    const p = this.room.getPlayer(playerId);
    if (!p) return;
    p.connected = true;
    if (this.state) {
      this.send(playerId, MSG.RECONNECT, { state: toSnapshot(this.state), playerId });
      this.broadcast(MSG.ROOM_UPDATE, this.room.toPublic());
    }
  }

  broadcastState() {
    this.broadcast(MSG.STATE_SYNC, {
      state: toSnapshot(this.state),
      players: this.room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, ai: p.ai })),
    });
  }

  broadcast(type, payload) {
    this.io.to(this.room.code).emit(type, payload);
  }
}
