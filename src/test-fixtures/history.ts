import type { ClubYearbook, PersonalRecap, PersonalStats, ShareSnapshot, TasteComparison } from '@/lib/stats';

const films = Array.from({ length: 24 }, (_, index) => ({
  movieId: `fixture-film-${index + 1}`,
  slug: `fixture-film-${index + 1}`,
  title: `Synthetic Film ${index + 1}`,
  year: 1960 + index * 3,
  posterPath: null,
  watchedDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 26) + 1).padStart(2, '0')}`,
  rating: (index % 10) + 1,
}));

function stats(count: number): PersonalStats {
  return {
    scope: { kind: 'year', year: 2026 },
    scopeLabel: '2026 so far',
    viewingCount: count,
    uniqueFilms: Math.min(count, 21),
    libraryTotal: 482,
    runtimeMinutes: count * 112,
    ratedCount: Math.max(0, count - 2),
    averageRating: count ? 7.4 : null,
    rewatches: Math.floor(count / 6),
    newToYou: count - Math.floor(count / 6),
    latestViewings: films.slice(0, count),
    topGenres: [{ label: 'Drama', count: 8 }, { label: 'Thriller', count: 5 }],
    topDirectors: [{ label: 'Synthetic Director', count: 3 }],
    topActors: [{ label: 'Synthetic Performer', count: 4 }],
    decades: [{ label: '1990s', count: 6 }],
    languages: [{ label: 'EN', count: 12 }],
    runtimeBands: [{ label: '90–120 min', count: 9 }],
    activityByWeekday: [{ label: 'Friday', count: 7 }],
    activityByMonth: [{ label: 'Aug', count: 5 }],
    opinionOutliers: [],
    tasteChanges: count < 8 ? ['There is not enough contrast yet for a meaningful taste-change claim.'] : ['Your ratings became 0.8 half-stars more selective in the later half.'],
    availableYears: [2026, 2025, 2024],
  };
}

function recap(count: number): PersonalRecap {
  const personalStats = stats(count);
  return {
    owner: { id: 'fixture-owner', username: 'fixture', displayName: 'Synthetic Viewer' },
    year: 2026,
    title: '2026 so far',
    sparse: count < 5,
    stats: personalStats,
    openingFilm: personalStats.latestViewings.at(-1) ?? null,
    highestRated: personalStats.latestViewings.slice(0, 6),
    collage: personalStats.latestViewings.slice(0, 18),
    clubContribution: { screenings: 4, picks: 3, ratings: 4 },
    closingLine: count < 5 ? 'A small year on paper can still hold the film that stayed.' : `${personalStats.uniqueFilms} films, remembered as one year of your taste.`,
  };
}

const yearbook: ClubYearbook = {
  club: { id: 'fixture-club', slug: 'fixture-club', name: 'Synthetic Movie Club', visibility: 'public' },
  year: 2026,
  title: 'Synthetic Movie Club in 2026',
  screenings: films.slice(0, 12).map((film, index) => ({ ...film, screeningId: `screening-${index}`, attendeeCount: 3 + (index % 4), groupRating: null })),
  totalRuntimeMinutes: 1360,
  uniqueFilms: 12,
  memberStories: [{ displayName: 'Avery', picks: 3, attended: 7 }, { displayName: 'Morgan', picks: 4, attended: 9 }],
  topGenres: [{ label: 'Drama', count: 6 }],
  collage: films.slice(0, 18),
  ratingsWithheld: true,
};

function taste(overlap: number): TasteComparison {
  return {
    left: { id: 'left', username: 'left', displayName: 'Avery' },
    right: { id: 'right', username: 'right', displayName: 'Morgan' },
    sharedRatingCount: overlap,
    confidence: overlap >= 25 ? 'established' : overlap >= 10 ? 'emerging' : 'limited',
    confidenceLabel: `${overlap >= 25 ? 'Established' : overlap >= 10 ? 'Emerging' : 'Limited'} comparison from ${overlap} shared ratings`,
    sharedFavourites: films.slice(0, 4),
    agreements: films.slice(4, 10).map((film) => ({ ...film, leftRating: 8, rightRating: 9 })),
    disagreements: films.slice(10, 14).map((film) => ({ ...film, leftRating: 9, rightRating: 4 })),
    recommendationsForLeft: films.slice(14, 18),
    recommendationsForRight: films.slice(18, 22),
  };
}

export function syntheticHistorySnapshot(state: string): ShareSnapshot | null {
  const createdAt = '2026-08-27T12:00:00.000Z';
  if (state === 'recap-sparse') return { version: 1, kind: 'personal_recap', createdAt, payload: recap(3) };
  if (state === 'recap-high-volume') return { version: 1, kind: 'personal_recap', createdAt, payload: recap(5000) };
  if (state === 'recap-imported') {
    const imported = recap(24);
    imported.title = 'An imported history, made yours';
    imported.closingLine = 'Imported dates and ratings use the same recap rules as entries logged in Nitrate.';
    return { version: 1, kind: 'personal_recap', createdAt, payload: imported };
  }
  if (state === 'yearbook') return { version: 1, kind: 'club_yearbook', createdAt, payload: yearbook };
  if (state === 'taste-limited') return { version: 1, kind: 'taste_comparison', createdAt, payload: taste(6) };
  if (state === 'taste-established') return { version: 1, kind: 'taste_comparison', createdAt, payload: taste(42) };
  if (state === 'blocked' || state === 'private' || state === 'failure') return null;
  return { version: 1, kind: 'personal_recap', createdAt, payload: recap(24) };
}
