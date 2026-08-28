import 'server-only';

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import {
  clubMembers,
  clubs,
  credits,
  diaryEntries,
  diaryEntryTags,
  favoriteFilms,
  follows,
  genres,
  listItems,
  lists,
  movieGenres,
  movies,
  ownershipCopies,
  people,
  reviewLikes,
  screenings,
  tags as tagsTable,
  userMovieState,
  users,
  type Movie,
  type User,
  type ViewingContext,
} from '@/server/db/schema';
import { viewableSql, type Viewer } from '@/server/privacy';

/* -------------------------------------------------------------------------- */
/* Favourites                                                                 */
/* -------------------------------------------------------------------------- */

export async function getFavoriteFilms(userId: string): Promise<(Movie & { position: number })[]> {
  const rows = await db
    .select({ movie: movies, position: favoriteFilms.position })
    .from(favoriteFilms)
    .innerJoin(movies, eq(movies.id, favoriteFilms.movieId))
    .where(eq(favoriteFilms.userId, userId))
    .orderBy(asc(favoriteFilms.position));
  return rows.map((r) => ({ ...r.movie, position: r.position }));
}

/**
 * Everything onboarding needs to redraw itself after a reload.
 *
 * Each step writes as it goes, so the data was never actually lost — but the
 * form used to start blank, which looks identical to losing it. This reads the
 * work back so a refresh is survivable.
 */
export async function getOnboardingProgress(
  userId: string,
  starterSlugs: string[],
  suggestedIds: string[],
): Promise<{
  favorites: (Movie & { position: number })[];
  ratings: Record<string, { rating: number | null; liked: boolean }>;
  following: string[];
}> {
  const [favorites, rated, followed] = await Promise.all([
    getFavoriteFilms(userId),
    starterSlugs.length
      ? db
          .select({ slug: movies.slug, rating: userMovieState.rating, liked: userMovieState.liked })
          .from(userMovieState)
          .innerJoin(movies, eq(movies.id, userMovieState.movieId))
          .where(and(eq(userMovieState.userId, userId), inArray(movies.slug, starterSlugs)))
      : Promise.resolve([]),
    suggestedIds.length
      ? db
          .select({ id: follows.followingId })
          .from(follows)
          .where(and(eq(follows.followerId, userId), inArray(follows.followingId, suggestedIds)))
      : Promise.resolve([]),
  ]);

  const ratings: Record<string, { rating: number | null; liked: boolean }> = {};
  for (const row of rated) ratings[row.slug] = { rating: row.rating, liked: row.liked };

  return { favorites, ratings, following: followed.map((row) => row.id) };
}

/** Replaces the whole set atomically; positions are 1..4. */
export async function setFavoriteFilms(userId: string, movieIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(favoriteFilms).where(eq(favoriteFilms.userId, userId));
    const unique = Array.from(new Set(movieIds)).slice(0, 4);
    if (!unique.length) return;
    await tx
      .insert(favoriteFilms)
      .values(unique.map((movieId, index) => ({ userId, movieId, position: index + 1 })));
  });
}

/* -------------------------------------------------------------------------- */
/* Films & diary                                                              */
/* -------------------------------------------------------------------------- */

export type FilmsSort = 'recent' | 'rating' | 'title' | 'release';
export type LibraryFilters = {
  yearFrom?: number; yearTo?: number; ratingMin?: number; genreId?: string; tag?: string;
  director?: string; rewatch?: boolean; onlyLiked?: boolean; clubId?: string;
  viewingContext?: string; runtimeMax?: number; owned?: boolean;
};

