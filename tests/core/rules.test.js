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
    it('钩子数 >= 所需难度时可钓', () => {
      const state = makeState();
      state.players[0].caught = ['lamprey']; // 提供 1 钩
      expect(canCatch(state, 0, 'lamprey')).toBe(true); // 难度 0
      expect(canCatch(state, 0, 'oarfish')).toBe(true); // 难度 1，已有 1 钩
      expect(canCatch(state, 0, 'kraken')).toBe(false); // 难度 5
      state.players[0].caught = []; // 0 钩
      expect(canCatch(state, 0, 'oarfish')).toBe(false); // 难度 1，0 钩
    });
  });

  describe('getCatchableDrawn 当前可钓牌', () => {
    it('只返回当前玩家可钓的抽出牌', () => {
      const state = makeState();
      state.players[0].caught = ['lamprey']; // 1 钩
      state.drawn = ['lamprey', 'kraken']; // 难度0 可钓, 难度5 不可钓
      expect(getCatchableDrawn(state)).toEqual(['lamprey']);
    });
  });

  describe('getDrawableShoals 可抽浅滩', () => {
    it('只返回非空浅滩', () => {
      const state = makeState();
      state.shoals = [['lamprey'], [], ['barracuda', 'kraken'], [], [], []];
      expect(getDrawableShoals(state)).toEqual([0, 2]);
    });
  });

  describe('getLegalThrowTargets 放回规则（官方规则）', () => {
    it('有空浅滩时必须放回空浅滩', () => {
      const state = makeState();
      state.shoals = [
        ['lamprey', 'lamprey', 'lamprey', 'lamprey'], // 满4，顶小
        ['lamprey', 'lamprey', 'lamprey', 'lamprey'], // 满4
        [], // 空
        ['rotfish', 'lamprey', 'lamprey', 'lamprey'], // 顶小
        ['seaMonkey', 'lamprey', 'lamprey', 'lamprey'], // 顶小
        ['barracuda', 'lamprey', 'lamprey', 'lamprey'], // 顶小
      ];
      expect(getLegalThrowTargets(state)).toEqual([2]);
    });

    it('无空浅滩时只能盖大阴影（顶牌 strength>=1）', () => {
      const state = makeState();
      state.shoals = [
        ['lamprey', 'lamprey'], // 顶小
        ['lamprey', 'lamprey'], // 顶小
        ['oarfish', 'lamprey'], // 顶 strength1 大
        ['lamprey', 'lamprey'],
        ['lamprey', 'lamprey'],
        ['lamprey', 'lamprey'],
      ];
      expect(getLegalThrowTargets(state)).toEqual([2]);
    });

    it('所有浅滩顶牌都是小阴影时可放回任意浅滩', () => {
      const state = makeState();
      state.shoals = [
        ['lamprey'], ['lamprey'], ['lamprey'], ['lamprey'], ['lamprey'], ['lamprey'],
      ];
      expect(getLegalThrowTargets(state)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('满堆（已有 4 张）的浅滩不可作为放回目标', () => {
      const state = makeState();
      state.shoals = [
        ['rotfish', 'lamprey', 'lamprey', 'lamprey'], // 满4，被排除
        ['lamprey', 'lamprey'], // 未满，顶小
        ['lamprey', 'lamprey'],
        ['lamprey', 'lamprey'],
        ['lamprey', 'lamprey'],
        ['lamprey', 'lamprey'],
      ];
      // 唯一满堆的浅滩被排除，只能放回其余未满小阴影浅滩
      expect(getLegalThrowTargets(state)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('checkGameOver 终局判定', () => {
    it('全部钓光时结束', () => {
      const state = makeState();
      state.players[0].caught = ['lamprey', 'barracuda'];
      state.players[1].caught = ['oarfish', 'rotfish'];
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
      // seaMonkey(3)+severedFoot(2)+rotfish(2)+lamprey(1)=8 钩，可钓起挪威海怪（需 5 钩）
      const state = makeState({
        players: [makePlayer(0, 'A', ['seaMonkey', 'severedFoot', 'rotfish', 'lamprey']), makePlayer(1, 'B')],
        shoals: [['kraken'], ['kelpie'], [], [], [], []],
      });
      expect(checkGameOver(state)).toBe(false);
    });
  });
});