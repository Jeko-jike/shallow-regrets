import { describe, it, expect } from 'vitest';
import {
  canCatch,
  getCatchableDrawn,
  getDrawableShoals,
  getLegalThrowTargets,
  checkGameOver,
} from '../../js/core/rules.js';
import { makeState, makePlayer } from '../helpers.js';

describe('rules.js 规则引擎', () => {
  describe('canCatch 强度判定', () => {
    it('钩子数 >= 所需钩数时可钓', () => {
      const state = makeState();
      state.players[0].caught = ['sardine']; // 提供 1 钩
      expect(canCatch(state, 0, 'sardine')).toBe(true); // 需要 0
      expect(canCatch(state, 0, 'lamprey')).toBe(true); // 需要 1，已有 1 钩
      expect(canCatch(state, 0, 'kraken')).toBe(false); // 需要 5
      state.players[0].caught = []; // 0 钩
      expect(canCatch(state, 0, 'lamprey')).toBe(false); // 需要 1
    });
  });

  describe('getCatchableDrawn 当前可钓牌', () => {
    it('只返回当前玩家可钓的抽出牌', () => {
      const state = makeState();
      state.players[0].caught = ['lamprey']; // 1 钩
      state.drawn = ['sardine', 'kraken']; // 0 可钓, 5 不可钓
      expect(getCatchableDrawn(state)).toEqual(['sardine']);
    });
  });

  describe('getDrawableShoals 可抽浅滩', () => {
    it('只返回非空浅滩', () => {
      const state = makeState();
      state.shoals = [['sardine'], [], ['lamprey', 'kraken'], [], [], []];
      expect(getDrawableShoals(state)).toEqual([0, 2]);
    });
  });

  describe('getLegalThrowTargets 放回规则（官方规则）', () => {
    it('有空浅滩时必须放回空浅滩', () => {
      const state = makeState();
      state.shoals = [
        ['sardine', 'lamprey', 'kraken'], // 顶牌 0 小
        ['clownfish', 'oarfish', 'kelpie'], // 顶牌 0 小
        [], // 空
        ['barracuda', 'lamprey', 'dayOctopus'], // 顶牌 2 大
        ['pufferfish', 'eversquid', 'stingray'], // 顶牌 0 小
        ['jellyfish', 'morayEel', 'giantOctopus'], // 顶牌 0 小
      ];
      expect(getLegalThrowTargets(state)).toEqual([2]);
    });

    it('无空浅滩时只能盖大阴影（顶牌 strength>=1）', () => {
      const state = makeState();
      state.shoals = [
        ['sardine', 'lamprey', 'kraken'], // 0 小
        ['clownfish', 'oarfish', 'kelpie'], // 0 小
        ['barracuda', 'lamprey', 'dayOctopus'], // 2 大
        ['pufferfish', 'eversquid', 'stingray'], // 0 小
        ['jellyfish', 'morayEel', 'giantOctopus'], // 0 小
        ['foot', 'dayOctopus', 'lamprey'], // 0 小
      ];
      expect(getLegalThrowTargets(state)).toEqual([2]);
    });

    it('所有浅滩顶牌都是小阴影时可放回任意浅滩', () => {
      const state = makeState();
      state.shoals = [
        ['sardine', 'lamprey', 'kraken'],
        ['clownfish', 'oarfish', 'kelpie'],
        ['pufferfish', 'lamprey', 'dayOctopus'],
        ['jellyfish', 'eversquid', 'stingray'],
        ['foot', 'morayEel', 'giantOctopus'],
        ['lanternfish', 'barracuda', 'lamprey'],
      ];
      expect(getLegalThrowTargets(state)).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('checkGameOver 终局判定', () => {
    it('全部钓光时结束', () => {
      const state = makeState();
      state.players[0].caught = ['sardine', 'lamprey', 'kraken'];
      state.players[1].caught = ['clownfish', 'oarfish', 'kelpie'];
      state.shoals = [[], [], [], [], [], []];
      expect(checkGameOver(state)).toBe(true);
    });

    it('无人能钓起浅滩剩余牌时结束', () => {
      const state = makeState({
        players: [makePlayer(0, 'A'), makePlayer(1, 'B')],
        shoals: [['kraken'], ['kelpie'], [], [], [], []], // 需要 5/4 钩，无人有钩
      });
      expect(checkGameOver(state)).toBe(true);
    });

    it('只要还有玩家能钓起任意剩余牌就不结束', () => {
      const state = makeState({
        players: [makePlayer(0, 'A', ['kraken']), makePlayer(1, 'B')], // A 有 5 钩
        shoals: [['kraken'], ['kelpie'], [], [], [], []],
      });
      expect(checkGameOver(state)).toBe(false);
    });
  });
});
