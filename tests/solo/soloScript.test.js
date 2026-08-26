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
    ['oarfish', 'lamprey'],
    ['snowEel', 'lamprey'],
    ['manOWar', 'lamprey'],
    ['lionfish', 'lamprey'],
    ['sealMan', 'lamprey'],
    ['banshee', 'lamprey'],
  ];
}

describe('soloScript: 固定卡组', () => {
  it('目标清单恰为 6 张固定卡牌（按优先级从高到低）', () => {
    expect(TARGETS).toHaveLength(6);
    expect(TARGETS).toEqual(['kraken', 'kelpie', 'oarfish', 'everSquid', 'barracuda', 'mermaid']);
  });

  it('目标清单内每张卡都存在且为合法卡', () => {
    for (const id of TARGETS) {
      expect(CARD_BY_ID[id]).toBeTruthy();
    }
  });

  it('isTarget / targetPriority 与清单一致', () => {
    expect(isTarget('kraken')).toBe(true);
    expect(isTarget('lamprey')).toBe(false);
    expect(targetPriority('kraken')).toBe(0);
    expect(targetPriority('mermaid')).toBe(5);
    expect(targetPriority('lamprey')).toBe(Infinity);
  });
});

describe('soloScript: 能力阶段剧本', () => {
  it('按固定顺序发动已钓且未横置的能力鱼（皇带鱼优先于七鳃鳗）', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['oarfish', 'lamprey']), makePlayer(1, '玩家')],
      currentPlayer: 0,
    });
    expect(chooseScriptAction(state)).toEqual({ type: 'USE_ABILITY', cardId: 'oarfish' });
  });

  it('已横置的能力鱼不再发动，继续尝试下一条', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['oarfish', 'lamprey'], ['oarfish']), makePlayer(1, '玩家')],
      currentPlayer: 0,
    });
    expect(chooseScriptAction(state)).toEqual({ type: 'USE_ABILITY', cardId: 'lamprey' });
  });

  it('无能力鱼时跳过能力阶段', () => {
    const state = makeState({
      phase: PHASE.ABILITY,
      players: [makePlayer(0, SCRIPT_NAME, ['barracuda', 'rotfish']), makePlayer(1, '玩家')],
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
        ['kraken', 'lamprey', 'lamprey'], // 顶牌为目标（优先级 0）
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
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
        ['lamprey', 'kraken', 'lamprey'], // 次顶牌为目标
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
        ['lamprey', 'lamprey', 'lamprey'],
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
      players: [makePlayer(0, SCRIPT_NAME, ['severedFoot', 'rotfish']), makePlayer(1, '玩家')], // 4 钩
      currentPlayer: 0,
      drawn: ['barracuda', 'lamprey'], // barracuda 为目标，lamprey 非目标
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
      players: [makePlayer(0, SCRIPT_NAME, ['severedFoot', 'rotfish']), makePlayer(1, '玩家')], // 4 钩
      currentPlayer: 0,
      drawn: ['manOWar', 'snowEel'], // 均非目标；snowEel 2 分 > manOWar 0 分，且都非污秽
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('CATCH');
    expect(action.cardId).toBe('snowEel');
  });

  it('无可钓牌时先放回污秽牌', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')], // 0 钩
      currentPlayer: 0,
      drawn: ['sealMan', 'oarfish'], // 均需钩数，0 钩不可钓；sealMan 为污秽
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('THROW_BACK');
    expect(action.cardId).toBe('sealMan'); // 污秽优先放回
    expect(typeof action.shoalIndex).toBe('number');
  });

  it('无可钓牌且无污秽时放回第一张', () => {
    const state = makeState({
      phase: PHASE.CATCH,
      players: [makePlayer(0, SCRIPT_NAME), makePlayer(1, '玩家')], // 0 钩
      currentPlayer: 0,
      drawn: ['oarfish', 'manOWar'], // 均需钩数，0 钩不可钓，且都非污秽
      drawnFrom: [0, 1],
      shoals: fullShoals(),
    });
    const action = chooseScriptAction(state);
    expect(action.type).toBe('THROW_BACK');
    expect(action.cardId).toBe('oarfish');
  });
});