import { describe, expect, it } from 'vitest';

import { describeRatingShift, runtimeBandFor, tasteConfidenceForOverlap } from './stats-logic';

describe('taste history interpretation', () => {
  it('labels overlap without inventing a percentage', () => {
    expect(tasteConfidenceForOverlap(9)).toBe('limited');
    expect(tasteConfidenceForOverlap(10)).toBe('emerging');
    expect(tasteConfidenceForOverlap(25)).toBe('established');
  });

  it('keeps runtime boundaries deterministic', () => {
    expect(runtimeBandFor(89)).toBe('Under 90 min');
    expect(runtimeBandFor(90)).toBe('90–120 min');
    expect(runtimeBandFor(151)).toBe('Over 150 min');
  });

  it('refuses a taste-change claim when the sample or shift is too small', () => {
    expect(describeRatingShift(6, 7, 7)).toBeNull();
    expect(describeRatingShift(6, 6.4, 20)).toBeNull();
    expect(describeRatingShift(6, 6.8, 20)).toMatch(/more generous/);
  });
});
