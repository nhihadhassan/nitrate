/**
 * Confidence-weighted ranking.
 *
 * Sorting by raw average is the classic ratings bug: one person giving a film
 * five stars beats ten thousand people averaging 4.6, and the list immediately
 * stops being worth reading. Every "highest rated" surface in the product ranks
 * through here instead.
 *
 * The formula is the standard Bayesian shrink toward a prior:
 *
 *     (v / (v + m)) * R  +  (m / (v + m)) * C
 *
 * where `R` is the item's average, `v` its number of votes, `C` the mean rating
 * across the population, and `m` the number of votes required before an item's
 * own average is trusted over the prior. It is explainable in one sentence,
 * which matters more here than being clever.
 */
export function bayesianAverage({
  average,
  count,
  prior,
  minimumVotes,
}: {
  average: number;
  count: number;
  /** The population mean, on the same scale as `average`. */
  prior: number;
  /** Votes needed before an item's own average carries most of the weight. */
  minimumVotes: number;
}): number {
  if (minimumVotes <= 0) return average;
  const total = count + minimumVotes;
  if (total === 0) return prior;
  return (count / total) * average + (minimumVotes / total) * prior;
}

/**
 * Ranking for the provider catalogue, where ratings are 0–10 and vote counts run
 * to six figures. `m` is deliberately high: The Canon should be films the world
 * has actually seen.
 */
export const PROVIDER_RANKING = { prior: 6.9, minimumVotes: 3000 } as const;

/**
 * Ranking for our own members' ratings, stored as half-stars (1–10). `m` is
 * small because the population is small — but not 1, or a single five-star log
 * tops the chart on day one.
 */
export const COMMUNITY_RANKING = { prior: 7, minimumVotes: 5 } as const;

export function rankProviderFilms<T extends { voteAverage: number; voteCount: number }>(
  films: T[],
): T[] {
  return [...films].sort(
    (a, b) =>
      bayesianAverage({ average: b.voteAverage, count: b.voteCount, ...PROVIDER_RANKING }) -
      bayesianAverage({ average: a.voteAverage, count: a.voteCount, ...PROVIDER_RANKING }),
  );
}
