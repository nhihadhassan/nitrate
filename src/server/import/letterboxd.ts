import 'server-only';

import { createHash } from 'node:crypto';

import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import {
  importBatches,
  importRows,
  movies,
  type ImportBatch,
  type ImportRow,
} from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { ensureMovieByProviderId } from '@/server/movies/catalog';
import { withProvider } from '@/server/movies/provider';
import { logFilm, updateFilmState } from '@/server/services/films';
import { addListItem, createList } from '@/server/services/lists';

import { pick, toTable } from './csv';

export type ParsedFile = { name: string; text: string };

type StagedRow = {
  kind: ImportRow['kind'];
  rawTitle: string;
  rawYear: number | null;
  rawUri: string | null;
  payload: Record<string, unknown>;
  dedupeKey: string;
};

/** Letterboxd stores ratings as 0.5–5.0; we store 1–10 half-stars. */
function parseRating(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.min(10, Math.round(parsed * 2)));
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function keyFor(parts: (string | number | null)[]): string {
  return createHash('sha1').update(parts.map((p) => p ?? '').join('|')).digest('hex').slice(0, 24);
}

/**
 * Turns a Letterboxd export into staged rows.
 *
 * Filenames are the reliable signal for what each CSV contains; we fall back to
 * inspecting headers so a renamed file still works.
 */
