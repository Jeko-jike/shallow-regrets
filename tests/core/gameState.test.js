import { describe, it, expect } from 'vitest';
import { createInitialState, getHooks, getTotalCaught, NUM_SHOALS, CARDS_PER_SHOAL, TOTAL_CARDS } from '../../js/core/gameState.js';
import { CARD_BY_ID } from '../../js/core/cards.js';

describe('gameState.js 初始状态', () => {
  it('洗牌后分成 6 个浅滩，每个 3 张，共 18 张且不重复', () => {
    const state = createInitialState({ seed: 12345, playerNames: ['A', 'B'] });
    expect(state.shoals).toHaveLength(NUM_SHOALS);
    const all = state.shoals.flat();
    expect(all).toHaveLength(TOTAL_CARDS);
    expect(new Set(all).size).toBe(TOTAL_CARDS);
    for (const shoal of state.shoals) {
      expect(shoal).toHaveLength(CARDS_PER_SHOAL);
    }
  });

  it('至少 3 个浅滩的顶牌是 strength<=0 的小鱼', () => {
    for (let seed = 0; seed < 50; seed++) {
      const state = createInitialState({ seed, playerNames: ['A', 'B'] });
      const smallTops = state.shoals.filter((s) => CARD_BY_ID[s[0]].strength <= 0).length;
      expect(smallTops).toBeGreaterThanOrEqual(3);
    }
  });

  it('玩家初始无钓获、无横置、无免疫，钩子为 0', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B', 'C'] });
    expect(state.players).toHaveLength(3);
    for (const p of state.players) {
      expect(p.caught).toEqual([]);
      expect(p.exhausted).toEqual([]);
      expect(p.immune).toBe(false);
    }
    expect(getHooks(state, 0)).toBe(0);
    expect(getTotalCaught(state)).toBe(0);
  });

  it('钩子机制：小鱼（strength 0）钓获提供 1 钩，大鱼提供其 strength 钩', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
    state.players[0].caught = ['sardine', 'clownfish']; // 1+1
    expect(getHooks(state, 0)).toBe(2);
    state.players[0].caught = ['lamprey', 'barracuda', 'kraken']; // 1+2+5
    expect(getHooks(state, 0)).toBe(8);
    expect(CARD_BY_ID['sardine'].hooks).toBe(1);
    expect(CARD_BY_ID['sardine'].strength).toBe(0); // 难度与提供钩数分离
  });

  it('初始阶段为 ability，当前玩家为 0，回合为 1', () => {
    const state = createInitialState({ seed: 5, playerNames: ['A', 'B'] });
    expect(state.phase).toBe('ability');
    expect(state.currentPlayer).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('同一种子产生完全相同的初始状态（可复现）', () => {
    const a = createInitialState({ seed: 777, playerNames: ['A', 'B'] });
    const b = createInitialState({ seed: 777, playerNames: ['A', 'B'] });
    expect(a.shoals).toEqual(b.shoals);
  });
});
