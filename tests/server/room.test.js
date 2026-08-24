/**
 * 房间管理测试：创建/加入/准备/踢出/房主转移/空闲清理。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Room, RoomManager } from '../../server/room.js';
import { createRng } from '../../js/utils/rng.js';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../js/net/protocol.js';

describe('Room: 创建与成员', () => {
  it('创建房间：房主为 id 0', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: ' 房主 ' });
    expect(room.code).toBe('AB12');
    expect(room.hostId).toBe(0);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('房主');
    expect(room.players[0].ready).toBe(false);
    expect(room.players[0].connected).toBe(true);
  });

  it('加入玩家：id 递增，满员后拒绝', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: 'A' });
    for (let i = 1; i < MAX_PLAYERS; i++) {
      const p = room.addPlayer(`P${i}`);
      expect(p.id).toBe(i);
    }
    expect(room.isFull()).toBe(true);
    expect(room.addPlayer('X')).toBeNull();
    expect(room.players).toHaveLength(MAX_PLAYERS);
  });

  it('移除玩家', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: 'A' });
    room.addPlayer('B');
    const removed = room.removePlayer(1);
    expect(removed.name).toBe('B');
    expect(room.players).toHaveLength(1);
    expect(room.removePlayer(99)).toBeNull();
  });
});

describe('Room: 准备与开局条件', () => {
  it('allReady：人数达标且全员准备', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: 'A' });
    room.addPlayer('B');
    expect(room.allReady()).toBe(false);
    room.setReady(0, true);
    expect(room.allReady()).toBe(false);
    room.setReady(1, true);
    expect(room.allReady()).toBe(true);
    room.setReady(1, false);
    expect(room.allReady()).toBe(false);
  });

  it('人数不足 MIN_PLAYERS 时不能开局', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: 'A' });
    room.setReady(0, true);
    expect(room.players.length).toBeLessThan(MIN_PLAYERS);
    expect(room.allReady()).toBe(false);
  });
});

describe('RoomManager: 生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('创建房间码唯一', () => {
    const mgr = new RoomManager({ rng: createRng(1) });
    const r1 = mgr.create('A');
    const r2 = mgr.create('B');
    expect(r1.code).not.toBe(r2.code);
    expect(mgr.get(r1.code)).toBe(r1);
  });

  it('空闲清理：超过 maxIdleMs 的房间被销毁', () => {
    const mgr = new RoomManager({ rng: createRng(2) });
    const room = mgr.create('A');
    mgr.cleanup(1000);
    expect(mgr.get(room.code)).toBe(room);
    vi.advanceTimersByTime(2000);
    mgr.cleanup(1000);
    expect(mgr.get(room.code)).toBeNull();
  });

  it('活跃房间不被清理（touch 刷新 lastActive）', () => {
    const mgr = new RoomManager({ rng: createRng(3) });
    const room = mgr.create('A');
    vi.advanceTimersByTime(500);
    room.touch();
    vi.advanceTimersByTime(500);
    mgr.cleanup(1000);
    expect(mgr.get(room.code)).toBe(room);
  });
});

describe('Room: 公开信息', () => {
  it('toPublic 不含内部状态，含准备/连接/AI 标记', () => {
    const room = new Room({ code: 'AB12', hostId: 0, hostName: 'A' });
    room.addPlayer('B');
    room.setReady(1, true);
    const pub = room.toPublic();
    expect(pub.code).toBe('AB12');
    expect(pub.hostId).toBe(0);
    expect(pub.inGame).toBe(false);
    expect(pub.players).toHaveLength(2);
    expect(pub.players[1]).toEqual({ id: 1, name: 'B', ready: true, connected: true, ai: false });
    expect(pub.game).toBeUndefined();
  });
});
