/**
 * M5 脚本对手测试：固定卡组、剧本分支（能力/抽牌/钓走/放回）与特色机制边界。
 */
import { describe, it, expect } from 'vitest';
import { chooseScriptAction, SCRIPT_NAME, TARGETS, isTarget, targetPriority } from '../../js/solo/soloScript.js';
import { makeState, makePlayer } from '../helpers.js';
import { CARD_BY_ID } from '../../js/core/cards.js';
import { PHASE } from '../../js/core/stateMachine.js';

/** 构造 6 个非空且未满（2 张）的浅滩（顶牌均为 strength>=1 的大阴影，保证放回目标合法） */
function fullShoals() {
  return [
    ['stingray', 'sardine'],
    ['lamprey', 'clownfish'],
    ['dayOctopus', 'pufferfish'],
    ['barracuda', 'lanternfish'],
    ['morayEel', 'jellyfish'],
    ['giantOctopus', 'foot'],
  ];
}

describe('soloScript: 固定卡组', () => {
  it('目标清单恰为 6 张固定卡牌（按优先级从高到低）', () => {
    expect(TARGETS).toHaveLength(6);
    expect(TARGETS).toEqual(['kraken', 'kelpie', 'oarfish', 'eversquid', 'barracuda', 'morayEel']);
  });

  it('目标清单内每张卡都存在且为合法卡', () => {
    for (const id of TARGETS) {
      expect(CARD_BY_ID[id]).toBeTruthy();
    }
  });

  it('isTarget / targetPriority 与清单一致', () => {
    expect(isTarget('kraken')).toBe(true);
    expect(isTarget('sardine')).toBe(false);
    expect(targetPriority('kraken')).toBe(0);
    expect(targetPriority('morayEel')).toBe(5);
    expect(targetPriority('sardine')).toBe(Infinity);
  });
});

describe('soloScript: 能力阶段剧本', () => {
  it('按固定顺序发动已钓且未横置的能力鱼（克拉肯优先于皇带鱼）', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['kraken', 'oarfish']), makePlayer(1, '玩家')],
      currentPlayer: 0,
    });
    expect(chooseScriptAction(state)).toEqual({ type: 'USE_ABILITY', cardId: 'kraken' });
  });

  it('已横置的能力鱼不再发动，继续尝试下一条', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['kraken', 'oarfish'], ['kraken']), makePlayer(1, '玩家')],
      currentPlayer: 0,
    });
    expect(chooseScriptAction(state)).toEqual({ type: 'USE_ABILITY', cardId: 'oarfish' });
  });

  it('无能力鱼时跳过能力阶段', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['sardine', 'barracuda']), makePlayer(1, '玩家')],
      currentPlayer: 0,
    });
    expect(chooseScriptAction(state)).toEqual({ type: 'PASS_ABILITIES' });
  });
});

describe('soloScript: 抽牌阶段剧本', () => {
  it('优先从顶牌为目标清单内卡牌的浅滩取牌', () => {
    const state = makeState({
      phase: PHASE.DRAW,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')],
      currentPlayer: 0,
      shoals: [
        ['kraken', 'sardine', 'clownfish'], // 顶牌为目标（优先级 0）
        ['sardine', 'clownfish', 'pufferfish'],
        ['clownfish', 'pufferfish', 'lanternfish'],
        ['pufferfish', 'lanternfish', 'jellyfish'],
        ['lanternfish', 'jellyfish', 'foot'],
        ['jellyfish', 'foot', 'dayOctopus'],
      ],
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('DRAW');
    expect(action.from).toContain(0);
  });

  it('顶牌非目标但次顶牌为目标时也优先该浅滩', () => {
    const state = makeState({
      phase: PHASE.DRAW,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')],
      currentPlayer: 0,
      shoals: [
        ['sardine', 'kraken', 'clownfish'], // 次顶牌为目标
        ['clownfish', 'pufferfish', 'lanternfish'],
        ['pufferfish', 'lanternfish', 'jellyfish'],
        ['lanternfish', 'jellyfish', 'foot'],
        ['jellyfish', 'foot', 'dayOctopus'],
        ['foot', 'dayOctopus', 'stingray'],
      ],
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('DRAW');
    expect(action.from).toContain(0);
  });
});

describe('soloScript: 钓走/放回剧本', () => {
  it('抽到目标清单内可钓牌时按优先级钓走', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME, ['sardine', 'clownfish']), makePlayer(1, '玩家')], // 2 钩
      currentPlayer: 0,
      drawn: ['barracuda', 'sardine'],
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('CATCH');
    expect(action.cardId).toBe('barracuda');
  });

  it('无目标可钓时钓最高分非污秽', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME, ['sardine', 'clownfish']), makePlayer(1, '玩家')], // 2 钩
      currentPlayer: 0,
      drawn: ['stingray', 'jellyfish'],
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('CATCH');
    expect(action.cardId).toBe('stingray'); // 3 分非污秽 > 水母 1 分污秽
  });

  it('无可钓牌时先放回污秽牌', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')], // 0 钩
      currentPlayer: 0,
      drawn: ['eyeBlob', 'stingray'], // 均需钩数，0 钩不可钓
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('THROW_BACK');
    expect(action.cardId).toBe('eyeBlob'); // 污秽优先放回
    expect(typeof action.shoalIndex).toBe('number');
  });

  it('无可钓牌且无污秽时放回第一张', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')], // 0 钩
      currentPlayer: 0,
      drawn: ['stingray', 'lamprey'], // 均需 1 钩，0 钩不可钓
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('THROW_BACK');
    expect(action.cardId).toBe('stingray');
  });
});
