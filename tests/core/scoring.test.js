import { describe, it, expect } from 'vitest';
import { getFoulCount, getPlayerScore, getResults, getWinners } from '../../js/core/scoring.js';
import { makeState, makePlayer } from '../helpers.js';

describe('scoring.js 终局计分', () => {
  it('得分 = 钓获分值之和', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['sardine', 'dayOctopus', 'kraken']), makePlayer(1, 'B')],
    });
    // 1 + 3 + 8 = 12
    expect(getPlayerScore(state, 0)).toBe(12);
  });

  it('钓到最多污秽鱼的玩家额外 -2 分', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['jellyfish', 'kelpie', 'eversquid']), // 3 污秽
        makePlayer(1, 'B', ['sardine', 'clownfish', 'dayOctopus']), // 0 污秽
      ],
    });
    // A: 1+7+6=14，污秽最多 → 12
    expect(getFoulCount(state, 0)).toBe(3);
    expect(getPlayerScore(state, 0)).toBe(12);
    expect(getPlayerScore(state, 1)).toBe(6);
  });

  it('并列最多污秽鱼时都扣 2 分', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['jellyfish', 'kelpie']), // 2 污秽
        makePlayer(1, 'B', ['eversquid', 'mermaid']), // 2 污秽
      ],
    });
    expect(getPlayerScore(state, 0)).toBe(6); // 1+7-2
    expect(getPlayerScore(state, 1)).toBe(8); // 6+4-2
  });

  it('无人钓到污秽鱼时不扣分', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['sardine', 'dayOctopus']), makePlayer(1, 'B', ['clownfish'])],
    });
    expect(getPlayerScore(state, 0)).toBe(4);
    expect(getPlayerScore(state, 1)).toBe(2);
  });

  it('getWinners 返回最高分玩家；并列时返回多个（平局）', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['sardine', 'dayOctopus', 'kraken']), // 12
        makePlayer(1, 'B', ['oarfish', 'giantOctopus', 'clownfish']), // 6+5+2=13
      ],
    });
    expect(getWinners(state)).toEqual([1]);

    const tie = makeState({
      players: [
        makePlayer(0, 'A', ['sardine', 'dayOctopus', 'kraken']), // 12
        makePlayer(1, 'B', ['oarfish', 'giantOctopus', 'clownfish']), // 13
        makePlayer(2, 'C', ['oarfish', 'giantOctopus', 'clownfish']), // 13
      ],
    });
    expect(getWinners(tie)).toEqual([1, 2]);
  });

  it('getResults 返回完整结算明细', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['sardine']), makePlayer(1, 'B', ['jellyfish'])],
    });
    const results = getResults(state);
    expect(results).toHaveLength(2);
    expect(results[0].caught[0].id).toBe('sardine');
    expect(results[0].foulCount).toBe(0);
    expect(results[1].foulCount).toBe(1);
  });
});
