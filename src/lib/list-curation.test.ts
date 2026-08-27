import { describe, expect, it } from 'vitest';

import { invitationIsExpired, isCompleteReorder, planListTransfer } from './list-curation';

describe('shared list curation', () => {
  it('accepts only a complete, duplicate-free reorder', () => {
    expect(isCompleteReorder(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
    expect(isCompleteReorder(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
    expect(isCompleteReorder(['a', 'b', 'c'], ['a', 'a', 'c'])).toBe(false);
    expect(isCompleteReorder(['a', 'b'], ['a', 'x'])).toBe(false);
  });

  it('caps transfers at 25 and skips existing Movie Ideas', () => {
    expect(planListTransfer(['a', 'b', 'b', 'c'], ['b'])).toEqual({
      selected: ['a', 'b', 'c'],
      additions: ['a', 'c'],
      skipped: 1,
    });
    expect(() => planListTransfer(Array.from({ length: 26 }, (_, index) => String(index)), [])).toThrow(/25/);
  });

  it('treats the exact expiry instant as expired', () => {
    const expiry = new Date('2026-09-01T12:00:00.000Z');
    expect(invitationIsExpired(expiry, new Date('2026-09-01T11:59:59.999Z'))).toBe(false);
    expect(invitationIsExpired(expiry, new Date('2026-09-01T12:00:00.000Z'))).toBe(true);
  });
});
