import { describe, expect, it } from 'vitest';

import { confidenceLabel, consecutiveEligibleDays, surfaceAvailable, surfaceEligible, type NetworkMetrics } from './network';

const base: NetworkMetrics = { eligiblePublicProfiles: 24, substantialPublicLists: 39, substantialListCreators: 9, activePublicClubs: 7, monthlyActiveUsers: 49, publicContributions90d: 499, publicContributors90d: 24 };

describe('Network evidence gates', () => {
  it('requires every published threshold exactly', () => {
    expect(surfaceEligible('people', base)).toBe(false);
    expect(surfaceEligible('people', { ...base, eligiblePublicProfiles: 25 })).toBe(true);
    expect(surfaceEligible('community_lists', { ...base, substantialPublicLists: 40, substantialListCreators: 10 })).toBe(true);
    expect(surfaceEligible('public_clubs', { ...base, activePublicClubs: 8 })).toBe(true);
    expect(surfaceEligible('community_trends', { ...base, monthlyActiveUsers: 50, publicContributions90d: 500, publicContributors90d: 25 })).toBe(true);
  });

  it('requires seven consecutive eligible dates in auto mode', () => {
    const days = Array.from({ length: 7 }, (_, index) => ({ day: `2026-08-${String(21 + index).padStart(2, '0')}`, eligible: true }));
    expect(consecutiveEligibleDays(days.slice(1), '2026-08-27')).toBe(6);
    expect(surfaceAvailable({ mode: 'auto', unlockedAt: null, consecutiveEligibleDays: 6 })).toBe(false);
    expect(consecutiveEligibleDays(days, '2026-08-27')).toBe(7);
    expect(surfaceAvailable({ mode: 'auto', unlockedAt: null, consecutiveEligibleDays: 7 })).toBe(true);
  });

  it('keeps an automatic unlock sticky unless an admin forces it off', () => {
    const unlockedAt = new Date('2026-08-27T00:00:00Z');
    expect(surfaceAvailable({ mode: 'auto', unlockedAt, consecutiveEligibleDays: 0 })).toBe(true);
    expect(surfaceAvailable({ mode: 'forced_off', unlockedAt, consecutiveEligibleDays: 7 })).toBe(false);
    expect(surfaceAvailable({ mode: 'forced_on', unlockedAt: null, consecutiveEligibleDays: 0 })).toBe(true);
  });

  it('never makes a taste claim below ten shared ratings', () => {
    expect(confidenceLabel(9)).toBeNull();
    expect(confidenceLabel(10)).toBe('emerging');
    expect(confidenceLabel(20)).toBe('useful');
    expect(confidenceLabel(50)).toBe('strong');
  });
});
