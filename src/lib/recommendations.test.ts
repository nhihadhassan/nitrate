import { describe, expect, it } from 'vitest';

import {
  canClaimTasteSimilarity,
  feedbackExpiry,
  peopleRecommendationReasons,
  peopleRecommendationScore,
  recommendationReasonLabel,
} from './recommendations';

describe('recommendation explanations', () => {
  it('requires ten shared ratings before claiming a taste signal', () => {
    expect(canClaimTasteSimilarity(9)).toBe(false);
    expect(canClaimTasteSimilarity(10)).toBe(true);
    expect(peopleRecommendationReasons({
      sharedRatings: 9,
      sharedFavourites: [],
      sharedClubs: 0,
      mutualFollows: 1,
    }).map((reason) => reason.kind)).toEqual(['social_proximity']);
  });

  it('uses plain-language reasons without a match percentage', () => {
    const reasons = peopleRecommendationReasons({
      sharedRatings: 14,
      sharedFavourites: ['Moonlight'],
      sharedClubs: 1,
      mutualFollows: 2,
    });
    const labels = reasons.map(recommendationReasonLabel).join(' ');
    expect(labels).toContain('14 shared ratings');
    expect(labels).toContain('Moonlight');
    expect(labels).not.toContain('%');
  });

  it('caps candidate weights so large accounts cannot dominate', () => {
    const capped = peopleRecommendationScore({
      sharedRatings: 30,
      sharedFavourites: ['a', 'b', 'c', 'd'],
      sharedClubs: 3,
      mutualFollows: 5,
    });
    expect(peopleRecommendationScore({
      sharedRatings: 5_000,
      sharedFavourites: Array.from({ length: 100 }, (_, index) => String(index)),
      sharedClubs: 100,
      mutualFollows: 100,
    })).toBe(capped);
  });

  it('uses reversible 90-day and 30-day windows', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(feedbackExpiry('hide', now)?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(feedbackExpiry('less_like_this', now)?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(feedbackExpiry('already_know', now)).toBeNull();
  });
});
