import 'server-only';

import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { FilmRef } from '@/lib/types';
import { db } from '@/server/db';
import {
  clubMembers,
  clubs,
  credits,
  diaryEntries,
  follows,
  genres,
  listItems,
  lists,
  movieGenres,
  movies,
  people,
  screenings,
  userMovieState,
  users,
  type Movie,
} from '@/server/db/schema';
import { toFilmRef } from '@/server/movies/catalog';
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

export type FriendOnFilm = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
  rating: number | null;
  liked: boolean;
  /** The friend's most recent review of this film, when they wrote one. */
  reviewId: string | null;
  reviewExcerpt: string | null;
  reviewHasSpoilers: boolean;
};

export type FriendContext = {
  friends: FriendOnFilm[];
  watchedCount: number;
  likedCount: number;
  /** Average of friends' ratings, in half-stars, or null if nobody rated it. */
  averageRating: number | null;
};

/**
 * People the viewer follows who have seen this film, with their ratings and
 * their reviews. This is the context that actually changes whether you watch
 * something, so it outranks the anonymous crowd on the page.
 */
export async function getFriendContext(
  viewerId: string | null,
  movieId: string,
): Promise<FriendContext> {
  const empty: FriendContext = { friends: [], watchedCount: 0, likedCount: 0, averageRating: null };
  if (!viewerId) return empty;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      rating: userMovieState.rating,
      liked: userMovieState.liked,
      reviewId: sql<string | null>`(
        select e.id from nitrate.diary_entries e
        where e.user_id = ${users.id}
          and e.movie_id = ${movieId}
          and e.deleted_at is null
          and e.review_text is not null
          and length(trim(e.review_text)) > 0
          and e.visibility <> 'private'
        order by e.created_at desc
        limit 1
      )`,
      reviewExcerpt: sql<string | null>`(
        select e.review_text from nitrate.diary_entries e
        where e.user_id = ${users.id}
          and e.movie_id = ${movieId}
          and e.deleted_at is null
          and e.review_text is not null
          and length(trim(e.review_text)) > 0
          and e.visibility <> 'private'
        order by e.created_at desc
        limit 1
      )`,
      reviewHasSpoilers: sql<boolean>`coalesce((
        select e.contains_spoilers from nitrate.diary_entries e
        where e.user_id = ${users.id}
          and e.movie_id = ${movieId}
          and e.deleted_at is null
          and e.review_text is not null
          and length(trim(e.review_text)) > 0
          and e.visibility <> 'private'
        order by e.created_at desc
        limit 1
      ), false)`,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .innerJoin(
      userMovieState,
      and(eq(userMovieState.userId, users.id), eq(userMovieState.movieId, movieId)),
    )
    .where(
      and(eq(follows.followerId, viewerId), eq(userMovieState.watched, true), isNull(users.deletedAt)),
    )
    // Reviewers first, then the highest ratings: the most useful rows on top.
    .orderBy(desc(sql`(${userMovieState.rating} is not null)`), desc(userMovieState.rating))
    .limit(12);

  const rated = rows.filter((row) => row.rating != null);
  return {
    friends: rows.map((row) => ({
      ...row,
      reviewExcerpt: row.reviewExcerpt ? row.reviewExcerpt.trim() : null,
    })),
    watchedCount: rows.length,
    likedCount: rows.filter((row) => row.liked).length,
    averageRating: rated.length
      ? rated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / rated.length
      : null,
  };
}

export type ClubRatingOnFilm = {
  clubId: string;
  name: string;
  slug: string;
  screeningId: string;
  average: number | null;
  count: number;
  watchedOn: Date | null;
  /** True when the club rates blind and the viewer has not submitted a score. */
  awaitingViewerRating: boolean;
};

/**
 * "Club rating" means exactly one thing: how *this club* scored the film on the
 * night they watched it. It is deliberately separate from the community
 * average, only members of that club ever see it, and — because this page is
 * one more surface a score could leak from — it honours blind ratings too.
 */
export async function getViewerClubRatings(
  viewerId: string | null,
  movieId: string,
): Promise<ClubRatingOnFilm[]> {
  if (!viewerId) return [];
  const rows = await db
    .select({
      clubId: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      blindRatingsEnabled: clubs.blindRatingsEnabled,
      screeningId: screenings.id,
      ratingSum: screenings.groupRatingSum,
      count: screenings.groupRatingCount,
      watchedOn: screenings.completedAt,
      viewerRated: sql<boolean>`exists (
        select 1 from nitrate.club_ratings cr
        where cr.screening_id = ${screenings.id} and cr.user_id = ${viewerId}
      )`,
    })
    .from(screenings)
    .innerJoin(clubs, eq(clubs.id, screenings.clubId))
    .innerJoin(
      clubMembers,
      and(
        eq(clubMembers.clubId, clubs.id),
        eq(clubMembers.userId, viewerId),
        eq(clubMembers.status, 'active'),
      ),
    )
    .where(
      and(
        eq(screenings.movieId, movieId),
        eq(screenings.status, 'completed'),
        isNull(clubs.deletedAt),
      ),
    )
    .orderBy(desc(screenings.completedAt))
    .limit(4);

  return rows.map((row) => {
    const revealed = !row.blindRatingsEnabled || row.viewerRated;
    return {
      clubId: row.clubId,
      name: row.name,
      slug: row.slug,
      screeningId: row.screeningId,
      average: revealed && row.count > 0 ? row.ratingSum / row.count : null,
      count: revealed ? row.count : 0,
      watchedOn: row.watchedOn,
      awaitingViewerRating: !revealed && row.count > 0,
    };
  });
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

/**
 * Local "more like this". Every film the detail page ingests also stores its
 * provider recommendations, so this stays useful even when TMDB is unreachable.
 */
export async function getRelatedFilms(movie: Movie, limit = 12): Promise<FilmRef[]> {
  const genreIds = await db
    .select({ id: movieGenres.genreId })
    .from(movieGenres)
    .where(eq(movieGenres.movieId, movie.id));
  if (!genreIds.length) return [];

  const rows = await db
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
        eq(movies.adult, false),
      ),
    )
    .groupBy(movies.id)
    .orderBy(desc(sql`count(*)`), desc(movies.providerPopularity))
    .limit(limit);

  return rows.map((row) => toFilmRef(row.movie));
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
