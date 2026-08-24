import { describe, it, expect } from 'vitest';
import { createRng } from '../../js/utils/rng.js';

describe('rng.js 可注入种子随机数', () => {
  it('同一种子产生同一序列（可复现）', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('不同种子通常产生不同序列', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('int(max) 返回 [0, max) 整数', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('shuffle 返回原数组的排列（不修改原数组）', () => {
    const rng = createRng(9);
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    const out = rng.shuffle(arr);
    expect(arr).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(arr);
  });

  it('pick 返回数组中的元素', () => {
    const rng = createRng(3);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});
