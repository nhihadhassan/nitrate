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
} from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { ensureMoviesFromSummaries, toFilmRef } from '@/server/movies/catalog';
import { primaryProvider, withProvider } from '@/server/movies/provider';
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
      const signal = { sharedRatings, sharedFavourites, sharedClubs, mutualFollows };
      return {
        user: candidate,
        reasons: peopleRecommendationReasons(signal),
        sharedRatings,
        score: peopleRecommendationScore(signal) + Math.min(closeRatings, 20),
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
