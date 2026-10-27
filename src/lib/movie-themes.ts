/**
 * Round themes: "Spooky Season", "Leonardo DiCaprio Night", a custom idea a
 * club types in themselves. A theme is guidance, never enforcement: nothing
 * here ever filters a movie out of a round, only ranks or badges it.
 *
 * This module is pure (no DB, no network) so the ranking logic is trivial to
 * unit test, same family as `club-cadence.ts` / `club-stage.ts`.
 */

export type ThemeType = 'genre' | 'actor' | 'director' | 'decade' | 'seasonal' | 'custom';

export type ThemeCriteria = {
  genreIds?: number[];
  personId?: number;
  personRole?: 'cast' | 'crew';
  yearRange?: { from?: number; to?: number };
  keywords?: string[];
  country?: string;
  language?: string;
  customCriteria?: string;
};

export type MovieTheme = {
  id: string;
  name: string;
  emoji: string;
  /** Short line shown on the theme card, e.g. "Horror, thrillers, and creepy classics." */
  description: string;
  type: ThemeType;
  criteria: ThemeCriteria;
  /** 1-12 (January-December), for seasonal themes only. */
  seasonalMonths?: number[];
};

/**
 * A small, curated catalog, not exhaustive, easy to extend. TMDB genre ids
 * are the same stable reference ids `DiscoverParams` already assumes
 * (28 Action, 35 Comedy, 16 Animation, 27 Horror, 53 Thriller, 9648 Mystery,
 * 10749 Romance). Person ids (DiCaprio, Nolan) are likewise stable TMDB ids.
 */
export const CURATED_THEMES: MovieTheme[] = [
  {
    id: 'spooky-season',
    name: 'Spooky Season',
    emoji: '🎃',
    description: 'Horror, thrillers, and creepy classics.',
    type: 'seasonal',
    seasonalMonths: [10],
    criteria: { genreIds: [27, 53, 9648], keywords: ['supernatural', 'halloween'] },
  },
  {
    id: 'comedy-night',
    name: 'Comedy Night',
    emoji: '😂',
    description: 'Feel-good. Hilarious. Unforgettable.',
    type: 'genre',
    criteria: { genreIds: [35] },
  },
  {
    id: 'action-night',
    name: 'Action Night',
    emoji: '💥',
    description: 'High stakes. Bigger explosions.',
    type: 'genre',
    criteria: { genreIds: [28] },
  },
  {
    id: 'leo-dicaprio',
    name: 'Leonardo DiCaprio Night',
    emoji: '🎬',
    description: 'Iconic roles. Unforgettable performances.',
    type: 'actor',
    criteria: { personId: 6193, personRole: 'cast' },
  },
  {
    id: 'nolan-night',
    name: 'Christopher Nolan Night',
    emoji: '🌀',
    description: 'Mind-bending, ambitious, cinematic.',
    type: 'director',
    criteria: { personId: 525, personRole: 'crew' },
  },
  {
    id: '90s-classics',
    name: '90s Classics',
    emoji: '📼',
    description: 'Iconic films from a legendary decade.',
    type: 'decade',
    criteria: { yearRange: { from: 1990, to: 1999 } },
  },
  {
    id: 'animation-night',
    name: 'Animation Night',
    emoji: '🎨',
    description: 'Beautiful, imaginative, timeless.',
    type: 'genre',
    criteria: { genreIds: [16] },
  },
  {
    id: 'romance-night',
    name: 'Romance Night',
    emoji: '💕',
    description: 'Love stories for every mood.',
    type: 'genre',
    criteria: { genreIds: [10749] },
  },
];

export function findTheme(themeId: string): MovieTheme | null {
  return CURATED_THEMES.find((theme) => theme.id === themeId) ?? null;
}

export type ThemeSuggestionLabel = 'perfect-for-month' | 'based-on-club' | 'popular' | 'trending';

export type RankedTheme = {
  theme: MovieTheme;
  score: number;
  label: ThemeSuggestionLabel;
};

