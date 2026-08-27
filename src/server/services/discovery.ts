import 'server-only';

import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import {
  feedbackExpiry,
  peopleRecommendationReasons,
  peopleRecommendationScore,
  type RecommendationFeedbackKind,
  type RecommendationReason,
  type RecommendationReasonKind,
} from '@/lib/recommendations';
import { slugify } from '@/lib/utils';
import { db } from '@/server/db';
import {
  blocks,
  clubMembers,
  clubQueueItems,
  diaryEntries,
  favoriteFilms,
  follows,
  movies,
  people,
  personFollows,
  recommendationFeedback,
  tasteCircleMembers,
  userMovieState,
  users,
  type User,
  type Movie,
} from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { ensureMoviesFromSummaries, toFilmRef } from '@/server/movies/catalog';
import { primaryProvider, withProvider } from '@/server/movies/provider';
import { getAvailabilityForMovies } from '@/server/movies/watch-providers';
import { assertCanInteractWith } from '@/server/privacy';

const PEOPLE_CANDIDATE_LIMIT = 100;
const TASTE_CIRCLE_LIMIT = 5;

export type PeopleRecommendation = {
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarAssetId' | 'filmCount'>;
  reasons: RecommendationReason[];
  sharedRatings: number;
};

export async function getPeopleRecommendations(
  viewerId: string,
  limit = 24,
  options: { includeTaste?: boolean } = {},
): Promise<PeopleRecommendation[]> {
  const candidates = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      filmCount: users.filmCount,
    })
    .from(users)
    .where(and(
      sql`${users.id} <> ${viewerId}`,
      eq(users.profileVisibility, 'public'),
      eq(users.allowFollows, true),
      isNull(users.deletedAt),
      isNull(users.suspendedAt),
      sql`not exists (
        select 1 from ${follows} f
        where f.follower_id = ${viewerId} and f.following_id = ${users.id}
      )`,
      sql`not exists (
        select 1 from ${blocks} b
        where (b.blocker_id = ${viewerId} and b.blocked_id = ${users.id})
           or (b.blocker_id = ${users.id} and b.blocked_id = ${viewerId})
      )`,
      sql`not exists (
        select 1 from ${recommendationFeedback} rf
        where rf.user_id = ${viewerId}
          and rf.target_type = 'user'
          and rf.target_id = ${users.id}::text
          and rf.restored_at is null
          and (rf.expires_at is null or rf.expires_at > now())
      )`,
    ))
    .orderBy(desc(users.filmCount), asc(users.createdAt))
    .limit(PEOPLE_CANDIDATE_LIMIT);

  if (!candidates.length) return [];
  const candidateIds = candidates.map((candidate) => candidate.id);
  const allUserIds = [viewerId, ...candidateIds];

  const [ratings, favourites, memberships, mutualRows] = await Promise.all([
    db
      .select({ userId: userMovieState.userId, movieId: userMovieState.movieId, rating: userMovieState.rating })
      .from(userMovieState)
      .where(and(inArray(userMovieState.userId, allUserIds), sql`${userMovieState.rating} is not null`)),
    db
      .select({ userId: favoriteFilms.userId, movieId: favoriteFilms.movieId, title: movies.title })
      .from(favoriteFilms)
      .innerJoin(movies, eq(movies.id, favoriteFilms.movieId))
      .where(inArray(favoriteFilms.userId, allUserIds)),
    db
      .select({ userId: clubMembers.userId, clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(and(inArray(clubMembers.userId, allUserIds), eq(clubMembers.status, 'active'))),
    db
      .select({ candidateId: follows.followingId, count: sql<number>`count(distinct ${follows.followerId})::int` })
      .from(follows)
      .where(and(
        inArray(follows.followingId, candidateIds),
        sql`${follows.followerId} in (
          select mine.following_id from ${follows} mine where mine.follower_id = ${viewerId}
        )`,
      ))
      .groupBy(follows.followingId),
  ]);

  const ratingsByUser = groupToMap(ratings, (row) => row.userId);
  const favouritesByUser = groupToMap(favourites, (row) => row.userId);
  const clubsByUser = groupToMap(memberships, (row) => row.userId);
  const mutualByCandidate = new Map(mutualRows.map((row) => [row.candidateId, row.count]));
  const viewerRatings = new Map(
    (ratingsByUser.get(viewerId) ?? []).map((row) => [row.movieId, row.rating as number]),
  );
  const viewerFavourites = new Set((favouritesByUser.get(viewerId) ?? []).map((row) => row.movieId));
  const viewerClubs = new Set((clubsByUser.get(viewerId) ?? []).map((row) => row.clubId));

  return candidates
    .map((candidate) => {
      const candidateRatings = ratingsByUser.get(candidate.id) ?? [];
      let sharedRatings = 0;
      let closeRatings = 0;
      for (const row of candidateRatings) {
        const viewerRating = viewerRatings.get(row.movieId);
        if (viewerRating === undefined || row.rating === null) continue;
        sharedRatings += 1;
        if (Math.abs(viewerRating - row.rating) <= 2) closeRatings += 1;
      }
      const sharedFavourites = (favouritesByUser.get(candidate.id) ?? [])
        .filter((row) => viewerFavourites.has(row.movieId))
        .map((row) => row.title);
      const sharedClubs = (clubsByUser.get(candidate.id) ?? [])
        .filter((row) => viewerClubs.has(row.clubId)).length;
      const mutualFollows = mutualByCandidate.get(candidate.id) ?? 0;
      const signal = { sharedRatings: options.includeTaste ? sharedRatings : 0, sharedFavourites: options.includeTaste ? sharedFavourites : [], sharedClubs, mutualFollows };
      return {
        user: candidate,
        reasons: peopleRecommendationReasons(signal),
        sharedRatings,
        score:
          peopleRecommendationScore(signal) +
          (options.includeTaste ? Math.min(closeRatings, 20) : 0),
      };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((a, b) => b.score - a.score || b.user.filmCount - a.user.filmCount)
    .slice(0, Math.min(Math.max(limit, 1), 40))
    .map(({ score: _score, ...candidate }) => candidate);
}

function groupToMap<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const row of rows) result.set(key(row), [...(result.get(key(row)) ?? []), row]);
  return result;
}

export async function setRecommendationFeedback(input: {
  userId: string;
  targetType: 'user' | 'movie' | 'person';
  targetId: string;
  kind: RecommendationFeedbackKind;
  reasonKind?: RecommendationReasonKind;
}): Promise<void> {
  const expiresAt = feedbackExpiry(input.kind);
  await db.transaction(async (tx) => {
    await tx
      .update(recommendationFeedback)
      .set({ restoredAt: new Date() })
      .where(and(
        eq(recommendationFeedback.userId, input.userId),
        eq(recommendationFeedback.targetType, input.targetType),
        eq(recommendationFeedback.targetId, input.targetId),
        eq(recommendationFeedback.kind, input.kind),
        isNull(recommendationFeedback.restoredAt),
      ));
    await tx.insert(recommendationFeedback).values({ ...input, expiresAt });
  });
}

export async function getActiveRecommendationFeedback(userId: string) {
  return db
    .select()
    .from(recommendationFeedback)
    .where(and(
      eq(recommendationFeedback.userId, userId),
      isNull(recommendationFeedback.restoredAt),
      or(isNull(recommendationFeedback.expiresAt), sql`${recommendationFeedback.expiresAt} > now()`),
    ))
    .orderBy(desc(recommendationFeedback.createdAt));
}

export async function getRecommendationFeedbackSettings(userId: string) {
  const feedback = await getActiveRecommendationFeedback(userId);
  const userIds = feedback.filter((row) => row.targetType === 'user').map((row) => row.targetId);
  const movieIds = feedback.filter((row) => row.targetType === 'movie').map((row) => row.targetId);
  const personIds = feedback.filter((row) => row.targetType === 'person').map((row) => row.targetId);
  const [userRows, movieRows, personRows] = await Promise.all([
    userIds.length
      ? db.select({ id: users.id, label: users.displayName }).from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    movieIds.length
      ? db.select({ id: movies.id, label: movies.title }).from(movies).where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    personIds.length
      ? db.select({ id: people.providerId, label: people.name }).from(people).where(inArray(people.providerId, personIds))
      : Promise.resolve([]),
  ]);
  const labels = new Map([...userRows, ...movieRows, ...personRows].map((row) => [row.id, row.label]));
  return feedback.map((row) => ({ ...row, label: labels.get(row.targetId) ?? 'Unavailable recommendation' }));
}

export async function getSuppressedRecommendationIds(
  userId: string,
  targetType: 'user' | 'movie' | 'person',
): Promise<Set<string>> {
  const rows = await db
    .select({ targetId: recommendationFeedback.targetId })
    .from(recommendationFeedback)
    .where(and(
      eq(recommendationFeedback.userId, userId),
      eq(recommendationFeedback.targetType, targetType),
      isNull(recommendationFeedback.restoredAt),
      or(isNull(recommendationFeedback.expiresAt), sql`${recommendationFeedback.expiresAt} > now()`),
    ));
  return new Set(rows.map((row) => row.targetId));
}

/**
 * Compact social context shared by Search, Watchlist, Lists, Tonight and Film.
 * This is one bounded batch per page, not one query per poster.
 */
export async function getMovieRecommendationContext(
  userId: string,
  movieIds: string[],
): Promise<Map<string, RecommendationReason[]>> {
  const ids = [...new Set(movieIds)].slice(0, 120);
  if (!ids.length) return new Map();
  const [loved, watched, clubInterest, ownWatchlist] = await Promise.all([
    db
      .select({
        movieId: userMovieState.movieId,
        names: sql<string[]>`array_agg(distinct ${users.displayName})`,
      })
      .from(userMovieState)
      .innerJoin(follows, and(eq(follows.followingId, userMovieState.userId), eq(follows.followerId, userId)))
      .innerJoin(users, eq(users.id, userMovieState.userId))
      .where(and(
        inArray(userMovieState.movieId, ids),
        eq(userMovieState.liked, true),
        sql`${users.profileVisibility} <> 'private'`,
        isNull(users.deletedAt),
      ))
      .groupBy(userMovieState.movieId),
    db
      .select({
        movieId: diaryEntries.movieId,
        count: sql<number>`count(distinct ${diaryEntries.userId})::int`,
      })
      .from(diaryEntries)
      .innerJoin(follows, and(eq(follows.followingId, diaryEntries.userId), eq(follows.followerId, userId)))
      .innerJoin(users, eq(users.id, diaryEntries.userId))
      .where(and(
        inArray(diaryEntries.movieId, ids),
        isNull(diaryEntries.deletedAt),
        sql`${diaryEntries.visibility} <> 'private'`,
        sql`${users.profileVisibility} <> 'private'`,
        isNull(users.deletedAt),
      ))
      .groupBy(diaryEntries.movieId),
    db
      .select({ movieId: clubQueueItems.movieId, count: sql<number>`count(distinct ${clubQueueItems.clubId})::int` })
      .from(clubQueueItems)
      .innerJoin(clubMembers, and(
        eq(clubMembers.clubId, clubQueueItems.clubId),
        eq(clubMembers.userId, userId),
        eq(clubMembers.status, 'active'),
      ))
      .where(and(inArray(clubQueueItems.movieId, ids), isNull(clubQueueItems.removedAt)))
      .groupBy(clubQueueItems.movieId),
    db
      .select({ movieId: userMovieState.movieId })
      .from(userMovieState)
      .where(and(
        eq(userMovieState.userId, userId),
        inArray(userMovieState.movieId, ids),
        eq(userMovieState.inWatchlist, true),
      )),
  ]);

  const result = new Map<string, RecommendationReason[]>();
  const add = (movieId: string, reason: RecommendationReason) => {
    result.set(movieId, [...(result.get(movieId) ?? []), reason]);
  };
  loved.forEach((row) => add(row.movieId, { kind: 'friend_loved', names: row.names.slice(0, 3) }));
  watched.forEach((row) => add(row.movieId, { kind: 'friend_watched', count: row.count }));
  clubInterest.forEach((row) => add(row.movieId, { kind: 'club_interest', count: row.count }));
  ownWatchlist.forEach((row) => add(row.movieId, { kind: 'on_watchlist' }));
  return result;
}

export type TonightRecommendation = {
  movie: Movie;
  reasons: RecommendationReason[];
  availability: Awaited<ReturnType<typeof getAvailabilityForMovies>> extends Map<string, infer A> ? A : never;
};

export async function getTonightRecommendations(
  userId: string,
  region: string,
  limit = 18,
): Promise<TonightRecommendation[]> {
  const [watchlistRows, clubRows, suppressed] = await Promise.all([
    db
      .select({ movie: movies })
      .from(userMovieState)
      .innerJoin(movies, eq(movies.id, userMovieState.movieId))
      .where(and(eq(userMovieState.userId, userId), eq(userMovieState.inWatchlist, true)))
      .orderBy(desc(userMovieState.watchlistedAt))
      .limit(30),
    db
      .select({ movie: movies })
      .from(clubQueueItems)
      .innerJoin(movies, eq(movies.id, clubQueueItems.movieId))
      .innerJoin(clubMembers, and(
        eq(clubMembers.clubId, clubQueueItems.clubId),
        eq(clubMembers.userId, userId),
        eq(clubMembers.status, 'active'),
      ))
      .where(isNull(clubQueueItems.removedAt))
      .orderBy(desc(clubQueueItems.createdAt))
      .limit(30),
    getSuppressedRecommendationIds(userId, 'movie'),
  ]);
  const byId = new Map<string, Movie>();
  [...watchlistRows, ...clubRows].forEach(({ movie }) => {
    if (!suppressed.has(movie.id) && !byId.has(movie.id)) byId.set(movie.id, movie);
  });
  const candidates = [...byId.values()].slice(0, 24);
  const [context, availability] = await Promise.all([
    getMovieRecommendationContext(userId, candidates.map((movie) => movie.id)),
    getAvailabilityForMovies(candidates, region, { limit: 24, concurrency: 4 }),
  ]);
  const hasAtHome = (movieId: string) => {
    const item = availability.get(movieId);
    return Boolean(item && (item.stream.length || item.free.length));
  };
  return candidates
    .map((movie) => ({ movie, reasons: context.get(movie.id) ?? [], availability: availability.get(movie.id) ?? null }))
    .sort((a, b) => Number(hasAtHome(b.movie.id)) - Number(hasAtHome(a.movie.id)) || b.reasons.length - a.reasons.length || (a.movie.runtime ?? 999) - (b.movie.runtime ?? 999))
    .slice(0, Math.min(Math.max(limit, 1), 24));
}

export async function restoreRecommendationFeedback(userId: string, feedbackId: string): Promise<void> {
  await db
    .update(recommendationFeedback)
    .set({ restoredAt: new Date() })
    .where(and(eq(recommendationFeedback.id, feedbackId), eq(recommendationFeedback.userId, userId)));
}

export async function getTasteCircle(userId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      createdAt: tasteCircleMembers.createdAt,
    })
    .from(tasteCircleMembers)
    .innerJoin(users, eq(users.id, tasteCircleMembers.memberUserId))
    .where(and(eq(tasteCircleMembers.userId, userId), isNull(users.deletedAt)))
    .orderBy(asc(tasteCircleMembers.createdAt));
}

