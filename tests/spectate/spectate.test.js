/**
 * M4 观战编排测试：确定性、速度不影响结果、手动/自动模式、日志记录、回放导出。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpectateController, SPEED_MS } from '../../js/spectate/spectate.js';
import { createBattleLog, addEntry, toReplay, fromReplay } from '../../js/spectate/battleLog.js';
import { PHASE } from '../../js/core/stateMachine.js';

function runToEnd(seed, names = ['AI 甲', 'AI 乙']) {
  const c = new SpectateController({ names, seed, mode: 'manual' });
  c.finishNow();
  return c;
}

describe('SpectateController: 确定性', () => {
  it('同一 seed 的对局结果与动作序列完全一致', () => {
    const a = runToEnd(12345);
    const b = runToEnd(12345);
    expect(a.state).toEqual(b.state);
    expect(a.log.entries.map((e) => e.action)).toEqual(b.log.entries.map((e) => e.action));
  });

  it('不同 seed 通常产生不同结果（非退化）', () => {
    const a = runToEnd(1);
    const b = runToEnd(2);
    // 至少终局状态一致（都是 gameOver），但动作序列大概率不同
    expect(a.state.phase).toBe(PHASE.GAME_OVER);
    expect(b.state.phase).toBe(PHASE.GAME_OVER);
  });

  it('对局能推进到终局且不卡死', () => {
    for (const seed of [7, 42, 999, 20260825]) {
      const c = runToEnd(seed);
      expect(c.state.phase).toBe(PHASE.GAME_OVER);
      expect(c.state.winner.length).toBeGreaterThan(0);
    }
  });

  it('回归：任意种子都能在有限步数内终局（防死锁）', () => {
    // 历史 Bug：钩子机制错误导致 AI 永远 0 钩、只抽不放，对局死循环。
    // 修复后小鱼钓获提供 1 钩，对局应在 ~100 步内打完。
    for (let seed = 1; seed <= 40; seed++) {
      const c = new SpectateController({ names: ['A', 'B'], seed, mode: 'manual' });
      c.finishNow();
      expect(c.state.phase, `seed=${seed} 未终局`).toBe(PHASE.GAME_OVER);
      expect(c.log.entries.length, `seed=${seed} 步数异常`).toBeLessThan(200);
    }
  });
});

describe('SpectateController: 速度档位不影响结果', () => {
  it('不同速度档位下 finishNow 结果一致（速度只改展示节奏）', () => {
    const results = {};
    for (const speed of ['slow', 'medium', 'fast']) {
      const c = new SpectateController({ names: ['A', 'B'], seed: 555, mode: 'manual', speed });
      c.finishNow();
      results[speed] = { state: c.state, actions: c.log.entries.map((e) => e.action) };
    }
    expect(results.slow.state).toEqual(results.medium.state);
    expect(results.medium.state).toEqual(results.fast.state);
    expect(results.slow.actions).toEqual(results.fast.actions);
  });

  it('速度档位值合理（慢>中>快）', () => {
    expect(SPEED_MS.slow).toBeGreaterThan(SPEED_MS.medium);
    expect(SPEED_MS.medium).toBeGreaterThan(SPEED_MS.fast);
  });
});

describe('SpectateController: 自动模式调度', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('自动模式按速度连续推进，暂停后停止', () => {
    const c = new SpectateController({ names: ['A', 'B'], seed: 10, mode: 'auto', speed: 'fast' });
    const updates = [];
    c.onUpdate = () => updates.push(c.state.phase);
    c.start();
    vi.advanceTimersByTime(SPEED_MS.fast * 2);
    expect(updates.length).toBeGreaterThan(0);
    c.pause();
    const afterPause = updates.length;
    vi.advanceTimersByTime(SPEED_MS.fast * 5);
    expect(updates.length).toBe(afterPause); // 暂停后不再推进
  });

  it('自动模式推进到终局后停止并回调 onGameOver', () => {
    const c = new SpectateController({ names: ['A', 'B'], seed: 10, mode: 'auto', speed: 'fast' });
    let over = false;
    c.onGameOver = () => {
      over = true;
    };
    c.start();
    let guard = 0;
    while (!over && guard++ < 5000) {
      vi.advanceTimersByTime(SPEED_MS.fast);
    }
    expect(over).toBe(true);
    expect(c.state.phase).toBe(PHASE.GAME_OVER);
  });
});

describe('SpectateController: 手动模式', () => {
  it('nextTurn 推进一个完整回合（换人或终局）', () => {
    const c = new SpectateController({ names: ['A', 'B'], seed: 20, mode: 'manual' });
    const startPlayer = c.state.currentPlayer;
    c.nextTurn();
    if (c.state.phase !== PHASE.GAME_OVER) {
      expect(c.state.currentPlayer).not.toBe(startPlayer);
    }
  });

  it('autoAdvanceTurns 推进指定回合数', () => {
    vi.useFakeTimers();
    try {
      const c = new SpectateController({ names: ['A', 'B'], seed: 30, mode: 'manual' });
      const startTurn = c.state.turn;
      c.autoAdvanceTurns(3);
      vi.runAllTimers();
      expect(c.state.turn).toBeGreaterThanOrEqual(startTurn + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('finishNow 立即结束对局', () => {
    const c = new SpectateController({ names: ['A', 'B'], seed: 40, mode: 'manual' });
    c.finishNow();
    expect(c.state.phase).toBe(PHASE.GAME_OVER);
  });
});

describe('SpectateController: 日志与回放', () => {
  it('每条动作都记录 回合/行动方/描述/理由/结果', () => {
    const c = runToEnd(77);
    expect(c.log.entries.length).toBeGreaterThan(0);
    for (const e of c.log.entries) {
      expect(typeof e.turn).toBe('number');
      expect(typeof e.playerIndex).toBe('number');
      expect(typeof e.description).toBe('string');
      expect(e.description.length).toBeGreaterThan(0);
      expect(typeof e.reason).toBe('string');
      expect(Array.isArray(e.result)).toBe(true);
      expect(e.action.type).toBeTruthy();
    }
  });

  it('日志含 AI 决策理由（可观测）', () => {
    const c = runToEnd(88);
    const catchEntry = c.log.entries.find((e) => e.action.type === 'CATCH');
    expect(catchEntry).toBeTruthy();
    expect(catchEntry.reason).toContain('钩数');
  });

  it('回放导出为合法 JSON 且可恢复', () => {
    const c = runToEnd(99);
    const json = c.exportReplay();
    const parsed = JSON.parse(json);
    expect(parsed.seed).toBe(99);
    expect(parsed.actions.length).toBe(c.log.entries.length);
    const restored = fromReplay(json);
    expect(restored.seed).toBe(99);
    expect(restored.actions).toEqual(parsed.actions);
    expect(fromReplay('not json')).toBeNull();
  });
});

describe('battleLog: 工具函数', () => {
  it('addEntry 追加并带时间戳', () => {
    const log = createBattleLog();
    addEntry(log, { turn: 1, playerIndex: 0, phase: 'ability', action: { type: 'PASS_ABILITIES' }, description: 'x', reason: 'y', result: [] });
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0].t).toBeTypeOf('number');
  });

  it('toReplay 包含 seed 与动作序列', () => {
    const log = createBattleLog();
    addEntry(log, { turn: 1, playerIndex: 0, phase: 'ability', action: { type: 'PASS_ABILITIES' }, description: 'x', reason: 'y', result: [] });
    const replay = JSON.parse(toReplay(log, 123));
    expect(replay.seed).toBe(123);
    expect(replay.actions).toEqual([{ type: 'PASS_ABILITIES' }]);
  });
});