export async function getWatchedFilms(
  userId: string,
  options: { sort?: FilmsSort; limit?: number; offset?: number; onlyRated?: boolean } & LibraryFilters = {},
) {
  const sort = options.sort ?? 'recent';
  const orderBy =
    sort === 'rating'
      ? [desc(userMovieState.rating), desc(userMovieState.updatedAt)]
      : sort === 'title'
        ? [asc(movies.title)]
        : sort === 'release'
          ? [desc(movies.releaseDate)]
          : [desc(sql`coalesce(${userMovieState.lastWatchedDate}, ${userMovieState.watchedAt}::date)`), desc(userMovieState.updatedAt)];

  return db
    .select({ movie: movies, state: userMovieState })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(
      and(
        eq(userMovieState.userId, userId),
        eq(userMovieState.watched, true),
        options.onlyRated ? sql`${userMovieState.rating} is not null` : undefined,
        options.onlyLiked ? eq(userMovieState.liked, true) : undefined,
        options.ratingMin ? gte(userMovieState.rating, options.ratingMin) : undefined,
        options.yearFrom ? gte(movies.year, options.yearFrom) : undefined,
        options.yearTo ? lte(movies.year, options.yearTo) : undefined,
        options.runtimeMax ? lte(movies.runtime, options.runtimeMax) : undefined,
        options.genreId ? sql`exists (select 1 from ${movieGenres} mg join ${genres} g on g.id = mg.genre_id where mg.movie_id = ${movies.id} and g.provider_id = ${options.genreId})` : undefined,
        options.tag ? sql`exists (select 1 from ${diaryEntries} de join ${diaryEntryTags} det on det.diary_entry_id = de.id join ${tagsTable} t on t.id = det.tag_id where de.user_id = ${userId} and de.movie_id = ${movies.id} and lower(t.slug) = lower(${options.tag}) and de.deleted_at is null)` : undefined,
        options.director ? sql`exists (select 1 from ${credits} c join ${people} p on p.id = c.person_id where c.movie_id = ${movies.id} and c.kind = 'crew' and c.job = 'Director' and lower(p.name) like ${`%${options.director.toLowerCase()}%`})` : undefined,
        options.rewatch ? sql`exists (select 1 from ${diaryEntries} de where de.user_id = ${userId} and de.movie_id = ${movies.id} and de.is_rewatch = true and de.deleted_at is null)` : undefined,
        options.clubId ? sql`exists (select 1 from ${diaryEntries} de join ${screenings} s on s.id = de.screening_id where de.user_id = ${userId} and de.movie_id = ${movies.id} and s.club_id = ${options.clubId} and de.deleted_at is null)` : undefined,
        options.viewingContext ? sql`exists (select 1 from ${diaryEntries} de where de.user_id = ${userId} and de.movie_id = ${movies.id} and de.viewing_context = ${options.viewingContext} and de.deleted_at is null)` : undefined,
        options.owned ? sql`exists (select 1 from ${ownershipCopies} oc where oc.user_id = ${userId} and oc.movie_id = ${movies.id})` : undefined,
      ),
    )
    .orderBy(...orderBy)
    .limit(options.limit ?? 60)
    .offset(options.offset ?? 0);
}

export async function countWatchedFilms(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.watched, true)));
  return row?.value ?? 0;
}

export type DiaryRow = {
  entry: typeof diaryEntries.$inferSelect;
  movie: Movie;
  tags: string[];
};

