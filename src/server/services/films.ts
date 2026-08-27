import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { slugify } from '@/lib/utils';
import { db, type DbOrTx } from '@/server/db';
import {
  activityEvents,
  diaryEntries,
  diaryEntryTags,
  movies,
  tags as tagsTable,
  userMovieState,
  users,
  type DiaryEntry,
  type UserMovieState,
} from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';

/* -------------------------------------------------------------------------- */
/* Aggregate maintenance                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A film's community score is the average of each user's *current* rating —
 * one vote per person, not one per viewing. Applying deltas keeps the film page
 * from ever running an aggregate over every rating row.
 */
async function applyRatingDelta(
  tx: DbOrTx,
  movieId: string,
  previous: number | null,
  next: number | null,
): Promise<void> {
  if (previous === next) return;

  const countDelta = (next === null ? 0 : 1) - (previous === null ? 0 : 1);
  const sumDelta = (next ?? 0) - (previous ?? 0);

  await tx
    .update(movies)
    .set({
      ratingCount: sql`greatest(${movies.ratingCount} + ${countDelta}, 0)`,
      ratingSum: sql`greatest(${movies.ratingSum} + ${sumDelta}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(movies.id, movieId));

  if (previous !== null) {
    const bucket = String(previous);
    await tx
      .update(movies)
      .set({
        ratingHistogram: sql`coalesce(${movies.ratingHistogram}, '{}'::jsonb) || jsonb_build_object(${bucket}::text, greatest(coalesce((${movies.ratingHistogram}->>${bucket}::text)::int, 0) - 1, 0))`,
      })
      .where(eq(movies.id, movieId));
  }

  if (next !== null) {
    const bucket = String(next);
    await tx
      .update(movies)
      .set({
        ratingHistogram: sql`coalesce(${movies.ratingHistogram}, '{}'::jsonb) || jsonb_build_object(${bucket}::text, coalesce((${movies.ratingHistogram}->>${bucket}::text)::int, 0) + 1)`,
      })
      .where(eq(movies.id, movieId));
  }
}

async function bumpMovieCounter(
  tx: DbOrTx,
  movieId: string,
  column: 'watchCount' | 'likeCount' | 'logCount' | 'watchlistCount',
  delta: number,
): Promise<void> {
  const columns = {
    watchCount: movies.watchCount,
    likeCount: movies.likeCount,
    logCount: movies.logCount,
    watchlistCount: movies.watchlistCount,
  } as const;
  await tx
    .update(movies)
    .set({ [column]: sql`greatest(${columns[column]} + ${delta}, 0)` })
    .where(eq(movies.id, movieId));
}

/* -------------------------------------------------------------------------- */
/* User film state                                                            */
/* -------------------------------------------------------------------------- */

export async function getUserMovieState(
  userId: string,
  movieId: string,
): Promise<UserMovieState | null> {
  const [row] = await db
    .select()
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.movieId, movieId)))
    .limit(1);
  return row ?? null;
}

export async function updateWatchlistNote(
  userId: string,
  movieId: string,
  note: string | null,
): Promise<void> {
  const [updated] = await db
    .update(userMovieState)
    .set({ note })
    .where(
      and(
        eq(userMovieState.userId, userId),
        eq(userMovieState.movieId, movieId),
        eq(userMovieState.inWatchlist, true),
      ),
    )
    .returning({ movieId: userMovieState.movieId });
  if (!updated) throw new NotFoundError('That film is not on your watchlist.');
}

async function ensureState(tx: DbOrTx, userId: string, movieId: string): Promise<UserMovieState> {
  const [row] = await tx
    .insert(userMovieState)
    .values({ userId, movieId })
    .onConflictDoUpdate({
      target: [userMovieState.userId, userMovieState.movieId],
      set: { updatedAt: new Date() },
    })
    .returning();
  return row;
}

export type FilmStateChange = {
  watched?: boolean;
  liked?: boolean;
  rating?: number | null;
  inWatchlist?: boolean;
};

/**
 * The single write path for "how do I feel about this film right now".
 * Everything (film page buttons, log flow, importer, club post-screening) goes
 * through here so aggregates and activity can never drift.
 */
export async function updateFilmState(
  userId: string,
  movieId: string,
  change: FilmStateChange,
  options: { tx?: DbOrTx; emitActivity?: boolean; visibility?: 'public' | 'followers' | 'private' } = {},
): Promise<UserMovieState> {
  const run = async (tx: DbOrTx) => {
    const before = await ensureState(tx, userId, movieId);
    const patch: Partial<typeof userMovieState.$inferInsert> = { updatedAt: new Date() };
    const nowDate = new Date();

    if (change.watched !== undefined && change.watched !== before.watched) {
      patch.watched = change.watched;
      patch.watchedAt = change.watched ? (before.watchedAt ?? nowDate) : null;
      await bumpMovieCounter(tx, movieId, 'watchCount', change.watched ? 1 : -1);
      await tx
        .update(users)
        .set({ filmCount: sql`greatest(${users.filmCount} + ${change.watched ? 1 : -1}, 0)` })
        .where(eq(users.id, userId));
    }

    if (change.liked !== undefined && change.liked !== before.liked) {
      patch.liked = change.liked;
      patch.likedAt = change.liked ? nowDate : null;
      await bumpMovieCounter(tx, movieId, 'likeCount', change.liked ? 1 : -1);
    }

    if (change.rating !== undefined && change.rating !== before.rating) {
      patch.rating = change.rating;
      patch.ratedAt = change.rating === null ? null : nowDate;
      await applyRatingDelta(tx, movieId, before.rating, change.rating);
      // Rating something implies you have seen it.
      if (change.rating !== null && !before.watched && change.watched === undefined) {
        patch.watched = true;
        patch.watchedAt = nowDate;
        await bumpMovieCounter(tx, movieId, 'watchCount', 1);
        await tx
          .update(users)
          .set({ filmCount: sql`${users.filmCount} + 1` })
          .where(eq(users.id, userId));
      }
    }

    if (change.inWatchlist !== undefined && change.inWatchlist !== before.inWatchlist) {
      patch.inWatchlist = change.inWatchlist;
      patch.watchlistedAt = change.inWatchlist ? nowDate : null;
      await bumpMovieCounter(tx, movieId, 'watchlistCount', change.inWatchlist ? 1 : -1);
    }

    const [after] = await tx
      .update(userMovieState)
      .set(patch)
      .where(eq(userMovieState.id, before.id))
      .returning();

    if (options.emitActivity !== false) {
      const visibility = options.visibility ?? 'public';
      const events: (typeof activityEvents.$inferInsert)[] = [];
      if (patch.rating !== undefined && patch.rating !== null) {
        events.push({ actorId: userId, type: 'film_rated', movieId, visibility, metadata: { rating: patch.rating } });
      }
      if (patch.liked === true) {
        events.push({ actorId: userId, type: 'film_liked', movieId, visibility });
      }
      if (patch.watched === true && change.watched === true) {
        events.push({ actorId: userId, type: 'film_watched', movieId, visibility });
      }
      if (events.length) await tx.insert(activityEvents).values(events);
    }

    return after;
  };

  return options.tx ? run(options.tx) : db.transaction(run);
}

/* -------------------------------------------------------------------------- */
/* Diary                                                                      */
/* -------------------------------------------------------------------------- */

export type LogFilmInput = {
  userId: string;
  movieId: string;
  watchedDate: string;
  rating: number | null;
  liked: boolean;
  reviewText: string | null;
  containsSpoilers: boolean;
  visibility: 'public' | 'followers' | 'private';
  tags: string[];
  isRewatch?: boolean;
  source?: 'manual' | 'import' | 'club';
  screeningId?: string | null;
  importBatchId?: string | null;
  externalKey?: string | null;
  /** When true an existing entry for the same screening is updated, not duplicated. */
  upsertOnScreening?: boolean;
};

export type LogFilmResult = {
  entry: DiaryEntry;
  removedFromWatchlist: boolean;
  isFirstLog: boolean;
  isFirstRating: boolean;
  created: boolean;
};

export async function logFilm(input: LogFilmInput): Promise<LogFilmResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.watchedDate)) {
    throw new ValidationError('Pick a valid date.', { watchedDate: 'Use a real date.' });
  }
  if (input.watchedDate > new Date().toISOString().slice(0, 10)) {
    throw new ValidationError('You cannot log a film in the future.', {
      watchedDate: 'That date has not happened yet.',
    });
  }

  return db.transaction(async (tx) => {
    const before = await ensureState(tx, input.userId, input.movieId);
    const isFirstLog = before.logCount === 0 && !(await userHasAnyLog(tx, input.userId));
    const isFirstRating = input.rating !== null && !(await userHasAnyRating(tx, input.userId));

    // Reuse the club screening's entry rather than creating a second one.
    let existing: DiaryEntry | null = null;
    if (input.upsertOnScreening && input.screeningId) {
      const [row] = await tx
        .select()
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, input.userId),
            eq(diaryEntries.screeningId, input.screeningId),
          ),
        )
        .limit(1);
      existing = row ?? null;
    }
    if (!existing && input.externalKey) {
      const [row] = await tx
        .select()
        .from(diaryEntries)
        .where(
          and(eq(diaryEntries.userId, input.userId), eq(diaryEntries.externalKey, input.externalKey)),
        )
        .limit(1);
      existing = row ?? null;
    }

    const isRewatch = input.isRewatch ?? before.watched;

    let entry: DiaryEntry;
    if (existing) {
      const [updated] = await tx
        .update(diaryEntries)
        .set({
          watchedDate: input.watchedDate,
          rating: input.rating,
          liked: input.liked,
          reviewText: input.reviewText,
          containsSpoilers: input.containsSpoilers,
          visibility: input.visibility,
          updatedAt: new Date(),
          deletedAt: null,
        })
        .where(eq(diaryEntries.id, existing.id))
        .returning();
      entry = updated;
    } else {
      const [created] = await tx
        .insert(diaryEntries)
        .values({
          userId: input.userId,
          movieId: input.movieId,
          watchedDate: input.watchedDate,
          rating: input.rating,
          liked: input.liked,
          reviewText: input.reviewText,
          containsSpoilers: input.containsSpoilers,
          visibility: input.visibility,
          isRewatch,
          source: input.source ?? 'manual',
          screeningId: input.screeningId ?? null,
          importBatchId: input.importBatchId ?? null,
          externalKey: input.externalKey ?? null,
        })
        .returning();
      entry = created;

      await bumpMovieCounter(tx, input.movieId, 'logCount', 1);
      await tx
        .update(userMovieState)
        .set({ logCount: sql`${userMovieState.logCount} + 1` })
        .where(eq(userMovieState.id, before.id));
    }

    await syncEntryTags(tx, input.userId, entry.id, input.tags);

    // A viewing always implies watched, and clears the watchlist.
    const removedFromWatchlist = before.inWatchlist;
    await updateFilmState(
      input.userId,
      input.movieId,
      {
        watched: true,
        rating: input.rating ?? undefined,
        liked: input.liked,
        inWatchlist: false,
      },
      { tx, emitActivity: false },
    );

    // Keep "last watched" honest even when back-dating an older viewing.
    await tx
      .update(userMovieState)
      .set({
        lastWatchedDate: sql`greatest(coalesce(${userMovieState.lastWatchedDate}, '1000-01-01'::date), ${input.watchedDate}::date)`,
      })
      .where(eq(userMovieState.id, before.id));

    if (input.visibility !== 'private' && input.source !== 'import') {
      await tx.insert(activityEvents).values({
        actorId: input.userId,
        type: input.reviewText ? 'review_created' : 'film_logged',
        movieId: input.movieId,
        diaryEntryId: entry.id,
        visibility: input.visibility,
        metadata: { rating: input.rating, liked: input.liked, isRewatch },
      });
    }

    return { entry, removedFromWatchlist, isFirstLog, isFirstRating, created: !existing };
  });
}

async function userHasAnyLog(tx: DbOrTx, userId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, userId))
    .limit(1);
  return rows.length > 0;
}

async function userHasAnyRating(tx: DbOrTx, userId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: userMovieState.id })
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), sql`${userMovieState.rating} is not null`))
    .limit(1);
  return rows.length > 0;
}

async function syncEntryTags(
  tx: DbOrTx,
  userId: string,
  entryId: string,
  names: string[],
): Promise<void> {
  const cleaned = Array.from(
    new Map(
      names
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && name.length <= 40)
        .slice(0, 12)
        .map((name) => [slugify(name), name]),
    ).entries(),
  );

  await tx.delete(diaryEntryTags).where(eq(diaryEntryTags.diaryEntryId, entryId));
  if (!cleaned.length) return;

  const rows = await tx
    .insert(tagsTable)
    .values(cleaned.map(([slug, name]) => ({ userId, slug, name })))
    .onConflictDoUpdate({
      target: [tagsTable.userId, tagsTable.slug],
      set: { name: sql`excluded.name` },
    })
    .returning();

  await tx
    .insert(diaryEntryTags)
    .values(rows.map((tag) => ({ diaryEntryId: entryId, tagId: tag.id })))
    .onConflictDoNothing();
}

export async function updateDiaryEntry(
  userId: string,
  entryId: string,
  patch: {
    watchedDate?: string;
    rating?: number | null;
    liked?: boolean;
    reviewText?: string | null;
    containsSpoilers?: boolean;
    visibility?: 'public' | 'followers' | 'private';
    tags?: string[];
  },
): Promise<DiaryEntry> {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, entryId)).limit(1);
    if (!entry || entry.deletedAt) throw new NotFoundError('That entry no longer exists.');
    if (entry.userId !== userId) throw new PermissionError('That is not your diary entry.');

    const [updated] = await tx
      .update(diaryEntries)
      .set({
        watchedDate: patch.watchedDate ?? entry.watchedDate,
        rating: patch.rating === undefined ? entry.rating : patch.rating,
        liked: patch.liked ?? entry.liked,
        reviewText: patch.reviewText === undefined ? entry.reviewText : patch.reviewText,
        containsSpoilers: patch.containsSpoilers ?? entry.containsSpoilers,
        visibility: patch.visibility ?? entry.visibility,
        updatedAt: new Date(),
      })
      .where(eq(diaryEntries.id, entryId))
      .returning();

    if (patch.tags) await syncEntryTags(tx, userId, entryId, patch.tags);

    // Editing the most recent viewing also updates the user's current opinion.
    const [latest] = await tx
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.movieId, entry.movieId), sql`${diaryEntries.deletedAt} is null`))
      .orderBy(desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt))
      .limit(1);

    if (latest?.id === entryId && patch.rating !== undefined) {
      await updateFilmState(userId, entry.movieId, { rating: patch.rating }, { tx, emitActivity: false });
    }

    return updated;
  });
}

export async function deleteDiaryEntry(userId: string, entryId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [entry] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, entryId)).limit(1);
    if (!entry || entry.deletedAt) throw new NotFoundError('That entry no longer exists.');
    if (entry.userId !== userId) throw new PermissionError('That is not your diary entry.');

    await tx.update(diaryEntries).set({ deletedAt: new Date() }).where(eq(diaryEntries.id, entryId));
    await tx.delete(activityEvents).where(eq(activityEvents.diaryEntryId, entryId));
    await bumpMovieCounter(tx, entry.movieId, 'logCount', -1);

    const [state] = await tx
      .select()
      .from(userMovieState)
      .where(and(eq(userMovieState.userId, userId), eq(userMovieState.movieId, entry.movieId)))
      .limit(1);
    if (state) {
      await tx
        .update(userMovieState)
        .set({ logCount: sql`greatest(${userMovieState.logCount} - 1, 0)` })
        .where(eq(userMovieState.id, state.id));
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getEntryTags(entryIds: string[]): Promise<Map<string, string[]>> {
  if (!entryIds.length) return new Map();
  const rows = await db
    .select({ entryId: diaryEntryTags.diaryEntryId, name: tagsTable.name })
    .from(diaryEntryTags)
    .innerJoin(tagsTable, eq(tagsTable.id, diaryEntryTags.tagId))
    .where(inArray(diaryEntryTags.diaryEntryId, entryIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.entryId) ?? [];
    list.push(row.name);
    map.set(row.entryId, list);
  }
  return map;
}

export async function getFilmStatesFor(
  userId: string,
  movieIds: string[],
): Promise<Map<string, UserMovieState>> {
  if (!movieIds.length) return new Map();
  const rows = await db
    .select()
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), inArray(userMovieState.movieId, movieIds)));
  return new Map(rows.map((r) => [r.movieId, r]));
}
