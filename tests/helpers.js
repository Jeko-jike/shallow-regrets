/**
 * 测试辅助：构造可覆盖的对局状态。
 * 默认基于 createInitialState，可用 overrides 覆盖任意字段。
 */
import { createInitialState } from '../js/core/gameState.js';

export function makeState(overrides = {}) {
  const base = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
  return {
    ...base,
    ...overrides,
    players: overrides.players ? overrides.players : base.players,
    shoals: overrides.shoals ? overrides.shoals : base.shoals,
  };
}

/** 构造一个指定钓获/横置的玩家对象 */
export function makePlayer(id, name, caught = [], exhausted = [], immune = false) {
  return { id, name, caught: [...caught], exhausted: [...exhausted], immune };
}