export async function getDiary(
  userId: string,
  viewer: Viewer,
  options: { limit?: number; offset?: number; year?: number } & LibraryFilters = {},
): Promise<DiaryRow[]> {
  const rows = await db
    .select({ entry: diaryEntries, movie: movies })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .where(
      and(
        eq(diaryEntries.userId, userId),
        isNull(diaryEntries.deletedAt),
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
        options.year
          ? sql`extract(year from ${diaryEntries.watchedDate}) = ${options.year}`
          : undefined,
        options.yearFrom ? gte(movies.year, options.yearFrom) : undefined,
        options.yearTo ? lte(movies.year, options.yearTo) : undefined,
        options.ratingMin ? gte(diaryEntries.rating, options.ratingMin) : undefined,
        options.onlyLiked ? eq(diaryEntries.liked, true) : undefined,
        options.rewatch ? eq(diaryEntries.isRewatch, true) : undefined,
        options.viewingContext ? eq(diaryEntries.viewingContext, options.viewingContext as ViewingContext) : undefined,
        options.runtimeMax ? lte(movies.runtime, options.runtimeMax) : undefined,
        options.genreId ? sql`exists (select 1 from ${movieGenres} mg join ${genres} g on g.id = mg.genre_id where mg.movie_id = ${movies.id} and g.provider_id = ${options.genreId})` : undefined,
        options.tag ? sql`exists (select 1 from ${diaryEntryTags} det join ${tagsTable} t on t.id = det.tag_id where det.diary_entry_id = ${diaryEntries.id} and lower(t.slug) = lower(${options.tag}))` : undefined,
        options.director ? sql`exists (select 1 from ${credits} c join ${people} p on p.id = c.person_id where c.movie_id = ${movies.id} and c.kind = 'crew' and c.job = 'Director' and lower(p.name) like ${`%${options.director.toLowerCase()}%`})` : undefined,
        options.clubId ? sql`exists (select 1 from ${screenings} s where s.id = ${diaryEntries.screeningId} and s.club_id = ${options.clubId})` : undefined,
        options.owned ? sql`exists (select 1 from ${ownershipCopies} oc where oc.user_id = ${userId} and oc.movie_id = ${movies.id})` : undefined,
      ),
    )
    .orderBy(desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  if (!rows.length) return [];

  const tagRows = await db
    .select({ entryId: diaryEntryTags.diaryEntryId, name: tagsTable.name })
    .from(diaryEntryTags)
    .innerJoin(tagsTable, eq(tagsTable.id, diaryEntryTags.tagId))
    .where(
      inArray(
        diaryEntryTags.diaryEntryId,
        rows.map((r) => r.entry.id),
      ),
    );

  const byEntry = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = byEntry.get(row.entryId) ?? [];
    list.push(row.name);
    byEntry.set(row.entryId, list);
  }

  return rows.map((row) => ({ ...row, tags: byEntry.get(row.entry.id) ?? [] }));
}

export async function getUserReviews(
  userId: string,
  viewer: Viewer,
  options: { limit?: number; offset?: number } = {},
) {
  return db
    .select({ entry: diaryEntries, movie: movies })
    .from(diaryEntries)
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .where(
      and(
        eq(diaryEntries.userId, userId),
        isNull(diaryEntries.deletedAt),
        sql`${diaryEntries.reviewText} is not null and length(trim(${diaryEntries.reviewText})) > 0`,
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
      ),
    )
    .orderBy(desc(diaryEntries.createdAt))
    .limit(options.limit ?? 30)
    .offset(options.offset ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Watchlist                                                                  */
/* -------------------------------------------------------------------------- */

export type WatchlistSort = 'added' | 'release' | 'runtime' | 'rating' | 'title';

export async function getWatchlist(
  userId: string,
  options: { sort?: WatchlistSort; genreId?: string; decade?: number; limit?: number; offset?: number } = {},
) {
  const sort = options.sort ?? 'added';
  const orderBy =
    sort === 'release'
      ? [desc(movies.releaseDate)]
      : sort === 'runtime'
        ? [asc(movies.runtime)]
        : sort === 'rating'
          ? [desc(sql`case when ${movies.ratingCount} > 0 then ${movies.ratingSum}::float / ${movies.ratingCount} else 0 end`)]
          : sort === 'title'
            ? [asc(movies.title)]
            : [desc(userMovieState.watchlistedAt)];

  const base = db
    .select({ movie: movies, addedAt: userMovieState.watchlistedAt, note: userMovieState.note })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId));

  const query = options.genreId
    ? base.innerJoin(movieGenres, eq(movieGenres.movieId, movies.id)).innerJoin(
        genres,
        and(eq(genres.id, movieGenres.genreId), eq(genres.providerId, options.genreId)),
      )
    : base;

  return query
    .where(
      and(
        eq(userMovieState.userId, userId),
        eq(userMovieState.inWatchlist, true),
        options.decade
          ? and(gte(movies.year, options.decade), sql`${movies.year} <= ${options.decade + 9}`)
          : undefined,
      ),
    )
    .orderBy(...orderBy)
    .limit(options.limit ?? 60)
    .offset(options.offset ?? 0);
}

export async function getWatchlistPreview(userId: string, limit = 6): Promise<Movie[]> {
  const rows = await db
    .select({ movie: movies })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.inWatchlist, true)))
    .orderBy(desc(userMovieState.watchlistedAt))
    .limit(limit);
  return rows.map((r) => r.movie);
}

export async function countWatchlist(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.inWatchlist, true)));
  return row?.value ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Lists & clubs on profile                                                   */
