import { describe, expect, it } from 'vitest';

import { availabilityScore, bestPollOption } from './screening-poll';

describe('screening availability ranking', () => {
  it('weights a firm yes above a maybe', () => {
    expect(availabilityScore({ yes: 3, maybe: 1, no: 4 })).toBe(7);
    expect(availabilityScore({ yes: 2, maybe: 3, no: 0 })).toBe(7);
  });

  it('prefers more firm yes responses, then the earlier time, when scores tie', () => {
    const result = bestPollOption([
      { id: 'later', startsAt: '2026-09-12T00:00:00.000Z', yes: 2, maybe: 3, no: 0 },
      { id: 'earlier', startsAt: '2026-09-10T00:00:00.000Z', yes: 3, maybe: 1, no: 2 },
    ]);
    expect(result?.id).toBe('earlier');
  });

  it('handles an empty poll without inventing a winner', () => {
    expect(bestPollOption([])).toBeNull();
  });
});