export async function setTasteCircleMember(
  userId: string,
  memberUserId: string,
  included: boolean,
): Promise<void> {
  if (userId === memberUserId) throw new ValidationError('You cannot add yourself to your Taste circle.');
  await assertCanInteractWith(userId, memberUserId);
  if (!included) {
    await db.delete(tasteCircleMembers).where(and(
      eq(tasteCircleMembers.userId, userId),
      eq(tasteCircleMembers.memberUserId, memberUserId),
    ));
    return;
  }

  await db.transaction(async (tx) => {
    const [follow, count] = await Promise.all([
      tx.select({ id: follows.followingId }).from(follows).where(and(
        eq(follows.followerId, userId),
        eq(follows.followingId, memberUserId),
      )).limit(1),
      tx.select({ value: sql<number>`count(*)::int` }).from(tasteCircleMembers).where(
        eq(tasteCircleMembers.userId, userId),
      ),
    ]);
    if (!follow.length) throw new PermissionError('Follow this person before adding them to your Taste circle.');
    if ((count[0]?.value ?? 0) >= TASTE_CIRCLE_LIMIT) {
      throw new ValidationError('Your Taste circle can include up to five people.');
    }
    await tx.insert(tasteCircleMembers).values({ userId, memberUserId }).onConflictDoNothing();
  });
}

