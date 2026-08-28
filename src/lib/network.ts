export const NETWORK_SURFACES = [
  'people',
  'community_lists',
  'public_clubs',
  'community_trends',
] as const;
export type NetworkSurface = (typeof NETWORK_SURFACES)[number];
export type ProductFlagMode = 'auto' | 'forced_on' | 'forced_off';

export type NetworkMetrics = {
  eligiblePublicProfiles: number;
  substantialPublicLists: number;
  substantialListCreators: number;
  activePublicClubs: number;
  monthlyActiveUsers: number;
  publicContributions90d: number;
  publicContributors90d: number;
};

export const NETWORK_THRESHOLDS = {
  people: { eligiblePublicProfiles: 25 },
  community_lists: { substantialPublicLists: 40, substantialListCreators: 10 },
  public_clubs: { activePublicClubs: 8 },
  community_trends: {
    monthlyActiveUsers: 50,
    publicContributions90d: 500,
    publicContributors90d: 25,
  },
} as const;

export const AUTO_UNLOCK_DAYS = 7;

export function surfaceEligible(surface: NetworkSurface, metrics: NetworkMetrics): boolean {
  switch (surface) {
    case 'people':
      return metrics.eligiblePublicProfiles >= 25;
    case 'community_lists':
      return (
        metrics.substantialPublicLists >= 40 && metrics.substantialListCreators >= 10
      );
    case 'public_clubs':
      return metrics.activePublicClubs >= 8;
    case 'community_trends':
      return (
        metrics.monthlyActiveUsers >= 50 &&
        metrics.publicContributions90d >= 500 &&
        metrics.publicContributors90d >= 25
      );
  }
}

export type SurfaceDecisionInput = {
  mode: ProductFlagMode;
  unlockedAt: Date | null;
  consecutiveEligibleDays: number;
};

export function surfaceAvailable(input: SurfaceDecisionInput): boolean {
  if (input.mode === 'forced_off') return false;
  if (input.mode === 'forced_on') return true;
  return Boolean(input.unlockedAt) || input.consecutiveEligibleDays >= AUTO_UNLOCK_DAYS;
}

export function confidenceLabel(
  sharedRatings: number,
): 'emerging' | 'useful' | 'strong' | null {
  if (sharedRatings < 10) return null;
  if (sharedRatings < 20) return 'emerging';
  if (sharedRatings < 50) return 'useful';
  return 'strong';
}

export function consecutiveEligibleDays(
  days: Array<{ day: string; eligible: boolean }>,
  today: string,
): number {
  const byDay = new Map(days.map((row) => [row.day, row.eligible]));
  let count = 0;
  const cursor = new Date(`${today}T12:00:00Z`);
  while (byDay.get(cursor.toISOString().slice(0, 10)) === true) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}
