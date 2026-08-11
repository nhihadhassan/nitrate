import 'server-only';

import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { diaryEntries, follows, movies, users } from '@/server/db/schema';
import { withProvider, type ProviderGenre, type ProviderMovieSummary } from '@/server/movies/provider';
import { viewableSql, type Viewer } from '@/server/privacy';

export type RailFilm = {
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

/**
 * Provider results link by provider id. The film page ingests on first view and
 * redirects to the canonical slug, so a film that nobody has touched yet still
 * has a working, shareable URL.
 */
function toRailFilm(movie: ProviderMovieSummary): RailFilm {
  return {
    slug: movie.providerId,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
  };
}

export type EditorialRails = {
  trending: RailFilm[];
  nowPlaying: RailFilm[];
  topRated: RailFilm[];
  upcoming: RailFilm[];
  genres: ProviderGenre[];
  degraded: boolean;
};

export async function getEditorialRails(): Promise<EditorialRails> {
  const [trending, nowPlaying, topRated, upcoming, genres] = await Promise.all([
    withProvider((p) => p.trending('week')),
    withProvider((p) => p.nowPlaying(1)),
    withProvider((p) => p.topRated(1)),
    withProvider((p) => p.upcoming(1)),
    withProvider((p) => p.genres()),
  ]);

  const clean = (items: ProviderMovieSummary[]) =>
    items.filter((m) => !m.adult && m.posterPath).map(toRailFilm);

  return {
    trending: clean(trending.data.results),
    nowPlaying: clean(nowPlaying.data.results),
    topRated: clean(topRated.data.results),
    upcoming: clean(upcoming.data.results),
    genres: genres.data,
    degraded: trending.degraded,
  };
}

/**
 * The single most valuable discovery signal we have: what the people this user
 * actually follows have been logging lately.
 */
export async function getPopularAmongFollowing(userId: string, limit = 12) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
  return db
    .select({ movie: movies, count: sql<number>`count(distinct ${diaryEntries.userId})::int` })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(follows, eq(follows.followingId, diaryEntries.userId))
    .where(
      and(
        eq(follows.followerId, userId),
        isNull(diaryEntries.deletedAt),
        gte(diaryEntries.createdAt, since),
        sql`${diaryEntries.visibility} <> 'private'`,
      ),
    )
    .groupBy(movies.id)
    .orderBy(desc(sql`count(distinct ${diaryEntries.userId})`), desc(movies.providerPopularity))
    .limit(limit);
}

export type PopularReview = {
  id: string;
  reviewText: string;
  containsSpoilers: boolean;
  rating: number | null;
  liked: boolean;
  likeCount: number;
  movieSlug: string;
  movieTitle: string;
  movieYear: number | null;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export async function getPopularReviews(viewer: Viewer, limit = 6): Promise<PopularReview[]> {
  const rows = await db
    .select({ entry: diaryEntries, movie: movies, author: users })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        isNull(diaryEntries.deletedAt),
        isNull(users.deletedAt),
        sql`${diaryEntries.reviewText} is not null and length(trim(${diaryEntries.reviewText})) > 40`,
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
      ),
    )
    .orderBy(desc(diaryEntries.likeCount), desc(diaryEntries.createdAt))
    .limit(limit);

  return rows.map(({ entry, movie, author }) => ({
    id: entry.id,
    reviewText: entry.reviewText ?? '',
    containsSpoilers: entry.containsSpoilers,
    rating: entry.rating,
    liked: entry.liked,
    likeCount: entry.likeCount,
    movieSlug: movie.slug,
    movieTitle: movie.title,
    movieYear: movie.year,
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarAssetId: author.avatarAssetId,
    },
  }));
}

export type BrowseParams = {
  genreId?: string;
  decade?: number;
  sort?: 'popularity' | 'rating' | 'release_date';
  page?: number;
};

export async function browseFilms(params: BrowseParams) {
  const { data, degraded } = await withProvider((p) =>
    p.discover({
      genreId: params.genreId,
      decade: params.decade,
      sortBy: params.sort ?? 'popularity',
      page: params.page ?? 1,
    }),
  );
  return {
    films: data.results.filter((m) => !m.adult).map(toRailFilm),
    page: data.page,
    totalPages: data.totalPages,
    degraded,
  };
}
