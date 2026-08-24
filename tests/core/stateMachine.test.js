import { describe, it, expect } from 'vitest';
import { applyAction, ACTION, PHASE } from '../../js/core/stateMachine.js';
import { createInitialState } from '../../js/core/gameState.js';
import { getLegalThrowTargets } from '../../js/core/rules.js';
import { CARD_BY_ID } from '../../js/core/cards.js';
import { makeState, makePlayer } from '../helpers.js';

describe('stateMachine.js 状态机', () => {
  it('PASS_ABILITIES：ability → draw', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
    const { state: s2, error } = applyAction(state, { type: ACTION.PASS_ABILITIES });
    expect(error).toBeUndefined();
    expect(s2.phase).toBe(PHASE.DRAW);
  });

  it('DRAW：抽牌数量校验与阶段流转', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
    const s = applyAction(state, { type: ACTION.PASS_ABILITIES }).state;
    const bad = applyAction(s, { type: ACTION.DRAW, from: [0] });
    expect(bad.error).toContain('需抽 2');
    const ok = applyAction(s, { type: ACTION.DRAW, from: [0, 1] });
    expect(ok.error).toBeUndefined();
    expect(ok.state.phase).toBe(PHASE.CATCH);
    expect(ok.state.drawn).toHaveLength(2);
    expect(ok.state.shoals[0]).toHaveLength(2);
    expect(ok.state.shoals[1]).toHaveLength(2);
  });

  it('USE_ABILITY：能力阶段发动能力并横置该鱼', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B')],
    });
    const res = applyAction(state, { type: ACTION.USE_ABILITY, cardId: 'lamprey' });
    expect(res.error).toBeUndefined();
    expect(res.state.extraDraw).toBe(1);
    expect(res.state.players[0].exhausted).toContain('lamprey');
    // 已横置的鱼不能再次发动
    const again = applyAction(res.state, { type: ACTION.USE_ABILITY, cardId: 'lamprey' });
    expect(again.error).toContain('已横置');
  });

  it('CATCH：只能钓可钓的牌，且每回合只能钓一条', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B')], // 1 钩
      shoals: [['sardine', 'lamprey', 'kraken'], ['clownfish', 'oarfish', 'kelpie'], ['pufferfish'], [], [], []],
    });
    state.phase = PHASE.CATCH;
    state.drawn = ['sardine', 'kraken'];
    const bad = applyAction(state, { type: ACTION.CATCH, cardId: 'kraken' });
    expect(bad.error).toContain('钩数不足');
    const ok = applyAction(state, { type: ACTION.CATCH, cardId: 'sardine' });
    expect(ok.error).toBeUndefined();
    expect(ok.state.players[0].caught).toContain('sardine');
    expect(ok.state.caughtThisTurn).toBe(true);
  });

  it('THROW_BACK：有可钓牌时必须先钓走；放回目标必须合法', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B')],
      // 已从浅滩 0 抽出 sardine、kraken 两张牌后的状态
      shoals: [['lamprey'], ['clownfish', 'oarfish', 'kelpie'], ['pufferfish'], [], [], []],
    });
    state.phase = PHASE.CATCH;
    state.drawn = ['sardine', 'kraken'];
    // 有可钓的 sardine，不能直接放生
    const bad = applyAction(state, { type: ACTION.THROW_BACK, cardId: 'kraken', shoalIndex: 3 });
    expect(bad.error).toContain('必须先钓走');
    // 钓走 sardine 后放生 kraken：有空浅滩时必须放回空浅滩
    const afterCatch = applyAction(state, { type: ACTION.CATCH, cardId: 'sardine' }).state;
    const badTarget = applyAction(afterCatch, { type: ACTION.THROW_BACK, cardId: 'kraken', shoalIndex: 0 });
    expect(badTarget.error).toContain('不是合法的放回目标');
    const throwOk = applyAction(afterCatch, { type: ACTION.THROW_BACK, cardId: 'kraken', shoalIndex: 3 });
    expect(throwOk.error).toBeUndefined();
    expect(throwOk.state.shoals[3][0]).toBe('kraken');
    expect(throwOk.state.drawn).toHaveLength(0);
  });

  it('完整对局可推进到终局（贪心策略驱动）', () => {
    const state = createInitialState({ seed: 42, playerNames: ['A', 'B'] });
    let s = state;
    let guard = 0;
    while (!s.gameOver && guard++ < 2000) {
      if (s.phase === PHASE.ABILITY) {
        s = applyAction(s, { type: ACTION.PASS_ABILITIES }).state;
      } else if (s.phase === PHASE.DRAW) {
        const drawable = s.shoals.map((sh, i) => (sh.length > 0 ? i : -1)).filter((i) => i >= 0);
        const hooks = s.players[s.currentPlayer].caught.reduce((sum, cid) => sum + CARD_BY_ID[cid].hooks, 0);
        // 优先从"顶 2 张含可钓牌"的浅滩抽，确保对局能推进
        const preferred = drawable.filter((i) =>
          s.shoals[i].slice(0, 2).some((id) => hooks >= CARD_BY_ID[id].strength)
        );
        const pool = preferred.length > 0 ? preferred : drawable;
        const first = pool[0];
        const second = drawable.find((i) => i !== first) ?? first;
        const from =
          drawable.length === 1 ? [first] : s.shoals[first].length >= 2 ? [first, first] : [first, second];
        s = applyAction(s, { type: ACTION.DRAW, from }).state;
      } else if (s.phase === PHASE.CATCH) {
        const hooks = s.players[s.currentPlayer].caught.reduce((sum, cid) => sum + CARD_BY_ID[cid].hooks, 0);
        const catchable = s.drawn.filter((id) => hooks >= CARD_BY_ID[id].strength);
        if (catchable.length > 0 && !s.caughtThisTurn) {
          s = applyAction(s, { type: ACTION.CATCH, cardId: catchable[0] }).state;
        } else {
          const legal = getLegalThrowTargets(s);
          s = applyAction(s, { type: ACTION.THROW_BACK, cardId: s.drawn[0], shoalIndex: legal[0] }).state;
        }
      }
    }
    expect(s.gameOver).toBe(true);
    expect(s.phase).toBe(PHASE.GAME_OVER);
    expect(Array.isArray(s.winner)).toBe(true);
    expect(s.actions.length).toBeGreaterThan(0);
  });

  it('非法动作返回错误且不产生脏状态', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
    const before = JSON.stringify(state);
    const res = applyAction(state, { type: ACTION.CATCH, cardId: 'sardine' });
    expect(res.error).toBeTruthy();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('动作序列被记录（可回放）', () => {
    const state = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
    const s = applyAction(state, { type: ACTION.PASS_ABILITIES }).state;
    expect(s.actions).toHaveLength(1);
    expect(s.actions[0]).toMatchObject({ player: 0, turn: 1, action: { type: ACTION.PASS_ABILITIES } });
  });
});
