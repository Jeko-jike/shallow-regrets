import { describe, it, expect } from 'vitest';
import { applyAction, ACTION, PHASE } from '../../js/core/stateMachine.js';
import { createInitialState } from '../../js/core/gameState.js';
import { canCatch, getLegalThrowTargets, getRequiredDrawCount } from '../../js/core/rules.js';
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
    expect(ok.state.shoals[0]).toHaveLength(3);
    expect(ok.state.shoals[1]).toHaveLength(3);
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
    });
    state.phase = PHASE.CATCH;
    state.drawn = ['lamprey', 'kraken'];
    const bad = applyAction(state, { type: ACTION.CATCH, cardId: 'kraken' });
    expect(bad.error).toContain('无法钓走');
    const ok = applyAction(state, { type: ACTION.CATCH, cardId: 'lamprey' });
    expect(ok.error).toBeUndefined();
    expect(ok.state.players[0].caught).toContain('lamprey');
    expect(ok.state.caughtThisTurn).toBe(true);
  });

  it('THROW_BACK：有可钓牌时必须先钓走；放回目标必须合法', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B')], // 1 钩
      // 浅滩0 满4张，其余为空 → 放回时空浅滩优先，浅滩0 非合法目标
      shoals: [['lamprey', 'lamprey', 'lamprey', 'lamprey'], [], [], [], [], []],
    });
    state.phase = PHASE.CATCH;
    state.drawn = ['lamprey', 'kraken'];
    // 有可钓的 lamprey，不能直接放生
    const bad = applyAction(state, { type: ACTION.THROW_BACK, cardId: 'kraken', shoalIndex: 3 });
    expect(bad.error).toContain('必须先钓走');
    // 钓走 lamprey 后放生 kraken：有空浅滩时必须放回空浅滩
    const afterCatch = applyAction(state, { type: ACTION.CATCH, cardId: 'lamprey' }).state;
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
    while (!s.gameOver && guard++ < 5000) {
      let action;
      if (s.phase === PHASE.ABILITY) {
        action = { type: ACTION.PASS_ABILITIES };
      } else if (s.phase === PHASE.DRAW) {
        const required = getRequiredDrawCount(s);
        const drawable = s.shoals.map((sh, i) => (sh.length > 0 ? i : -1)).filter((i) => i >= 0);
        action = { type: ACTION.DRAW, from: drawable.slice(0, required) };
      } else if (s.phase === PHASE.CATCH) {
        const catchable = s.drawn.filter((id) => canCatch(s, s.currentPlayer, id));
        if (catchable.length > 0 && !s.caughtThisTurn) {
          action = { type: ACTION.CATCH, cardId: catchable[0] };
        } else if (s.drawn.length > 0) {
          const legal = getLegalThrowTargets(s);
          action = { type: ACTION.THROW_BACK, cardId: s.drawn[0], shoalIndex: legal[0] };
        }
      } else if (s.phase === PHASE.PENDING) {
        const pend = s.pending;
        const resolution = pend.type === 'REARRANGE'
          ? { order: pend.cards }
          : { use: false, pick: null };
        action = { type: ACTION.RESOLVE, resolution };
      }
      if (!action) throw new Error(`卡在阶段 ${s.phase}`);
      const res = applyAction(s, action);
      if (res.error) throw new Error(`greedy 驱动失败: ${res.error}`);
      s = res.state;
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
