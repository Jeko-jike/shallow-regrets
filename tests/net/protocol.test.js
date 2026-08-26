/**
 * 联机协议一致性测试：房间码/昵称/消息载荷校验、状态快照遮蔽。
 * 前后端同构字段的契约测试。
 */
import { describe, it, expect } from 'vitest';
import {
  MSG,
  genRoomCode,
  validateRoomCode,
  normalizeName,
  validateJoin,
  validateReady,
  validateActionMsg,
  validateKick,
  toSnapshot,
  ROOM_CODE_LEN,
  ROOM_CODE_CHARS,
} from '../../js/net/protocol.js';
import { createRng } from '../../js/utils/rng.js';

describe('protocol: 房间码', () => {
  it('生成 4 位合法房间码（字符集内）', () => {
    const rng = createRng(42);
    for (let i = 0; i < 200; i++) {
      const code = genRoomCode(rng);
      expect(code).toHaveLength(ROOM_CODE_LEN);
      for (const ch of code) expect(ROOM_CODE_CHARS).toContain(ch);
      expect(validateRoomCode(code)).toBe(true);
    }
  });

  it('同一随机源生成序列可复现', () => {
    const a = [genRoomCode(createRng(7)), genRoomCode(createRng(7))];
    const b = [genRoomCode(createRng(7)), genRoomCode(createRng(7))];
    expect(a).toEqual(b);
  });

  it('校验房间码：拒绝非法格式', () => {
    expect(validateRoomCode('AB2C')).toBe(true);
    expect(validateRoomCode('ab2c')).toBe(true); // 小写自动接受（服务端会转大写）
    expect(validateRoomCode('ABC')).toBe(false);
    expect(validateRoomCode('ABCDE')).toBe(false);
    expect(validateRoomCode('AB1O')).toBe(false); // 含易混淆字符 1/O
    expect(validateRoomCode('AB1I')).toBe(false); // 含易混淆字符 1/I
    expect(validateRoomCode('AB0C')).toBe(false); // 含易混淆字符 0
    expect(validateRoomCode('')).toBe(false);
    expect(validateRoomCode(null)).toBe(false);
  });
});

describe('protocol: 昵称规范化', () => {
  it('去首尾空白、限长、空值兜底', () => {
    expect(normalizeName('  张三  ')).toBe('张三');
    expect(normalizeName('a'.repeat(20))).toHaveLength(8);
    expect(normalizeName('')).toBe('玩家');
    expect(normalizeName(null)).toBe('玩家');
    expect(normalizeName(undefined)).toBe('玩家');
  });
});

describe('protocol: 消息载荷校验', () => {
  it('JOIN 校验', () => {
    expect(validateJoin({ roomCode: 'AB2C', name: 'x' })).toBeNull();
    expect(validateJoin({ roomCode: 'bad', name: 'x' })).not.toBeNull();
    expect(validateJoin(null)).not.toBeNull();
    expect(validateJoin({})).not.toBeNull();
  });

  it('READY 校验', () => {
    expect(validateReady({ ready: true })).toBeNull();
    expect(validateReady({ ready: 'yes' })).not.toBeNull();
    expect(validateReady({})).not.toBeNull();
  });

  it('ACTION 校验（结构检查，规则校验在状态机）', () => {
    expect(validateActionMsg({ action: { type: 'DRAW', from: [0] } })).toBeNull();
    expect(validateActionMsg({ action: null })).not.toBeNull();
    expect(validateActionMsg({ action: {} })).not.toBeNull();
    expect(validateActionMsg({})).not.toBeNull();
  });

  it('KICK 校验', () => {
    expect(validateKick({ playerId: 1 })).toBeNull();
    expect(validateKick({ playerId: '1' })).not.toBeNull();
    expect(validateKick({})).not.toBeNull();
  });

  it('消息类型常量前后端同构（枚举齐全）', () => {
    const expected = [
      'CREATE', 'JOIN', 'READY', 'START', 'ACTION', 'KICK', 'LEAVE', 'PING',
      'JOINED', 'ROOM_UPDATE', 'JOIN_ERROR', 'GAME_START', 'STATE_SYNC',
      'PEEK_RESULT', 'ACTION_REJECTED', 'PLAYER_LEFT', 'RECONNECT', 'GAME_OVER', 'PONG', 'ERROR',
    ];
    for (const k of expected) expect(MSG[k]).toBe(k);
  });
});

describe('protocol: 状态快照', () => {
  function makeState() {
    return {
      version: 1,
      seed: 123,
      players: [
        { id: 0, name: 'A', caught: ['sardine'], exhausted: [], immune: false },
        { id: 1, name: 'B', caught: [], exhausted: [], immune: false },
      ],
      shoals: [['sardine', 'kraken', 'foot'], ['clownfish', null, null]],
      currentPlayer: 0,
      phase: 'ability',
      turn: 1,
      drawn: [],
      drawnFrom: [],
      extraDraw: 0,
      caughtThisTurn: 0,
      lastPeek: { player: 0, shoalIndex: 1, cardId: 'clownfish' },
      actions: [{ player: 0, turn: 1, action: { type: 'PASS_ABILITIES' } }],
      gameOver: false,
      winner: null,
    };
  }

  it('剥离隐藏信息（lastPeek）与回放数据（actions）', () => {
    const snap = toSnapshot(makeState());
    expect(snap.lastPeek).toBeUndefined();
    expect(snap.actions).toBeUndefined();
  });

  it('保留浅滩堆内容（快照契约：客户端规则函数依赖顶牌强度）', () => {
    const snap = toSnapshot(makeState());
    expect(snap.shoals).toEqual([['sardine', 'kraken', 'foot'], ['clownfish', null, null]]);
    expect(snap.shoals[0]).toHaveLength(3);
    expect(snap.shoals[1]).toHaveLength(3);
  });

  it('保留公开字段（钓获/横置/抽出牌/回合/阶段）', () => {
    const snap = toSnapshot(makeState());
    expect(snap.players[0].caught).toEqual(['sardine']);
    expect(snap.players[0].exhausted).toEqual([]);
    expect(snap.drawn).toEqual([]);
    expect(snap.turn).toBe(1);
    expect(snap.phase).toBe('ability');
    expect(snap.currentPlayer).toBe(0);
    expect(snap.seed).toBe(123);
  });

  it('快照可 JSON 序列化（无函数/循环引用）', () => {
    const snap = toSnapshot(makeState());
    const round = JSON.parse(JSON.stringify(snap));
    expect(round).toEqual(snap);
  });
});
