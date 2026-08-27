'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/server/auth/session';
import { track, trackFirst } from '@/server/analytics';
import { actionGuard, NotFoundError, type ActionResult } from '@/server/errors';
import { ensureMovieByProviderId, getMovieById } from '@/server/movies/catalog';
import { consumeRateLimit } from '@/server/rate-limit';
import {
  deleteDiaryEntry,
  logFilm,
  updateDiaryEntry,
  updateFilmState,
  updateWatchlistNote,
} from '@/server/services/films';

const filmRef = z
  .object({
    movieId: z.string().uuid().optional(),
    providerId: z.string().min(1).optional(),
  })
  .refine((value) => value.movieId || value.providerId, {
    message: 'A film is required.',
  });

/** Resolves either a local id or a provider id into a canonical local film. */
async function resolveFilm(ref: { movieId?: string; providerId?: string }) {
  if (ref.movieId) return getMovieById(ref.movieId);
  if (ref.providerId) return ensureMovieByProviderId(ref.providerId);
  throw new NotFoundError('No film specified.');
}

const visibilityEnum = z.enum(['public', 'followers', 'private']);
const viewingContextEnum = z.enum(['cinema', 'home', 'friend_home', 'club', 'festival', 'travel', 'other']);

const logSchema = filmRef.and(
  z.object({
    watchedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.'),
    rating: z.number().int().min(1).max(10).nullable(),
    liked: z.boolean(),
    reviewText: z.string().max(10_000).nullable(),
    containsSpoilers: z.boolean(),
    visibility: visibilityEnum,
    tags: z.array(z.string().max(40)).max(12),
    isRewatch: z.boolean().optional(),
    screeningId: z.string().uuid().nullable().optional(),
    viewingContext: viewingContextEnum.nullable().optional(),
  }),
);

export type LogFilmActionInput = z.infer<typeof logSchema>;

export async function logFilmAction(
  input: LogFilmActionInput,
): Promise<ActionResult<{ entryId: string; movieSlug: string; removedFromWatchlist: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('log_film', user.id);
    const parsed = logSchema.parse(input);
    const movie = await resolveFilm(parsed);

    const result = await logFilm({
      userId: user.id,
      movieId: movie.id,
      watchedDate: parsed.watchedDate,
      rating: parsed.rating,
      liked: parsed.liked,
      reviewText: parsed.reviewText?.trim() || null,
      containsSpoilers: parsed.containsSpoilers,
      visibility: parsed.visibility,
      tags: parsed.tags,
      isRewatch: parsed.isRewatch,
      screeningId: parsed.screeningId ?? null,
      upsertOnScreening: Boolean(parsed.screeningId),
      source: parsed.screeningId ? 'club' : 'manual',
      viewingContext: parsed.viewingContext ?? null,
    });

    await trackFirst('film_logged', 'first_film_logged', user.id, result.isFirstLog, {
      movieId: movie.id,
      hasReview: Boolean(parsed.reviewText),
      rating: parsed.rating,
      fromClub: Boolean(parsed.screeningId),
    });
    if (parsed.rating !== null) {
      await trackFirst('film_rated', 'first_film_rated', user.id, result.isFirstRating, {
        movieId: movie.id,
        rating: parsed.rating,
      });
    }
    if (parsed.reviewText) {
      await track('review_written', user.id, { movieId: movie.id });
    }

    revalidatePath(`/film/${movie.slug}`);
    revalidatePath(`/@${user.username}`);
    revalidatePath('/');

    return {
      entryId: result.entry.id,
      movieSlug: movie.slug,
      removedFromWatchlist: result.removedFromWatchlist,
    };
  });
}

const stateSchema = filmRef.and(
  z.object({
    watched: z.boolean().optional(),
    liked: z.boolean().optional(),
    rating: z.number().int().min(1).max(10).nullable().optional(),
    inWatchlist: z.boolean().optional(),
  }),
);

export async function updateFilmStateAction(
  input: z.infer<typeof stateSchema>,
): Promise<ActionResult<{ movieSlug: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('log_film', user.id);
    const parsed = stateSchema.parse(input);
    const movie = await resolveFilm(parsed);

    const before = parsed.inWatchlist === true;
    await updateFilmState(user.id, movie.id, {
      watched: parsed.watched,
      liked: parsed.liked,
      rating: parsed.rating,
      inWatchlist: parsed.inWatchlist,
    });

    if (before) {
      await track('watchlist_added', user.id, { movieId: movie.id });
    }
    if (parsed.rating != null) {
      await track('film_rated', user.id, { movieId: movie.id, rating: parsed.rating });
    }

    revalidatePath(`/film/${movie.slug}`);
    return { movieSlug: movie.slug };
  });
}

export async function updateWatchlistNoteAction(input: {
  movieId: string;
  note: string | null;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z
      .object({ movieId: z.string().uuid(), note: z.string().trim().max(500).nullable() })
      .parse(input);
    await updateWatchlistNote(user.id, parsed.movieId, parsed.note?.trim() || null);
    revalidatePath('/watchlist');
    return null;
  });
}

export async function updateEntryAction(input: {
  entryId: string;
  watchedDate?: string;
  rating?: number | null;
  liked?: boolean;
  reviewText?: string | null;
  containsSpoilers?: boolean;
  visibility?: 'public' | 'followers' | 'private';
  tags?: string[];
  viewingContext?: z.infer<typeof viewingContextEnum> | null;
}): Promise<ActionResult<{ entryId: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const schema = z.object({
      entryId: z.string().uuid(),
      watchedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      rating: z.number().int().min(1).max(10).nullable().optional(),
      liked: z.boolean().optional(),
      reviewText: z.string().max(10_000).nullable().optional(),
      containsSpoilers: z.boolean().optional(),
      visibility: visibilityEnum.optional(),
      tags: z.array(z.string().max(40)).max(12).optional(),
      viewingContext: viewingContextEnum.nullable().optional(),
    });
    const parsed = schema.parse(input);
    const entry = await updateDiaryEntry(user.id, parsed.entryId, parsed);
    revalidatePath(`/@${user.username}/diary`);
    revalidatePath(`/review/${entry.id}`);
    return { entryId: entry.id };
  });
}

export async function deleteEntryAction(entryId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await deleteDiaryEntry(user.id, entryId);
    revalidatePath(`/@${user.username}/diary`);
    return null;
  });
}
