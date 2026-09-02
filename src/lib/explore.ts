import type { FilmRef } from '@/lib/types';
import type { RecommendationReason } from '@/lib/recommendations';

export const EXPLORE_MAX_BATCHES = 5;
export const EXPLORE_MAX_EXCLUDED_IDS = 200;
export const EXPLORE_MAX_RAIL_PAGE = 5;

export type ExploreRailFilm = FilmRef & {
  caption?: string;
  reason?: RecommendationReason;
  owned?: boolean;
};

export type RailContinuation = {
  source: 'trending' | 'popular' | 'top-rated' | 'now-playing' | 'upcoming' | 'canon' | 'genre' | 'decade' | 'hidden-gems' | 'similar';
  nextPage: number;
  genreId?: string;
  decade?: number;
  providerId?: string;
};

export type ExploreModule =
  | {
      id: string;
      type: 'poster_rail';
      title: string;
      subtitle?: string;
      films: ExploreRailFilm[];
      continuation?: RailContinuation;
      degraded?: boolean;
      showReason?: boolean;
      showFeedback?: boolean;
    }
  | {
      id: string;
      type: 'review_spotlight';
      title: string;
      reviewId: string;
      film: FilmRef;
    }
  | {
      id: string;
      type: 'list_spotlight';
      title: string;
      listId: string;
      covers: FilmRef[];
    };

export type ExploreCursor = { batch: number; seed: string };

export function normalizeExploreIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].slice(-EXPLORE_MAX_EXCLUDED_IDS);
}

export function appendUniqueExploreFilms<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((film) => film.id));
  return [...current, ...incoming.filter((film) => !seen.has(film.id) && Boolean(seen.add(film.id)))];
}
