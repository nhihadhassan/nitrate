'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { actionGuard, type ActionResult } from '@/server/errors';
import {
  restoreRecommendationFeedback,
  setPersonFollow,
  setRecommendationFeedback,
  setTasteCircleFeedEnabled,
  setTasteCircleMember,
} from '@/server/services/discovery';

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
