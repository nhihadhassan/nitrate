'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { getCurrentUser, requireUser } from '@/server/auth/session';
import { EXPLORE_MAX_BATCHES, EXPLORE_MAX_EXCLUDED_IDS, EXPLORE_MAX_RAIL_PAGE, normalizeExploreIds, type ExploreCursor, type ExploreModule, type ExploreRailFilm, type RailContinuation } from '@/lib/explore';
import { actionGuard, type ActionResult } from '@/server/errors';
import {
  restoreRecommendationFeedback,
  setPersonFollow,
  setRecommendationFeedback,
  setTasteCircleFeedEnabled,
  setTasteCircleMember,
} from '@/server/services/discovery';
import { getExploreModuleBatch, getExploreRailPage } from '@/server/services/explore';
import { getOwnershipMap } from '@/server/services/ownership';

const feedbackSchema = z.object({
  targetType: z.enum(['user', 'movie', 'person']),
  targetId: z.string().min(1).max(120),
  kind: z.enum(['hide', 'already_know', 'less_like_this']),
  reasonKind: z.enum([
    'friend_loved',
    'friend_watched',
    'club_interest',
    'shared_ratings',
    'shared_favourite',
    'social_proximity',
    'favourite_genre',
    'similar_to_film',
    'on_watchlist',
    'filmmaker_follow',
    'community_signal',
  ]).optional(),
});

const railContinuationSchema = z.object({
  source: z.enum(['trending', 'popular', 'top-rated', 'now-playing', 'upcoming', 'canon', 'genre', 'decade', 'hidden-gems', 'similar']),
  nextPage: z.number().int().min(1).max(EXPLORE_MAX_RAIL_PAGE),
  genreId: z.string().min(1).max(20).optional(),
  decade: z.number().int().min(1900).max(2030).multipleOf(10).optional(),
  providerId: z.string().min(1).max(40).optional(),
}).superRefine((value, context) => {
  if (value.source === 'genre' && !value.genreId) context.addIssue({ code: 'custom', message: 'A genre is required.' });
  if (value.source === 'decade' && value.decade === undefined) context.addIssue({ code: 'custom', message: 'A decade is required.' });
  if (value.source === 'similar' && !value.providerId) context.addIssue({ code: 'custom', message: 'A source film is required.' });
});

const excludedIdsSchema = z.array(z.string().uuid()).max(EXPLORE_MAX_EXCLUDED_IDS);

async function markOwned(modules: ExploreModule[], userId: string | null): Promise<ExploreModule[]> {
  if (!userId) return modules;
  const movieIds = modules.flatMap((feedModule) => feedModule.type === 'poster_rail' ? feedModule.films.map((film) => film.id) : []);
  const ownership = await getOwnershipMap(userId, movieIds);
  return modules.map((feedModule) => feedModule.type === 'poster_rail'
    ? { ...feedModule, films: feedModule.films.map((film) => ownership.has(film.id) ? { ...film, owned: true } : film) }
    : feedModule);
}

export async function loadExploreRailAction(input: {
  continuation: RailContinuation;
  excludedMovieIds: string[];
}): Promise<ActionResult<{ films: ExploreRailFilm[]; continuation?: RailContinuation; degraded: boolean }>> {
  return actionGuard(async () => {
    const continuation = railContinuationSchema.parse(input.continuation) as RailContinuation;
    const excludedMovieIds = excludedIdsSchema.parse(normalizeExploreIds(input.excludedMovieIds));
    const page = await getExploreRailPage(continuation, new Set(excludedMovieIds));
    const user = await getCurrentUser();
    const [feedModule] = await markOwned([{
      id: 'rail-page',
      type: 'poster_rail',
      title: 'More films',
      films: page.films,
      continuation: page.continuation,
      degraded: page.degraded,
    }], user?.id ?? null);
    if (feedModule.type !== 'poster_rail') throw new Error('Unexpected Explore module.');
    return { films: feedModule.films, continuation: feedModule.continuation, degraded: page.degraded };
  });
}

export async function loadExploreModulesAction(input: {
  cursor: ExploreCursor;
  excludedMovieIds: string[];
}): Promise<ActionResult<{ modules: ExploreModule[]; cursor: ExploreCursor | null; degraded: boolean }>> {
  return actionGuard(async () => {
    const cursor = z.object({
      batch: z.number().int().min(0).max(EXPLORE_MAX_BATCHES),
      seed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input.cursor) as ExploreCursor;
    const excludedMovieIds = excludedIdsSchema.parse(normalizeExploreIds(input.excludedMovieIds));
    const user = await getCurrentUser();
    const result = await getExploreModuleBatch({ userId: user?.id ?? null, cursor, excludedIds: excludedMovieIds });
    return { ...result, modules: await markOwned(result.modules, user?.id ?? null) };
  });
}

export async function recommendationFeedbackAction(
  input: z.infer<typeof feedbackSchema>,
): Promise<ActionResult<void>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = feedbackSchema.parse(input);
    await setRecommendationFeedback({ userId: user.id, ...parsed });
    await track('recommendation_hidden', user.id, parsed);
    revalidatePath('/explore');
    revalidatePath('/explore/people');
    revalidatePath('/settings/discovery');
  });
}

export async function restoreRecommendationAction(feedbackId: string): Promise<ActionResult<void>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await restoreRecommendationFeedback(user.id, z.string().uuid().parse(feedbackId));
    await track('recommendation_restored', user.id, { feedbackId });
    revalidatePath('/explore');
    revalidatePath('/explore/people');
    revalidatePath('/settings/discovery');
  });
}

export async function setTasteCircleMemberAction(
  memberUserId: string,
  included: boolean,
): Promise<ActionResult<void>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const targetId = z.string().uuid().parse(memberUserId);
    await setTasteCircleMember(user.id, targetId, included);
    await track('taste_circle_changed', user.id, { memberUserId: targetId, included });
    revalidatePath('/taste-circle');
    revalidatePath('/settings/discovery');
    revalidatePath('/explore/people');
  });
}

export async function setTasteCircleFeedAction(enabled: boolean): Promise<ActionResult<void>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await setTasteCircleFeedEnabled(user.id, z.boolean().parse(enabled));
    revalidatePath('/taste-circle');
    revalidatePath('/settings/discovery');
  });
}

export async function setPersonFollowAction(
  providerId: string,
  followed: boolean,
): Promise<ActionResult<{ followed: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const id = z.string().min(1).max(40).parse(providerId);
    const person = await setPersonFollow(user.id, id, z.boolean().parse(followed));
    if (followed) await track('filmmaker_followed', user.id, { personId: person.id });
    revalidatePath(`/person/${id}`);
    revalidatePath('/settings/discovery');
    return { followed };
  });
}

export async function trackRecommendationOpenAction(input: {
  targetType: 'user' | 'movie' | 'person';
  targetId: string;
  reasonKind?: string;
}): Promise<ActionResult<void>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await track('recommendation_opened', user.id, {
      targetType: input.targetType,
      targetId: input.targetId.slice(0, 120),
      reasonKind: input.reasonKind?.slice(0, 60),
    });
  });
}
