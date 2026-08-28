export type StatsScope =
  | { kind: 'all-time' }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }
  | { kind: 'custom-year'; year: number };

export type RankedStat = { label: string; count: number; href?: string };
export type PosterStory = {
  movieId: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  watchedDate?: string;
  rating?: number | null;
};

export interface PersonalStats {
  scope: StatsScope;
  scopeLabel: string;
  viewingCount: number;
  uniqueFilms: number;
  libraryTotal: number;
  runtimeMinutes: number;
  ratedCount: number;
  averageRating: number | null;
  rewatches: number;
  newToYou: number;
  latestViewings: PosterStory[];
  topGenres: RankedStat[];
  topDirectors: RankedStat[];
  topActors: RankedStat[];
  decades: RankedStat[];
  languages: RankedStat[];
  runtimeBands: RankedStat[];
  activityByWeekday: RankedStat[];
  activityByMonth: RankedStat[];
  opinionOutliers: Array<PosterStory & { difference: number; communityRating: number }>;
  tasteChanges: string[];
  availableYears: number[];
}

export interface PersonalRecap {
  owner: { id: string; username: string; displayName: string };
  year: number;
  title: string;
  sparse: boolean;
  stats: PersonalStats;
  openingFilm: PosterStory | null;
  highestRated: PosterStory[];
  collage: PosterStory[];
  clubContribution: { screenings: number; picks: number; ratings: number };
  closingLine: string;
}

export interface ClubYearbook {
  club: { id: string; slug: string; name: string; visibility: 'private' | 'public' };
  year: number | null;
  title: string;
  screenings: Array<PosterStory & { screeningId: string; attendeeCount: number; groupRating: number | null }>;
  totalRuntimeMinutes: number;
  uniqueFilms: number;
  memberStories: Array<{ displayName: string; picks: number; attended: number }>;
  topGenres: RankedStat[];
  collage: PosterStory[];
  ratingsWithheld: boolean;
}

export type TasteConfidence = 'limited' | 'emerging' | 'established';

export interface TasteComparison {
  left: { id: string; username: string; displayName: string };
  right: { id: string; username: string; displayName: string };
  sharedRatingCount: number;
  confidence: TasteConfidence;
  confidenceLabel: string;
  sharedFavourites: PosterStory[];
  agreements: Array<PosterStory & { leftRating: number; rightRating: number }>;
  disagreements: Array<PosterStory & { leftRating: number; rightRating: number }>;
  recommendationsForLeft: PosterStory[];
  recommendationsForRight: PosterStory[];
}

export type ShareSnapshot =
  | { version: 1; kind: 'personal_recap'; createdAt: string; payload: PersonalRecap }
  | { version: 1; kind: 'club_yearbook'; createdAt: string; payload: ClubYearbook }
  | { version: 1; kind: 'taste_comparison'; createdAt: string; payload: TasteComparison };