export function stageFiles(files: ParsedFile[]): StagedRow[] {
  const staged: StagedRow[] = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const table = toTable(file.text);
    if (!table.rows.length) continue;

    const headers = table.headers.map((h) => h.toLowerCase());
    const isDiary = name.includes('diary') || headers.includes('watched date');
    const isReviews = name.includes('review') || headers.includes('review');
    const isWatchlist = name.includes('watchlist');
    const isRatings = name.includes('ratings') || (headers.includes('rating') && !isDiary);
    const isList = name.includes('list') && !isWatchlist;

    for (const row of table.rows) {
      const title = pick(row, 'Name', 'Title', 'Film');
      if (!title) continue;
      const yearRaw = pick(row, 'Year');
      const year = yearRaw ? Number(yearRaw) : null;
      const uri = pick(row, 'Letterboxd URI', 'URI', 'Uri');

      const base = {
        rawTitle: title,
        rawYear: Number.isFinite(year) ? year : null,
        rawUri: uri,
      };

      if (isWatchlist) {
        staged.push({
          ...base,
          kind: 'watchlist',
          payload: {},
          dedupeKey: keyFor(['watchlist', title, base.rawYear]),
        });
        continue;
      }

      if (isList) {
        staged.push({
          ...base,
          kind: 'list_item',
          payload: {
            listName: file.name.replace(/\.csv$/i, ''),
            position: Number(pick(row, 'Position') ?? 0) || null,
            note: pick(row, 'Notes', 'Description'),
          },
          dedupeKey: keyFor(['list', file.name, title, base.rawYear]),
        });
        continue;
      }

      const watchedDate = parseDate(pick(row, 'Watched Date', 'Date'));
      const rating = parseRating(pick(row, 'Rating'));
      const review = pick(row, 'Review');
      const tags = (pick(row, 'Tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const rewatch = (pick(row, 'Rewatch') ?? '').toLowerCase() === 'yes';
      const liked = (pick(row, 'Liked') ?? '').toLowerCase() === 'yes';
      const containsSpoilers = (pick(row, 'Contains Spoilers') ?? '').toLowerCase() === 'yes';

      if ((isDiary || isReviews) && watchedDate) {
        staged.push({
          ...base,
          kind: review ? 'review' : 'diary',
          payload: { watchedDate, rating, review, tags, rewatch, liked, containsSpoilers },
          // Same film + same date is the same viewing, however many files it is in.
          dedupeKey: keyFor(['diary', title, base.rawYear, watchedDate]),
        });
        continue;
      }

      staged.push({
        ...base,
        kind: isRatings || rating !== null ? 'rating' : 'watched',
        payload: { rating, liked },
        dedupeKey: keyFor(['watched', title, base.rawYear]),
      });
    }
  }

  // Collapse duplicates across files (diary and reviews overlap heavily).
  const seen = new Map<string, StagedRow>();
  for (const row of staged) {
    const existing = seen.get(row.dedupeKey);
    if (!existing) {
      seen.set(row.dedupeKey, row);
      continue;
    }
    // Prefer the richer record when the same viewing appears twice.
    if (row.kind === 'review' && existing.kind !== 'review') seen.set(row.dedupeKey, row);
  }
  return Array.from(seen.values());
}

export async function createImportBatch(
  userId: string,
  files: ParsedFile[],
): Promise<{ batch: ImportBatch; staged: number }> {
  const staged = stageFiles(files);
  if (!staged.length) {
    throw new ValidationError(
      'We could not find any films in those files. Export your data from Letterboxd and upload the CSVs.',
    );
  }
  if (staged.length > 10_000) {
    throw new ValidationError('That export is unusually large. Split it and try again.');
  }

  const [batch] = await db
    .insert(importBatches)
    .values({
      userId,
      fileNames: files.map((f) => f.name),
      status: 'matching',
      totals: { staged: staged.length },
    })
    .returning();

  await db
    .insert(importRows)
    .values(
      staged.map((row) => ({
        batchId: batch.id,
        kind: row.kind,
        rawTitle: row.rawTitle,
        rawYear: row.rawYear,
        rawUri: row.rawUri,
        payload: row.payload,
        dedupeKey: row.dedupeKey,
      })),
    )
    .onConflictDoNothing();

  return { batch, staged: staged.length };
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type PendingRow = { id: string; rawTitle: string; rawYear: number | null };

/**
 * Matches one staged row to a canonical film.
 *
 * Exact title+year is treated as confident; a title-only match, or a match with
 * a nearby year, is flagged ambiguous for the user to resolve. Nothing is ever
 * silently dropped — unmatched rows stay in the batch with candidates attached.
 */
async function matchRow(row: PendingRow): Promise<void> {
  try {
    const query = row.rawTitle;
    const { data } = await withProvider((provider) => provider.searchMovies(query, 1));
    const results = data.results.slice(0, 6);

    const target = normalise(row.rawTitle);
    const exact = results.filter((r) => normalise(r.title) === target);
    const withYear = row.rawYear ? exact.filter((r) => r.year === row.rawYear) : [];
    const nearYear = row.rawYear
      ? exact.filter((r) => r.year !== null && Math.abs(r.year - row.rawYear!) <= 1)
      : [];

    const candidates = results.map((r) => ({
      providerId: r.providerId,
      title: r.title,
      year: r.year,
      posterPath: r.posterPath,
    }));

    if (withYear.length === 1) {
      await resolveRow(row.id, withYear[0].providerId, 'matched', 1, candidates);
    } else if (!row.rawYear && exact.length === 1) {
      await resolveRow(row.id, exact[0].providerId, 'matched', 0.85, candidates);
    } else if (withYear.length > 1 || nearYear.length >= 1 || exact.length > 1) {
      const best = (withYear[0] ?? nearYear[0] ?? exact[0])!;
      await resolveRow(row.id, best.providerId, 'ambiguous', 0.6, candidates);
    } else if (results.length) {
      await resolveRow(row.id, results[0].providerId, 'ambiguous', 0.4, candidates);
    } else {
      await db
        .update(importRows)
        .set({ matchStatus: 'unmatched', candidates: [] })
        .where(eq(importRows.id, row.id));
    }
  } catch (error) {
    await db
      .update(importRows)
      .set({
        matchStatus: 'unmatched',
        error: error instanceof Error ? error.message.slice(0, 200) : 'Match failed',
      })
      .where(eq(importRows.id, row.id));
  }
}

/**
 * A slice is deliberately small and runs a handful of rows at a time.
 *
 * Each row costs a provider round trip, so a large sequential slice can outlive
 * a serverless invocation — and a slice that dies takes its whole request with
 * it. Small slices also mean the progress bar actually moves. Concurrency is
 * kept low to stay well inside TMDB's rate limit.
 */
const SLICE_CONCURRENCY = 8;

export async function matchBatch(batchId: string, limit = 24): Promise<{ remaining: number }> {
  const pending = await db
    .select({ id: importRows.id, rawTitle: importRows.rawTitle, rawYear: importRows.rawYear })
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.matchStatus, 'pending')))
    .limit(limit);

  const queue = [...pending];
  await Promise.all(
    Array.from({ length: Math.min(SLICE_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const row = queue.shift();
        if (!row) return;
        await matchRow(row);
      }
    }),
  );

  const [{ value: remaining }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.matchStatus, 'pending')));

  if (remaining === 0) {
    await db
      .update(importBatches)
      .set({ status: 'preview', updatedAt: new Date() })
      .where(eq(importBatches.id, batchId));
  }

  return { remaining };
}