/* -------------------------------------------------------------------------- */

export async function getUserLists(userId: string, viewer: Viewer, limit = 30) {
  const rows = await db
    .select({ list: lists })
    .from(lists)
    .where(
      and(
        eq(lists.userId, userId),
        isNull(lists.deletedAt),
        viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
      ),
    )
    .orderBy(desc(lists.updatedAt))
    .limit(limit);

  if (!rows.length) return [];

  const covers = await db
    .select({ listId: listItems.listId, posterPath: movies.posterPath, position: listItems.position })
    .from(listItems)
    .innerJoin(movies, eq(movies.id, listItems.movieId))
    .where(
      inArray(
        listItems.listId,
        rows.map((r) => r.list.id),
      ),
    )
    .orderBy(asc(listItems.position))
    .limit(rows.length * 5);

  const byList = new Map<string, string[]>();
  for (const cover of covers) {
    if (!cover.posterPath) continue;
    const list = byList.get(cover.listId) ?? [];
    if (list.length < 5) list.push(cover.posterPath);
    byList.set(cover.listId, list);
  }

  return rows.map((r) => ({ ...r.list, covers: byList.get(r.list.id) ?? [] }));
}

export async function getUserClubsForProfile(userId: string, viewerId: string | null) {
  return db
    .select({ club: clubs, role: clubMembers.role })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(
      and(
        eq(clubMembers.userId, userId),
        eq(clubMembers.status, 'active'),
        isNull(clubs.deletedAt),
        // Private clubs only show to people who are in them.
        viewerId
          ? sql`(${clubs.visibility} = 'public' or exists (
              select 1 from nitrate.club_members cm
              where cm.club_id = ${clubs.id} and cm.user_id = ${viewerId} and cm.status = 'active'
            ))`
          : eq(clubs.visibility, 'public'),
      ),
    )
    .orderBy(desc(clubs.memberCount));
}

export async function getLikedReviews(userId: string, viewer: Viewer, limit = 20) {
  return db
    .select({ entry: diaryEntries, movie: movies, author: users })
    .from(reviewLikes)
    .innerJoin(diaryEntries, eq(diaryEntries.id, reviewLikes.diaryEntryId))
    .innerJoin(movies, eq(movies.id, diaryEntries.movieId))
    .innerJoin(users, eq(users.id, diaryEntries.userId))
    .where(
      and(
        eq(reviewLikes.userId, userId),
        isNull(diaryEntries.deletedAt),
        viewableSql(sql`${diaryEntries.visibility}`, sql`${diaryEntries.userId}`, viewer),
      ),
    )
    .orderBy(desc(reviewLikes.createdAt))
    .limit(limit);
}

export async function getLikedFilms(userId: string, limit = 30) {
  const rows = await db
    .select({ movie: movies })
    .from(userMovieState)
    .innerJoin(movies, eq(movies.id, userMovieState.movieId))
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.liked, true)))
    .orderBy(desc(userMovieState.likedAt))
    .limit(limit);
  return rows.map((r) => r.movie);
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

export type ProfileStats = {
  filmCount: number;
  diaryCount: number;
  thisYearCount: number;
  rewatchCount: number;
  averageRating: number | null;
  ratingHistogram: { rating: number; count: number; percent: number }[];
  totalRuntimeMinutes: number;
  topGenres: { name: string; slug: string; count: number }[];
  topDirector: { name: string; providerId: string; count: number } | null;
};

