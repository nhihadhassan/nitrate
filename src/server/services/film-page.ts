import 'server-only';

import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import {
  credits,
  diaryEntries,
  follows,
  genres,
  listItems,
  lists,
  movieGenres,
  movies,
  people,
  userMovieState,
  users,
  type Movie,
} from '@/server/db/schema';
import { viewableSql, type Viewer } from '@/server/privacy';

export type FilmCredits = {
  directors: { id: string; name: string; slug: string; providerId: string }[];
  cast: { id: string; name: string; slug: string; providerId: string; character: string | null; profilePath: string | null }[];
  crew: { id: string; name: string; slug: string; providerId: string; job: string | null }[];
};

export async function getFilmCredits(movieId: string): Promise<FilmCredits> {
  const rows = await db
    .select({
      personId: people.id,
      name: people.name,
      slug: people.slug,
      providerId: people.providerId,
      profilePath: people.profilePath,
      kind: credits.kind,
      job: credits.job,
      character: credits.character,
      sortOrder: credits.sortOrder,
    })
    .from(credits)
    .innerJoin(people, eq(people.id, credits.personId))
    .where(eq(credits.movieId, movieId))
    .orderBy(credits.sortOrder);

  return {
    directors: rows
      .filter((r) => r.kind === 'crew' && r.job === 'Director')
      .map((r) => ({ id: r.personId, name: r.name, slug: r.slug, providerId: r.providerId })),
    cast: rows
      .filter((r) => r.kind === 'cast')
      .slice(0, 24)
      .map((r) => ({
        id: r.personId,
        name: r.name,
        slug: r.slug,
        providerId: r.providerId,
        character: r.character,
        profilePath: r.profilePath,
      })),
    crew: rows
      .filter((r) => r.kind === 'crew' && r.job !== 'Director')
      .map((r) => ({ id: r.personId, name: r.name, slug: r.slug, providerId: r.providerId, job: r.job })),
  };
}

export async function getFilmGenres(movieId: string) {
  return db
    .select({ id: genres.id, name: genres.name, slug: genres.slug, providerId: genres.providerId })
    .from(movieGenres)
    .innerJoin(genres, eq(genres.id, movieGenres.genreId))
    .where(eq(movieGenres.movieId, movieId));
}

/**
 * People the viewer follows who have seen this film, with their ratings. This is
 * the context that actually changes whether you watch something, so it outranks
 * the anonymous crowd on the page.
 */
export async function getFriendActivity(viewerId: string | null, movieId: string) {
  if (!viewerId) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      rating: userMovieState.rating,
      liked: userMovieState.liked,
      watched: userMovieState.watched,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .innerJoin(
      userMovieState,
      and(eq(userMovieState.userId, users.id), eq(userMovieState.movieId, movieId)),
    )
    .where(and(eq(follows.followerId, viewerId), eq(userMovieState.watched, true)))
    .orderBy(desc(userMovieState.rating))
    .limit(12);
}

export type FilmReview = {
  id: string;
  rating: number | null;
  liked: boolean;
  reviewText: string;
  containsSpoilers: boolean;
  watchedDate: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  isRewatch: boolean;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export async function getFilmReviews(
  movieId: string,
  viewer: Viewer,
  options: { limit?: number; fromFollowingOf?: string | null } = {},
): Promise<FilmReview[]> {
  const rows = await db
    .select({
      entry: diaryEntries,
      authorId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(diaryEntries)
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        eq(diaryEntries.movieId, movieId),
        isNull(diaryEntries.deletedAt),
        isNull(users.deletedAt),
        sql`${diaryEntries.reviewText} is not null and length(trim(${diaryEntries.reviewText})) > 0`,
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
        options.fromFollowingOf
          ? sql`exists (select 1 from ${follows} f where f.follower_id = ${options.fromFollowingOf} and f.following_id = ${diaryEntries.userId})`
          : undefined,
      ),
    )
    .orderBy(desc(diaryEntries.likeCount), desc(diaryEntries.createdAt))
    .limit(options.limit ?? 6);

  return rows.map((row) => ({
    id: row.entry.id,
    rating: row.entry.rating,
    liked: row.entry.liked,
    reviewText: row.entry.reviewText ?? '',
    containsSpoilers: row.entry.containsSpoilers,
    watchedDate: row.entry.watchedDate,
    createdAt: row.entry.createdAt,
    likeCount: row.entry.likeCount,
    commentCount: row.entry.commentCount,
    isRewatch: row.entry.isRewatch,
    author: {
      id: row.authorId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
  }));
}

export async function getListsContaining(movieId: string, viewer: Viewer, limit = 6) {
  return db
    .select({
      id: lists.id,
      title: lists.title,
      slug: lists.slug,
      itemCount: lists.itemCount,
      likeCount: lists.likeCount,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(users, eq(users.id, lists.userId))
    .where(
      and(
        eq(listItems.movieId, movieId),
        isNull(lists.deletedAt),
        viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
      ),
    )
    .orderBy(desc(lists.likeCount), desc(lists.itemCount))
    .limit(limit);
}

/** Local "more like this", used when the provider is unreachable. */
export async function getRelatedFilms(movie: Movie, limit = 12): Promise<Movie[]> {
  const genreIds = await db
    .select({ id: movieGenres.genreId })
    .from(movieGenres)
    .where(eq(movieGenres.movieId, movie.id));
  if (!genreIds.length) return [];

  return db
    .select({ movie: movies })
    .from(movies)
    .innerJoin(movieGenres, eq(movieGenres.movieId, movies.id))
    .where(
      and(
        inArray(
          movieGenres.genreId,
          genreIds.map((g) => g.id),
        ),
        ne(movies.id, movie.id),
      ),
    )
    .groupBy(movies.id)
    .orderBy(desc(sql`count(*)`), desc(movies.providerPopularity))
    .limit(limit)
    .then((rows) => rows.map((r) => r.movie));
}

export type RatingHistogram = { rating: number; count: number; percent: number }[];

export function buildHistogram(raw: Record<string, number> | null, total: number): RatingHistogram {
  const max = Math.max(1, ...Object.values(raw ?? {}));
  return Array.from({ length: 10 }, (_, index) => {
    const rating = index + 1;
    const count = raw?.[String(rating)] ?? 0;
    return {
      rating,
      count,
      // Bars are scaled to the tallest bucket; the label carries the real number.
      percent: total === 0 ? 0 : Math.round((count / max) * 100),
    };
  });
}
