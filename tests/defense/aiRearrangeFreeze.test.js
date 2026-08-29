/**
 * 回归：AI 不应在单张浅滩上发动「眼球团/重排鱼群」（会在 M2 产生待确认弹窗冻结）。
 * 修复：heuristicAI 只选 >1 张的浅滩重排；main.js drainAiPending 自动结算 AI 反应窗口。
 */
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../js/core/gameState.js';
import { PHASE } from '../../js/core/stateMachine.js';
import { chooseAction } from '../../js/ai/heuristicAI.js';

/** 手工构建 ABILITY 阶段状态：把 eyeballBlob 放进玩家 0 已钓区，控制浅滩 */
function abilityStateWith(shoals) {
  const s = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
  s.currentPlayer = 0;
  s.phase = PHASE.ABILITY;
  s.players[0].caught = ['eyeballBlob'];
  s.players[1].caught = [];
  s.shoals = shoals;
  s.drawn = [];
  return s;
}

describe('AI 眼球团重排：单张浅滩不触发', () => {
  it('唯一可重排浅滩仅 1 张牌时，不选 rearrange_shoal', () => {
    const s = abilityStateWith([['hake'], [], [], [], [], []]);
    const action = chooseAction(s);
    const isRearr = action && action.type === 'USE_ABILITY' && action.cardId === 'eyeballBlob';
    expect(isRearr).toBe(false);
  });

  it('存在 >1 张牌的可重排浅滩时，仍会选 rearrange_shoal', () => {
    const s = abilityStateWith([['hake', 'cod'], [], [], [], [], []]);
    const action = chooseAction(s);
    expect(action && action.type === 'USE_ABILITY' && action.cardId === 'eyeballBlob').toBe(true);
  });
});

describe('AI 额外抽牌能力优先（七鳃鳗/皇带鱼不被其它能力挤后）', () => {
  it('同时持额外抽牌与重排能力时，优先发动额外抽牌且受益于额外抽牌', () => {
    const s = abilityStateWith([['hake', 'cod'], [], [], [], [], []]);
    // 手动塞入 priority 更低的能力卡 eyballBlob，再验证优先选额外的 lamprey
    s.players[0].caught = ['eyeballBlob', 'lamprey'];
    const action = chooseAction(s);
    expect(action && action.type === 'USE_ABILITY' && action.cardId === 'lamprey').toBe(true);
  });
});