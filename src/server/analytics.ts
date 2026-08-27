import 'server-only';

import { db, type DbOrTx } from '@/server/db';
import { analyticsEvents } from '@/server/db/schema';

/**
 * Product analytics. Deliberately a small, named vocabulary: these are the
 * events we need to answer "does this product work?", specifically whether club
 * members and importers retain better than everyone else.
 */
export const ANALYTICS_EVENTS = [
  'signup',
  'onboarding_step_completed',
  'onboarding_completed',
  'onboarding_skipped',
  'import_started',
  'import_completed',
  'film_logged',
  'first_film_logged',
  'film_rated',
  'first_film_rated',
  'review_written',
  'watchlist_added',
  'first_watchlist_add',
  'user_followed',
  'first_follow',
  'list_created',
  'club_created',
  'club_joined',
  'club_queue_added',
  'round_opened',
  'nomination_created',
  'vote_cast',
  'winner_revealed',
  'screening_scheduled',
  'screening_rsvp',
  'screening_completed',
  'attendance_confirmed',
  'club_rating_submitted',
  'club_discussion_posted',
  'recommendation_opened',
  'recommendation_hidden',
  'recommendation_restored',
  'recommended_follow',
  'taste_circle_changed',
  'filmmaker_followed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export async function track(
  name: AnalyticsEventName,
  userId: string | null,
  properties: Record<string, unknown> = {},
  tx: DbOrTx = db,
): Promise<void> {
  try {
    await tx.insert(analyticsEvents).values({ name, userId, properties });
  } catch (error) {
    // Analytics must never break a user action.
    console.error('[analytics] failed to record', name, error);
  }
}

/**
 * Records `first_*` alongside the repeatable event the first time a user does
 * something. Used for activation funnels.
 */
export async function trackFirst(
  name: AnalyticsEventName,
  firstName: AnalyticsEventName,
  userId: string,
  isFirst: boolean,
  properties: Record<string, unknown> = {},
  tx: DbOrTx = db,
): Promise<void> {
  await track(name, userId, properties, tx);
  if (isFirst) await track(firstName, userId, properties, tx);
}