/**
 * Deterministic theme ranking. No AI, no external calls. Every input is
 * something the app already knows: the calendar, the club's watch history
 * (`getClubStats().topGenres`), and which themes this club has run recently.
 */
export function suggestThemesForClub(input: {
  month: number; // 1-12
  topGenreNames?: string[];
  recentThemeIds?: string[];
  themes?: MovieTheme[];
}): RankedTheme[] {
  const themes = input.themes ?? CURATED_THEMES;
  const topGenreNames = new Set((input.topGenreNames ?? []).map((name) => name.toLowerCase()));
  const recentThemeIds = new Set(input.recentThemeIds ?? []);

  const ranked = themes.map((theme): RankedTheme => {
    let score = 0;
    let label: ThemeSuggestionLabel = 'trending';

    if (theme.seasonalMonths?.includes(input.month)) {
      score += 100;
      label = 'perfect-for-month';
    }

    const genreMatchCount = theme.criteria.genreIds
      ? GENRE_ID_NAMES.filter(
          (entry) => theme.criteria.genreIds!.includes(entry.id) && topGenreNames.has(entry.name.toLowerCase()),
        ).length
      : 0;
    if (genreMatchCount > 0) {
      score += 40 * genreMatchCount;
      if (label !== 'perfect-for-month') label = 'based-on-club';
    }

    if (score === 0) {
      // No personal signal yet, so fall back to a generic, still-honest label.
      score = theme.type === 'genre' ? 20 : 10;
      label = theme.type === 'genre' ? 'popular' : 'trending';
    }

    if (recentThemeIds.has(theme.id)) {
      score -= 25; // recent-theme penalty: keep rounds from feeling repetitive
    }

    return { theme, score, label };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

/** TMDB genre ids the app cares about, paired with the display name used in `getClubStats().topGenres`. */
const GENRE_ID_NAMES = [
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 16, name: 'Animation' },
  { id: 27, name: 'Horror' },
  { id: 53, name: 'Thriller' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 14, name: 'Fantasy' },
  { id: 878, name: 'Science Fiction' },
  { id: 18, name: 'Drama' },
];

/**
 * Ranks how well a movie fits a theme's criteria. Guidance only, used to
 * *order* "Fits the theme" rails and nomination suggestions, never to filter
 * what a member is allowed to submit.
 */
export function themeMatchScore(
  theme: MovieTheme,
  movie: { genreIds?: number[]; year?: number | null },
): number {
  let score = 0;
  const { criteria } = theme;

  if (criteria.genreIds?.length && movie.genreIds?.length) {
    const overlap = movie.genreIds.filter((id) => criteria.genreIds!.includes(id)).length;
    score += overlap * 10;
  }

  if (criteria.yearRange && movie.year) {
    const { from, to } = criteria.yearRange;
    if ((from == null || movie.year >= from) && (to == null || movie.year <= to)) {
      score += 10;
    }
  }

  return score;
}

/**
 * Maps a theme to a CSS accent used to lightly tint the wheel/hero ambience.
 * Data-driven on purpose. No per-theme bespoke layouts, just a color swap.
 */
export function themeAccent(theme: Pick<MovieTheme, 'type' | 'id'> | null): 'ember' | 'iris' {
  if (!theme) return 'iris';
  if (theme.id === 'spooky-season' || theme.type === 'seasonal') return 'ember';
  return 'iris';
}

/** Display chips for a theme's criteria, e.g. ["Horror", "Thriller", "Mystery"] for Spooky Season. */
export function themeCriteriaChips(theme: Pick<MovieTheme, 'criteria' | 'id'>): string[] {
  const { criteria } = theme;
  const chips: string[] = [];
  if (criteria.genreIds?.length) {
    const names = criteria.genreIds
      .map((id) => GENRE_ID_NAMES.find((entry) => entry.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    chips.push(...names);
  }
  if (theme.id === 'spooky-season') chips.push('Supernatural');
  if (criteria.yearRange) {
    const { from, to } = criteria.yearRange;
    if (from && to) chips.push(`${from}s`);
  }
  return chips;
}
