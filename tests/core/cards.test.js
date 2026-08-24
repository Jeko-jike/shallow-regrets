import { describe, it, expect } from 'vitest';
import { CARDS, CARD_BY_ID, TOTAL_CARDS } from '../../js/core/cards.js';
import { ABILITY_TYPES } from '../../js/core/abilities.js';

describe('cards.js 卡牌数据', () => {
  it('恰好 18 张卡牌', () => {
    expect(TOTAL_CARDS).toBe(18);
    expect(CARDS).toHaveLength(18);
  });

  it('id 唯一且 CARD_BY_ID 索引完整', () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(18);
    for (const c of CARDS) {
      expect(CARD_BY_ID[c.id]).toBe(c);
    }
  });

  it('字段符合 schema：分值数字、强度 0-5、类型 fair/foul、能力合法或 null', () => {
    for (const c of CARDS) {
      expect(typeof c.points).toBe('number');
      expect(c.strength).toBeGreaterThanOrEqual(0);
      expect(c.strength).toBeLessThanOrEqual(5);
      expect(['fair', 'foul']).toContain(c.type);
      expect(c.ability === null || Object.values(ABILITY_TYPES).includes(c.ability)).toBe(true);
      expect(typeof c.art).toBe('string');
    }
  });

  it('至少 6 张 strength=0 的小鱼（保证开局可满足"至少3个浅滩小阴影"）', () => {
    const small = CARDS.filter((c) => c.strength === 0);
    expect(small.length).toBeGreaterThanOrEqual(6);
  });

  it('存在污秽鱼（foul），且分值分布合理', () => {
    const foul = CARDS.filter((c) => c.type === 'foul');
    expect(foul.length).toBeGreaterThanOrEqual(4);
    const fair = CARDS.filter((c) => c.type === 'fair');
    expect(fair.length).toBe(18 - foul.length);
  });

  it('能力类型覆盖 6 种能力', () => {
    const used = new Set(CARDS.filter((c) => c.ability).map((c) => c.ability));
    for (const t of Object.values(ABILITY_TYPES)) {
      expect(used.has(t)).toBe(true);
    }
  });
});
