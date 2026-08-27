export type AvailabilityTotals = { yes: number; maybe: number; no: number };

/** Yes is decisive, maybe is a tie-breaker, and no never improves a slot. */
export function availabilityScore(option: AvailabilityTotals): number {
  return option.yes * 2 + option.maybe;
}

export function bestPollOption<T extends AvailabilityTotals & { startsAt: string }>(
  options: T[],
): T | null {
  return options.reduce<T | null>((best, option) => {
    if (!best) return option;
    const score = availabilityScore(option);
    const bestScore = availabilityScore(best);
    if (score !== bestScore) return score > bestScore ? option : best;
    if (option.yes !== best.yes) return option.yes > best.yes ? option : best;
    return option.startsAt < best.startsAt ? option : best;
  }, null);
}
