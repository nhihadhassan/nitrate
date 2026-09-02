import { describe, expect, it } from 'vitest';

import { normalizeTonightOffset, paginateTonightPool } from './tonight';

describe('Tonight batching', () => {
  it('normalizes offsets to bounded groups of three', () => {
    expect(normalizeTonightOffset(undefined)).toBe(0);
    expect(normalizeTonightOffset('2')).toBe(0);
    expect(normalizeTonightOffset('4')).toBe(3);
    expect(normalizeTonightOffset('-20')).toBe(0);
    expect(normalizeTonightOffset('not-a-number')).toBe(0);
    expect(normalizeTonightOffset('1000')).toBe(99);
  });

  it.each([
    { size: 3, batches: [[0, 1, 2]] },
    { size: 6, batches: [[0, 1, 2], [3, 4, 5]] },
    { size: 10, batches: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]] },
  ])('walks a pool of $size without repeats', ({ size, batches }) => {
    const pool = Array.from({ length: size }, (_, index) => index);
    const seen = new Set<number>();

    batches.forEach((expected, batch) => {
      const result = paginateTonightPool(pool, batch * 3);
      expect(result.items).toEqual(expected);
      for (const item of result.items) {
        expect(seen.has(item)).toBe(false);
        seen.add(item);
      }
    });
    expect(seen.size).toBe(size);
  });

  it('clamps a huge offset to the final useful batch', () => {
    expect(paginateTonightPool([0, 1, 2, 3, 4], 1000)).toEqual({
      items: [3, 4],
      offset: 3,
      totalEligible: 5,
      hasMore: false,
    });
  });
});
