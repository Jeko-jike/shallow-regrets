import { describe, it, expect } from 'vitest';
import { applyAbilityEffect, validateAbilityTarget } from '../../js/core/abilities.js';
import { makeState, makePlayer } from '../helpers.js';
import { createRng } from '../../js/utils/rng.js';
import { CARD_BY_ID } from '../../js/core/cards.js';

const rng = () => createRng(1);

describe('abilities.js 能力效果', () => {
  it('draw_extra：本回合额外抽 1 张', () => {
    const state = makeState({ players: [makePlayer(0, 'A', ['lamprey']), makePlayer(1, 'B')] });
    const { events } = applyAbilityEffect(state, 0, 'draw_extra', null, { rng: rng() });
    expect(state.extraDraw).toBe(1);
    expect(events).toContain('draw_extra');
  });

  it('peek_shoal：记录浅滩顶牌', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lanternfish']), makePlayer(1, 'B')],
      shoals: [['kraken', 'lamprey', 'sardine'], ['clownfish'], [], [], [], []],
    });
    applyAbilityEffect(state, 0, 'peek_shoal', { shoalIndex: 0 }, { rng: rng() });
    expect(state.lastPeek).toEqual({ player: 0, shoalIndex: 0, cardId: 'kraken' });
  });

  it('peek_shoal：空浅滩校验失败', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['lanternfish']), makePlayer(1, 'B')],
      shoals: [[], ['clownfish'], [], [], [], []],
    });
    expect(validateAbilityTarget(state, 0, 'peek_shoal', { shoalIndex: 0 })).toContain('为空');
  });

  it('force_exhaust：横置对方一条鱼；对方免疫时校验失败', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['stingray']), makePlayer(1, 'B', ['dayOctopus'])],
    });
    expect(validateAbilityTarget(state, 0, 'force_exhaust', { cardId: 'dayOctopus' })).toBeNull();
    applyAbilityEffect(state, 0, 'force_exhaust', { cardId: 'dayOctopus' }, { rng: rng() });
    expect(state.players[1].exhausted).toContain('dayOctopus');

    const immune = makeState({
      players: [makePlayer(0, 'A', ['stingray']), makePlayer(1, 'B', ['dayOctopus'], [], true)],
    });
    expect(validateAbilityTarget(immune, 0, 'force_exhaust', { cardId: 'dayOctopus' })).toContain('免疫');
  });

  it('swap_fish：交换双方一条鱼；对方免疫时校验失败', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['dayOctopus', 'sardine']), makePlayer(1, 'B', ['lamprey'])],
    });
    expect(validateAbilityTarget(state, 0, 'swap_fish', { ownCardId: 'sardine', oppCardId: 'lamprey' })).toBeNull();
    applyAbilityEffect(state, 0, 'swap_fish', { ownCardId: 'sardine', oppCardId: 'lamprey' }, { rng: rng() });
    expect(state.players[0].caught).toContain('lamprey');
    expect(state.players[1].caught).toContain('sardine');
    expect(state.players[0].caught).not.toContain('sardine');

    const immune = makeState({
      players: [makePlayer(0, 'A', ['dayOctopus', 'sardine']), makePlayer(1, 'B', ['lamprey'], [], true)],
    });
    expect(validateAbilityTarget(immune, 0, 'swap_fish', { ownCardId: 'sardine', oppCardId: 'lamprey' })).toContain('免疫');
  });

  it('shuffle_shoals：洗乱浅滩，卡牌总数不变，仍满足至少 3 个小阴影顶牌', () => {
    const state = makeState({
      players: [makePlayer(0, 'A', ['kraken']), makePlayer(1, 'B')],
    });
    const before = state.shoals.flat().slice().sort();
    applyAbilityEffect(state, 0, 'shuffle_shoals', null, { rng: createRng(99) });
    const after = state.shoals.flat().slice().sort();
    expect(after).toEqual(before);
    const smallTops = state.shoals.filter((s) => CARD_BY_ID[s[0]].strength <= 0).length;
    expect(smallTops).toBeGreaterThanOrEqual(3);
  });

  it('immunity：本回合免疫', () => {
    const state = makeState({ players: [makePlayer(0, 'A', ['pufferfish']), makePlayer(1, 'B')] });
    applyAbilityEffect(state, 0, 'immunity', null, { rng: rng() });
    expect(state.players[0].immune).toBe(true);
  });
});
