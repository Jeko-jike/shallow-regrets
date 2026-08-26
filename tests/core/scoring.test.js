import { describe, it, expect } from 'vitest';
import { getFoulCount, getPlayerScore, getResults, getWinners } from '../../js/core/scoring.js';
import { makeState, makePlayer } from '../helpers.js';

describe('scoring.js 终局计分', () => {
  it('得分 = 钓获分值之和（无污秽惩罚时不扣分）', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey', 'dayOctopus', 'greatWhite']), makePlayer(1, 'B')],
    });
    // 1 + 1 + 3 = 5，全部正品，无污秽惩罚
    expect(getPlayerScore(state, 0)).toBe(5);
    expect(getPlayerScore(state, 1)).toBe(0);
  });

  it('钓到最多污秽鱼的玩家额外 -2 分', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['kelpie', 'everSquid', 'sealMan']), // 3 污秽，4+2+3=9
        makePlayer(1, 'B', ['lamprey', 'dayOctopus', 'greatWhite']), // 0 污秽
      ],
    });
    // A: 9，污秽最多 → 7
    expect(getFoulCount(state, 0)).toBe(3);
    expect(getPlayerScore(state, 0)).toBe(7);
    expect(getPlayerScore(state, 1)).toBe(5);
  });

  it('并列最多污秽鱼时都扣 2 分', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['kelpie', 'everSquid']), // 2 污秽，4+2=6
        makePlayer(1, 'B', ['kraken', 'sealMan']), // 2 污秽，5+3=8
      ],
    });
    expect(getPlayerScore(state, 0)).toBe(4); // 6-2
    expect(getPlayerScore(state, 1)).toBe(6); // 8-2
  });

  it('无人钓到污秽鱼时不扣分', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey', 'dayOctopus']), makePlayer(1, 'B', ['barracuda'])],
    });
    expect(getPlayerScore(state, 0)).toBe(2);
    expect(getPlayerScore(state, 1)).toBe(0);
  });

  it('getWinners 返回最高分玩家；并列时返回多个（平局）', () => {
    const state = makeState({
      players: [
        makePlayer(0, 'A', ['lamprey', 'dayOctopus', 'greatWhite']), // 5
        makePlayer(1, 'B', ['lamprey', 'barracuda', 'oarfish', 'snowEel']), // 1+0+2+2=5
      ],
    });
    expect(getWinners(state)).toEqual([0, 1]);

    const tie = makeState({
      players: [
        makePlayer(0, 'A', ['lamprey']), // 1
        makePlayer(1, 'B', ['lamprey', 'barracuda', 'oarfish', 'snowEel']), // 5
        makePlayer(2, 'C', ['lamprey', 'dayOctopus', 'greatWhite']), // 5
      ],
    });
    expect(getWinners(tie)).toEqual([1, 2]);
  });

  it('getResults 返回完整结算明细', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B', ['kelpie'])],
    });
    const results = getResults(state);
    expect(results).toHaveLength(2);
    expect(results[0].caught[0].id).toBe('lamprey');
    expect(results[0].foulCount).toBe(0);
    expect(results[1].foulCount).toBe(1);
  });
});