export async function setTasteCircleFeedEnabled(userId: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ tasteCircleFeedEnabled: enabled, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function ensurePerson(providerId: string) {
  const provider = primaryProvider();
  const canonicalProvider = provider.id === 'offline' ? 'tmdb' : provider.id;
  const [existing] = await db.select().from(people).where(and(
    eq(people.provider, canonicalProvider),
    eq(people.providerId, providerId),
  )).limit(1);
  if (existing) return existing;

  const { data } = await withProvider((source) => source.getPerson(providerId));
  if (!data) throw new NotFoundError('We could not find that filmmaker.');
  const [saved] = await db.insert(people).values({
    provider: canonicalProvider,
    providerId: data.providerId,
    name: data.name,
    slug: slugify(data.name),
    profilePath: data.profilePath,
    knownForDepartment: data.knownForDepartment,
  }).onConflictDoUpdate({
    target: [people.provider, people.providerId],
    set: {
      name: data.name,
      profilePath: data.profilePath,
      knownForDepartment: data.knownForDepartment,
    },
  }).returning();
  return saved;
}

export async function setPersonFollow(userId: string, providerId: string, followed: boolean) {
  const person = await ensurePerson(providerId);
  if (followed) {
    await db.insert(personFollows).values({ userId, personId: person.id }).onConflictDoNothing();
  } else {
    await db.delete(personFollows).where(and(
      eq(personFollows.userId, userId),
      eq(personFollows.personId, person.id),
    ));
  }
  return person;
}

export async function getPersonFollowState(userId: string, providerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: personFollows.personId })
    .from(personFollows)
    .innerJoin(people, eq(people.id, personFollows.personId))
    .where(and(eq(personFollows.userId, userId), eq(people.providerId, providerId)))
    .limit(1);
  return Boolean(row);
}

export async function getFollowedFilmmakers(userId: string) {
  return db
    .select({ person: people, followedAt: personFollows.createdAt })
    .from(personFollows)
    .innerJoin(people, eq(people.id, personFollows.personId))
    .where(eq(personFollows.userId, userId))
    .orderBy(desc(personFollows.createdAt));
}

export async function getKnownUpcomingWork(userId: string) {
  const followed = await getFollowedFilmmakers(userId);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await Promise.all(followed.slice(0, 12).map(async ({ person }) => {
    const result = await withProvider((provider) => provider.getPerson(person.providerId));
    const summaries = (result.data?.knownFor ?? [])
      .filter((movie) => movie.releaseDate && movie.releaseDate >= today && !movie.adult)
      .slice(0, 6);
    const saved = await ensureMoviesFromSummaries(summaries);
    return saved.map((movie) => ({ film: toFilmRef(movie), releaseDate: movie.releaseDate, person }));
  }));
  return rows.flat().sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '')).slice(0, 24);
}
