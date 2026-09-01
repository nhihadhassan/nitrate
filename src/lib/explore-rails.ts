export const MIN_FULL_RAIL_ITEMS = 4;

export type DiscoveryFilm = { id?: string; slug: string };

export type DiscoverySource<TFilm extends DiscoveryFilm> = {
  id: string;
  title: string;
  subtitle?: string;
  films: TFilm[];
  priority: number;
  kind: 'social' | 'personal';
  showReason?: boolean;
  showFeedback?: boolean;
  href?: string;
  linkLabel?: string;
};

export type DiscoveryRow<TFilm extends DiscoveryFilm> = DiscoverySource<TFilm> & {
  compact: boolean;
  mergedFrom: string[];
};

function filmKey(film: DiscoveryFilm): string {
  return film.id ?? film.slug;
}

/**
 * A full-width rail needs enough films to feel intentional. Small social and
 * personal signals are combined into one useful surface, preserving the most
 * relevant occurrence of a film and never padding with fake recommendations.
 */
export function organisePersonalDiscovery<TFilm extends DiscoveryFilm>(
  sources: DiscoverySource<TFilm>[],
  minimum = MIN_FULL_RAIL_ITEMS,
): DiscoveryRow<TFilm>[] {
  const active = sources
    .filter((source) => source.films.length > 0)
    .sort((a, b) => b.priority - a.priority);

  const dense = active
    .filter((source) => source.films.length >= minimum)
    .map((source) => ({ ...source, compact: false, mergedFrom: [source.id] }));
  const sparse = active.filter((source) => source.films.length < minimum);

  if (!sparse.length) return dense;

  const seen = new Set<string>();
  const films: TFilm[] = [];
  for (const source of sparse) {
    for (const film of source.films) {
      const key = filmKey(film);
      if (seen.has(key)) continue;
      seen.add(key);
      films.push(film);
    }
  }

  const hasSocial = sparse.some((source) => source.kind === 'social');
  dense.push({
    id: 'combined-personal-discovery',
    title: hasSocial ? 'From your circle' : 'Picked for you',
    subtitle: hasSocial
      ? 'A few good signals from friends and Movie Clubs, together where they belong.'
      : 'A small selection shaped by your films.',
    films,
    priority: Math.max(...sparse.map((source) => source.priority)),
    kind: hasSocial ? 'social' : 'personal',
    compact: films.length < minimum,
    mergedFrom: sparse.map((source) => source.id),
  });

  return dense.sort((a, b) => b.priority - a.priority);
}