async function resolveRow(
  rowId: string,
  providerId: string,
  status: 'matched' | 'ambiguous',
  confidence: number,
  candidates: unknown[],
): Promise<void> {
  // The film is persisted now so the preview can show real posters.
  const movie = await ensureMovieByProviderId(providerId).catch(() => null);
  await db
    .update(importRows)
    .set({
      matchedMovieId: movie?.id ?? null,
      matchStatus: movie ? status : 'unmatched',
      matchConfidence: confidence,
      candidates,
    })
    .where(eq(importRows.id, rowId));
}

export async function setRowMatch(
  userId: string,
  rowId: string,
  providerId: string | null,
): Promise<void> {
  const [row] = await db
    .select({ row: importRows, batch: importBatches })
    .from(importRows)
    .innerJoin(importBatches, eq(importBatches.id, importRows.batchId))
    .where(eq(importRows.id, rowId))
    .limit(1);
  if (!row) throw new NotFoundError('That row no longer exists.');
  if (row.batch.userId !== userId) throw new PermissionError('That is not your import.');

  if (!providerId) {
    await db
      .update(importRows)
      .set({ matchStatus: 'skipped', matchedMovieId: null })
      .where(eq(importRows.id, rowId));
    return;
  }

  const movie = await ensureMovieByProviderId(providerId);
  await db
    .update(importRows)
    .set({ matchedMovieId: movie.id, matchStatus: 'matched', matchConfidence: 1 })
    .where(eq(importRows.id, rowId));
}

export type ImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  watchlist: number;
  diary: number;
  lists: number;
};

/** A slice reports enough for the client to keep going and show progress. */
export type ImportProgress = { remaining: number; done: boolean; summary: ImportSummary };

/**
 * Applies part of a matched batch, and finishes the batch off once the last row
 * lands.
 *
 * Sliced for the same reason matching is: applying ~300 rows in one request took
 * longer than a serverless invocation is allowed to live, and Vercel killed it
 * with a 504 mid-import. Idempotency meant pressing the button again resumed
 * correctly — every diary entry carries a deterministic `externalKey` and every
 * row is marked `imported` as it lands — but relying on the user to retry a
 * silent failure is not a design.
 *
 * Running totals live on the batch row rather than in memory, so they survive
 * across slices.
 */
