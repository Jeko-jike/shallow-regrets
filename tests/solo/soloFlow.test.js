/**
 * M5 Solo 流程测试：确定性、脚本回合推进、玩家回合校验、结算评价与特色机制。
 */
import { describe, it, expect } from 'vitest';
import { SoloController } from '../../js/solo/soloFlow.js';
import { SCRIPT_NAME } from '../../js/solo/soloScript.js';
import { PHASE } from '../../js/core/stateMachine.js';
import { chooseAction } from '../../js/ai/heuristicAI.js';
import { CARD_BY_ID } from '../../js/core/cards.js';

/** 驱动一局到终局：脚本回合用 runScriptAction，玩家回合用启发式 AI 代替（仅测试用） */
function runToEnd(seed, first = 'player') {
  const c = new SoloController({ playerName: '你', seed, first });
  let guard = 0;
  while (c.state.phase !== PHASE.GAME_OVER && guard++ < 500) {
    if (c.isScriptTurn()) {
      if (!c.runScriptAction()) break;
    } else if (c.isPlayerTurn()) {
      const action = chooseAction(c.state);
      if (!action || c.dispatch(action)) break;
    } else {
      break;
    }
  }
  return c;
}

describe('SoloController: 先后手与回合', () => {
  it('玩家先手时初始为玩家回合，玩家在索引 0', () => {
    const c = new SoloController({ playerName: '你', seed: 1, first: 'player' });
    expect(c.isPlayerTurn()).toBe(true);
    expect(c.state.players[0].name).toBe('你');
    expect(c.state.players[1].name).toBe(SCRIPT_NAME);
  });

  it('脚本先手时初始为脚本回合，脚本在索引 0', () => {
    const c = new SoloController({ playerName: '你', seed: 1, first: 'script' });
    expect(c.isScriptTurn()).toBe(true);
    expect(c.state.players[0].name).toBe(SCRIPT_NAME);
    expect(c.state.players[1].name).toBe('你');
  });

  it('脚本回合可推进（runScriptAction 返回 true 且阶段变化）', () => {
    const c = new SoloController({ playerName: '你', seed: 1, first: 'script' });
    const before = c.state.phase;
    expect(c.runScriptAction()).toBe(true);
    expect(c.state.phase).not.toBe(before);
  });

  it('玩家回合派发非法动作被拒绝且状态不变', () => {
    const c = new SoloController({ playerName: '你', seed: 1, first: 'player' });
    const before = c.state;
    const err = c.dispatch({ type: 'DRAW', from: [] }); // 能力阶段不可抽牌
    expect(err).toBeTruthy();
    expect(c.state).toBe(before);
  });
});

describe('SoloController: 确定性', () => {
  it('同一 seed 终局状态完全一致', () => {
    const a = runToEnd(123);
    const b = runToEnd(123);
    expect(a.state).toEqual(b.state);
  });

  it('多 seed 均能推进到终局（防死锁）', () => {
    for (const seed of [1, 7, 42, 999, 20260825]) {
      const c = runToEnd(seed);
      expect(c.state.phase, `seed=${seed} 未终局`).toBe(PHASE.GAME_OVER);
    }
  });
});

describe('SoloController: 结算评价', () => {
  it('getEvaluation 返回星级/等级/目标结构', () => {
    const c = runToEnd(42);
    const ev = c.getEvaluation();
    expect(ev.stars).toBeGreaterThanOrEqual(0);
    expect(ev.stars).toBeLessThanOrEqual(4);
    expect(['浅滩之耻', '勉强及格', '合格渔夫', '深海传奇']).toContain(ev.rank);
    expect(typeof ev.goals.beatScript).toBe('boolean');
    expect(typeof ev.goals.caughtKraken).toBe('boolean');
    expect(typeof ev.goals.noFoul).toBe('boolean');
    expect(typeof ev.goals.grabbedTargets).toBe('boolean');
    expect(ev.myResult).toBeTruthy();
    expect(ev.scriptResult).toBeTruthy();
  });

  it('getLiveGoals 返回带进度文本的目标（对局中可实时展示）', () => {
    const c = new SoloController({ playerName: '你', seed: 42, first: 'player' });
    const goals = c.getLiveGoals();
    expect(typeof goals.beatScript.done).toBe('boolean');
    expect(typeof goals.beatScript.text).toBe('string');
    expect(typeof goals.grabbedTargets.text).toBe('string');
    expect(goals.grabbedTargets.text).toMatch(/\/3$/);
  });

  it('回归：开局时 noFoul 目标为"进行中"而非自动达成', () => {
    const c = new SoloController({ playerName: '你', seed: 42, first: 'player' });
    const goals = c.getLiveGoals();
    expect(goals.noFoul.done).toBe(false);
    expect(goals.noFoul.status).toBe('progress');
    // 钓到污秽鱼后立即转失败
    c.state.players[c.playerIndex].caught = ['rotfish'];
    const failed = c.getLiveGoals();
    expect(failed.noFoul.status).toBe('failed');
    expect(failed.noFoul.done).toBe(false);
    // 全部目标带三态 status 字段
    for (const g of Object.values(c.getLiveGoals())) {
      expect(['progress', 'failed', 'done']).toContain(g.status);
    }
  });

  it('终局时 noFoul 仅在全程无污秽时达成（与结算评价一致）', () => {
    const c = runToEnd(42);
    const goals = c.getLiveGoals();
    const foulCount = c.state.players[c.playerIndex].caught.filter((id) => CARD_BY_ID[id].type === 'foul').length;
    expect(goals.noFoul.status).toBe(foulCount > 0 ? 'failed' : 'done');
    expect(goals.noFoul.done).toBe(foulCount === 0);
    expect(c.getEvaluation().goals.noFoul).toBe(foulCount === 0);
  });

  it('星级与目标达成数一致（0-4 星）', () => {
    const c = runToEnd(7);
    const ev = c.getEvaluation();
    const doneCount = Object.values(ev.goals).filter(Boolean).length;
    expect(ev.stars).toBe(doneCount);
  });
});