/**
 * Profile statistics in four indexed queries. Everything a member sees on their
 * profile is derived here rather than in the page, so the same numbers back the
 * profile, the recap and (later) any export.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const year = new Date().getFullYear();

  const [totals, diaryTotals, genreRows, directorRows] = await Promise.all([
    db
      .select({
        filmCount: sql<number>`count(*) filter (where ${userMovieState.watched})::int`,
        ratingCount: sql<number>`count(*) filter (where ${userMovieState.rating} is not null)::int`,
        ratingSum: sql<number>`coalesce(sum(${userMovieState.rating}), 0)::int`,
        runtime: sql<number>`coalesce(sum(${movies.runtime}) filter (where ${userMovieState.watched}), 0)::int`,
      })
      .from(userMovieState)
      .innerJoin(movies, eq(movies.id, userMovieState.movieId))
      .where(eq(userMovieState.userId, userId)),

    db
      .select({
        diaryCount: sql<number>`count(*)::int`,
        thisYear: sql<number>`count(*) filter (where extract(year from ${diaryEntries.watchedDate}) = ${year})::int`,
        rewatches: sql<number>`count(*) filter (where ${diaryEntries.isRewatch})::int`,
      })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt))),

    db
      .select({ name: genres.name, slug: genres.slug, count: sql<number>`count(*)::int` })
      .from(userMovieState)
      .innerJoin(movieGenres, eq(movieGenres.movieId, userMovieState.movieId))
      .innerJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(and(eq(userMovieState.userId, userId), eq(userMovieState.watched, true)))
      .groupBy(genres.name, genres.slug)
      .orderBy(desc(sql`count(*)`))
      .limit(5),

    db.execute<{ name: string; provider_id: string; count: number }>(sql`
      select p.name, p.provider_id, count(*)::int as count
      from nitrate.user_movie_state ums
      join nitrate.credits c on c.movie_id = ums.movie_id and c.kind = 'crew' and c.job = 'Director'
      join nitrate.people p on p.id = c.person_id
      where ums.user_id = ${userId} and ums.watched
      group by p.name, p.provider_id
      order by count(*) desc
      limit 1
    `),
  ]);

  const histogramRows = await db
    .select({ rating: userMovieState.rating, count: sql<number>`count(*)::int` })
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), sql`${userMovieState.rating} is not null`))
    .groupBy(userMovieState.rating);

  const counts = new Map(histogramRows.map((r) => [r.rating!, r.count]));
  const maxCount = Math.max(1, ...histogramRows.map((r) => r.count));
  const histogram = Array.from({ length: 10 }, (_, index) => {
    const rating = index + 1;
    const count = counts.get(rating) ?? 0;
    return { rating, count, percent: Math.round((count / maxCount) * 100) };
  });

  const director = directorRows[0];

  return {
    filmCount: totals[0]?.filmCount ?? 0,
    diaryCount: diaryTotals[0]?.diaryCount ?? 0,
    thisYearCount: diaryTotals[0]?.thisYear ?? 0,
    rewatchCount: diaryTotals[0]?.rewatches ?? 0,
    averageRating: totals[0]?.ratingCount ? totals[0].ratingSum / totals[0].ratingCount : null,
    ratingHistogram: histogram,
    totalRuntimeMinutes: totals[0]?.runtime ?? 0,
    topGenres: genreRows,
    topDirector: director
      ? { name: director.name, providerId: director.provider_id, count: Number(director.count) }
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Followers                                                                  */
/* -------------------------------------------------------------------------- */

export async function getFollowList(
  userId: string,
  direction: 'followers' | 'following',
  limit = 60,
): Promise<User[]> {
  const rows =
    direction === 'followers'
      ? await db
          .select({ user: users })
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followerId))
          .where(and(eq(follows.followingId, userId), isNull(users.deletedAt)))
          .orderBy(desc(follows.createdAt))
          .limit(limit)
      : await db
          .select({ user: users })
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followingId))
          .where(and(eq(follows.followerId, userId), isNull(users.deletedAt)))
          .orderBy(desc(follows.createdAt))
          .limit(limit);
  return rows.map((r) => r.user);
}

/** Accounts worth following: active, public, and not already followed. */
export async function getSuggestedUsers(viewerId: string | null, limit = 12): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        isNull(users.suspendedAt),
        eq(users.profileVisibility, 'public'),
        viewerId ? sql`${users.id} <> ${viewerId}` : undefined,
        viewerId
          ? sql`not exists (select 1 from ${follows} f where f.follower_id = ${viewerId} and f.following_id = ${users.id})`
          : undefined,
        viewerId
          ? sql`not exists (
              select 1 from nitrate.blocks b
              where (b.blocker_id = ${viewerId} and b.blocked_id = ${users.id})
                 or (b.blocker_id = ${users.id} and b.blocked_id = ${viewerId})
            )`
          : undefined,
      ),
    )
    .orderBy(desc(users.filmCount), desc(users.followerCount))
    .limit(limit);
}
