'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { actionGuard, ValidationError, type ActionResult } from '@/server/errors';
import { ensureMovieByProviderId, getMovieById } from '@/server/movies/catalog';
import { setFavoriteFilms } from '@/server/services/profile';
import { updateFilmState } from '@/server/services/films';

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Tell us what to call you.').max(50),
  bio: z.string().trim().max(500).nullable(),
  location: z.string().trim().max(60).nullable(),
  websiteUrl: z
    .string()
    .trim()
    .max(200)
    .refine((value) => !value || /^https?:\/\/\S+\.\S+/.test(value), 'Enter a full URL.')
    .nullable(),
  pronouns: z.string().trim().max(30).nullable(),
  avatarAssetId: z.string().uuid().nullable(),
  timezone: z.string().trim().max(64).optional(),
  watchRegion: z.string().trim().length(2).nullable().optional(),
});

export async function updateProfileAction(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = profileSchema.parse(input);

    await db
      .update(users)
      .set({
        displayName: parsed.displayName,
        bio: parsed.bio || null,
        location: parsed.location || null,
        websiteUrl: parsed.websiteUrl || null,
        pronouns: parsed.pronouns || null,
        avatarAssetId: parsed.avatarAssetId,
        timezone: parsed.timezone ?? user.timezone,
        watchRegion:
          parsed.watchRegion === undefined ? user.watchRegion : parsed.watchRegion?.toUpperCase() || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath(`/@${user.username}`);
    return null;
  });
}

const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'followers', 'private']),
  defaultEntryVisibility: z.enum(['public', 'followers', 'private']),
  showWatchlistPublicly: z.boolean(),
  allowFollows: z.boolean(),
  adultContent: z.boolean(),
});

export async function updatePrivacyAction(
  input: z.infer<typeof privacySchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = privacySchema.parse(input);
    await db.update(users).set({ ...parsed, updatedAt: new Date() }).where(eq(users.id, user.id));
    revalidatePath('/settings/privacy');
    return null;
  });
}

const emailPreferencesSchema = z.object({
  emailMovieNightReminders: z.boolean(),
  emailPicksAndVoting: z.boolean(),
  emailWinnerSelected: z.boolean(),
});

export async function updateEmailPreferencesAction(
  input: z.infer<typeof emailPreferencesSchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = emailPreferencesSchema.parse(input);
    await db.update(users).set({ ...parsed, updatedAt: new Date() }).where(eq(users.id, user.id));
    revalidatePath('/settings/notifications');
    return null;
  });
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only.');

export async function changeUsernameAction(username: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = usernameSchema.parse(username);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${parsed.toLowerCase()} and ${users.id} <> ${user.id}`)
      .limit(1);
    if (existing.length) {
      throw new ValidationError('That username is taken.', { username: 'Already taken.' });
    }

    await db.update(users).set({ username: parsed, updatedAt: new Date() }).where(eq(users.id, user.id));
    revalidatePath(`/@${parsed}`);
    return null;
  });
}

const favoritesSchema = z
  .array(z.object({ movieId: z.string().uuid().optional(), providerId: z.string().optional() }))
  .max(4);

export async function setFavoritesAction(
  input: z.infer<typeof favoritesSchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = favoritesSchema.parse(input);

    const movieIds: string[] = [];
    for (const film of parsed) {
      const movie = film.movieId
        ? await getMovieById(film.movieId)
        : await ensureMovieByProviderId(film.providerId!);
      movieIds.push(movie.id);
    }

    await setFavoriteFilms(user.id, movieIds);
    revalidatePath(`/@${user.username}`);
    return null;
  });
}

/**
 * Onboarding's taste starter. Each pick is a real rating and/or like, so the
 * profile is genuinely non-empty by the end of signup rather than seeded with
 * throwaway data.
 */
export async function quickRateAction(input: {
  providerId?: string;
  movieId?: string;
  rating: number | null;
  liked: boolean;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const movie = input.movieId
      ? await getMovieById(input.movieId)
      : await ensureMovieByProviderId(input.providerId!);

    await updateFilmState(user.id, movie.id, {
      watched: true,
      rating: input.rating,
      liked: input.liked,
    });
    return null;
  });
}

export async function completeOnboardingAction(
  skipped: boolean,
): Promise<ActionResult<{ username: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    if (!user.onboardingCompletedAt) {
      await db
        .update(users)
        .set({ onboardingCompletedAt: new Date() })
        .where(eq(users.id, user.id));
      await track(skipped ? 'onboarding_skipped' : 'onboarding_completed', user.id);
    }
    revalidatePath('/');
    return { username: user.username };
  });
}

export async function trackOnboardingStepAction(step: string): Promise<void> {
  const user = await requireUser().catch(() => null);
  if (!user) return;
  await track('onboarding_step_completed', user.id, { step });
}