export async function runImport(
  userId: string,
  batchId: string,
  limit = 60,
): Promise<ImportProgress> {
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
  if (!batch) throw new NotFoundError('That import no longer exists.');
  if (batch.userId !== userId) throw new PermissionError('That is not your import.');

  await db
    .update(importBatches)
    .set({ status: 'importing', updatedAt: new Date() })
    .where(eq(importBatches.id, batchId));

  // List items are held back for the final step: a list has to be created once,
  // with all of its films, and that cannot be spread across slices.
  const rows = await db
    .select()
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        inArray(importRows.matchStatus, ['matched', 'ambiguous']),
        sql`${importRows.kind} <> 'list_item'`,
      ),
    )
    .limit(limit);

  const summary: ImportSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
    watchlist: 0,
    diary: 0,
    lists: 0,
  };

  for (const row of rows) {
    if (!row.matchedMovieId) {
      summary.skipped += 1;
      // Must leave the 'matched'/'ambiguous' set, or it would be handed back on
      // every slice and the loop would never finish.
      await db
        .update(importRows)
        .set({ matchStatus: 'skipped' })
        .where(eq(importRows.id, row.id));
      continue;
    }

    try {
      const payload = row.payload as {
        watchedDate?: string;
        rating?: number | null;
        review?: string | null;
        tags?: string[];
        rewatch?: boolean;
        liked?: boolean;
        containsSpoilers?: boolean;
        listName?: string;
        position?: number | null;
        note?: string | null;
      };

      switch (row.kind) {
        case 'watchlist':
          await updateFilmState(
            userId,
            row.matchedMovieId,
            { inWatchlist: true },
            { emitActivity: false },
          );
          summary.watchlist += 1;
          break;

        case 'watched':
        case 'rating':
          await updateFilmState(
            userId,
            row.matchedMovieId,
            {
              watched: true,
              rating: payload.rating ?? undefined,
              liked: payload.liked ?? undefined,
            },
            { emitActivity: false },
          );
          break;

        case 'diary':
        case 'review':
          if (payload.watchedDate) {
            await logFilm({
              userId,
              movieId: row.matchedMovieId,
              watchedDate: payload.watchedDate,
              rating: payload.rating ?? null,
              liked: payload.liked ?? false,
              reviewText: payload.review ?? null,
              containsSpoilers: payload.containsSpoilers ?? false,
              visibility: 'public',
              tags: payload.tags ?? [],
              isRewatch: payload.rewatch ?? false,
              source: 'import',
              importBatchId: batchId,
              externalKey: `letterboxd:${row.dedupeKey}`,
            });
            summary.diary += 1;
          }
          break;

        case 'list_item':
          // Excluded from this query; handled once, in the final step.
          break;
      }

      summary.imported += 1;
      await db
        .update(importRows)
        .set({ matchStatus: 'imported' })
        .where(eq(importRows.id, row.id));
    } catch (error) {
      summary.failed += 1;
      await db
        .update(importRows)
        .set({
          matchStatus: 'failed',
          error: error instanceof Error ? error.message.slice(0, 300) : 'Import failed',
        })
        .where(eq(importRows.id, row.id));
    }
  }

  // Fold this slice's counts into the running totals held on the batch.
  const previous = (batch.totals ?? {}) as Partial<ImportSummary>;
  const running: ImportSummary = {
    imported: (previous.imported ?? 0) + summary.imported,
    skipped: (previous.skipped ?? 0) + summary.skipped,
    failed: (previous.failed ?? 0) + summary.failed,
    watchlist: (previous.watchlist ?? 0) + summary.watchlist,
    diary: (previous.diary ?? 0) + summary.diary,
    lists: previous.lists ?? 0,
  };

  const [{ value: remaining }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        inArray(importRows.matchStatus, ['matched', 'ambiguous']),
        sql`${importRows.kind} <> 'list_item'`,
      ),
    );

  if (remaining > 0) {
    await db
      .update(importBatches)
      .set({ totals: running, updatedAt: new Date() })
      .where(eq(importBatches.id, batchId));
    return { remaining, done: false, summary: running };
  }

  // Last slice: build the lists, then close the batch out.
  const listRows = await db
    .select()
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        inArray(importRows.matchStatus, ['matched', 'ambiguous']),
        eq(importRows.kind, 'list_item'),
      ),
    );

  const listBuckets = new Map<string, { movieId: string; position: number | null; note: string | null }[]>();
  for (const row of listRows) {
    if (!row.matchedMovieId) continue;
    const payload = row.payload as { listName?: string; position?: number | null; note?: string | null };
    const listName = payload.listName ?? 'Imported list';
    const bucket = listBuckets.get(listName) ?? [];
    bucket.push({
      movieId: row.matchedMovieId,
      position: payload.position ?? null,
      note: payload.note ?? null,
    });
    listBuckets.set(listName, bucket);
  }

  for (const [listName, items] of listBuckets) {
    try {
      const ordered = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const list = await createList({
        userId,
        title: listName,
        description: 'Imported from Letterboxd.',
        visibility: 'private',
        isRanked: ordered.some((i) => i.position !== null),
        movieIds: [],
      });
      for (const item of ordered) {
        await addListItem(list.id, userId, item.movieId, item.note);
      }
      running.lists += 1;
      running.imported += ordered.length;
    } catch {
      running.failed += 1;
    }
  }

  if (listRows.length) {
    await db
      .update(importRows)
      .set({ matchStatus: 'imported' })
      .where(
        and(
          eq(importRows.batchId, batchId),
          inArray(importRows.matchStatus, ['matched', 'ambiguous']),
          eq(importRows.kind, 'list_item'),
        ),
      );
  }

  const [{ value: unresolved }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(importRows)
    .where(
      and(
        eq(importRows.batchId, batchId),
        inArray(importRows.matchStatus, ['unmatched', 'skipped', 'failed']),
      ),
    );

  await db
    .update(importBatches)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      totals: { ...running, unresolved },
    })
    .where(eq(importBatches.id, batchId));

  return { remaining: 0, done: true, summary: running };
}

export async function getBatch(userId: string, batchId: string) {
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
  if (!batch) throw new NotFoundError('That import no longer exists.');
  if (batch.userId !== userId) throw new PermissionError('That is not your import.');

  const rows = await db
    .select({ row: importRows, movie: movies })
    .from(importRows)
    .leftJoin(movies, eq(movies.id, importRows.matchedMovieId))
    .where(eq(importRows.batchId, batchId))
    .orderBy(importRows.matchStatus, importRows.rawTitle)
    .limit(2000);

  const counts = await db
    .select({ status: importRows.matchStatus, value: sql<number>`count(*)::int` })
    .from(importRows)
    .where(eq(importRows.batchId, batchId))
    .groupBy(importRows.matchStatus);

  return {
    batch,
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.value])) as Record<string, number>,
  };
}

export async function getLatestBatch(userId: string) {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.userId, userId))
    .orderBy(sql`${importBatches.createdAt} desc`)
    .limit(1);
  return batch ?? null;
}
