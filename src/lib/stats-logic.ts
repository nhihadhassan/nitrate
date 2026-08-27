import type { TasteConfidence } from './stats';

export function tasteConfidenceForOverlap(sharedRatings: number): TasteConfidence {
  if (sharedRatings >= 25) return 'established';
  if (sharedRatings >= 10) return 'emerging';
  return 'limited';
}

export function runtimeBandFor(runtime: number | null): string {
  if (runtime == null) return 'Unknown';
  if (runtime < 90) return 'Under 90 min';
  if (runtime <= 120) return '90–120 min';
  if (runtime <= 150) return '121–150 min';
  return 'Over 150 min';
}

export function describeRatingShift(firstAverage: number | null, secondAverage: number | null, viewingCount: number): string | null {
  if (viewingCount < 8 || firstAverage == null || secondAverage == null) return null;
  const delta = secondAverage - firstAverage;
  if (Math.abs(delta) < 0.5) return null;
  return delta > 0
    ? `Your ratings became ${delta.toFixed(1)} half-stars more generous in the later half.`
    : `Your ratings became ${Math.abs(delta).toFixed(1)} half-stars more selective in the later half.`;
}
