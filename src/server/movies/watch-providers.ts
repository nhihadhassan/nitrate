import 'server-only';

import { eq, inArray } from 'drizzle-orm';

import { db } from '@/server/db';
import { providerCache } from '@/server/db/schema';

import { withProvider } from './provider';
import type { WatchAvailability } from './provider/types';

/**
 * Streaming availability, cache-first through the `provider_cache` table.
 *
 * Availability is the most volatile data TMDB serves, and it is only ever
 * asked for a bounded set of candidates (Tonight's shortlist, a film page, a
 * club shortlist) — never as a filter over the whole catalogue. A cache miss
 * that comes back degraded (TMDB down) is never persisted, so an outage never
 * calcifies into permanently stale "unavailable" data.
 */
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const REGIONS_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const REGIONS_KEY = 'tmdb:watch-regions';

function availabilityKey(providerId: string, region: string): string {
  return `tmdb:watch:${providerId}:${region.toUpperCase()}`;
}

// `payload` is `jsonb not null` — a plain JS `null` (a legitimate cached
// answer: "no availability data here") binds as a raw SQL NULL, not a JSON
// `null`, and trips the column's not-null constraint. Wrapping every payload
// in `{ value }` keeps the column itself always non-null while still letting
// the cached *value* be null.
type CacheEnvelope<T> = { value: T };

function unwrap<T>(payload: unknown): T | undefined {
  if (!payload || typeof payload !== 'object' || !('value' in payload)) return undefined;
  return (payload as CacheEnvelope<T>).value;
}

async function readCache<T>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(providerCache).where(eq(providerCache.key, key)).limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) return undefined;
  return unwrap<T>(row.payload);
}

async function writeCache(key: string, payload: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const envelope: CacheEnvelope<unknown> = { value: payload };
  await db
    .insert(providerCache)
    .values({ key, payload: envelope, expiresAt })
    .onConflictDoUpdate({
      target: providerCache.key,
      set: { payload: envelope, expiresAt, createdAt: new Date() },
    });
}

async function readCacheRows(keys: string[]): Promise<Map<string, { payload: unknown; expiresAt: Date }>> {
  if (!keys.length) return new Map();
  const rows = await db.select().from(providerCache).where(inArray(providerCache.key, keys));
  return new Map(rows.map((row) => [row.key, row]));
}

/**
 * One film, one region. Reads the cache first; on a miss, asks the provider
 * and — only when the answer is a genuine one, not a degraded fallback —
 * writes it back. `degraded` tells the caller whether this reflects a real
 * outage right now (worth a quiet banner) versus a plain "nothing here".
 */
export async function getWatchAvailability(
  providerId: string,
  region: string,
): Promise<{ data: WatchAvailability | null; degraded: boolean }> {
  const key = availabilityKey(providerId, region);
  const cached = await readCache<WatchAvailability | null>(key);
  if (cached !== undefined) return { data: cached, degraded: false };

  const { data, degraded } = await withProvider((p) => p.watchProviders(providerId, region));
  if (!degraded) await writeCache(key, data, CACHE_TTL_MS);
  return { data, degraded };
}

/**
 * The bounded batch used by Tonight and club shortlists: serves everything
 * already cached immediately, and fetches at most `limit` misses with modest
 * concurrency. Callers must tolerate a missing entry — it means "not resolved
 * yet", never "confirmed unavailable".
 */
export async function getAvailabilityForMovies(
  candidates: { id: string; providerId: string }[],
  region: string,
  { limit = 24, concurrency = 4 }: { limit?: number; concurrency?: number } = {},
): Promise<Map<string, WatchAvailability | null>> {
  const result = new Map<string, WatchAvailability | null>();
  if (!candidates.length) return result;

  const keyed = candidates.map((movie) => ({ movie, key: availabilityKey(movie.providerId, region) }));
  const cachedRows = await readCacheRows(keyed.map((k) => k.key));
  const now = Date.now();

  const misses: typeof candidates = [];
  for (const { movie, key } of keyed) {
    const row = cachedRows.get(key);
    const cached = row && row.expiresAt.getTime() > now ? unwrap<WatchAvailability | null>(row.payload) : undefined;
    if (cached !== undefined) {
      result.set(movie.id, cached);
    } else {
      misses.push(movie);
    }
  }

  const toFetch = misses.slice(0, limit);
  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (movie) => {
        const { data } = await getWatchAvailability(movie.providerId, region);
        result.set(movie.id, data);
      }),
    );
  }

  return result;
}

/** Region picker list, cached for a month — this barely ever changes. */
export async function getWatchRegions(): Promise<{ code: string; name: string }[]> {
  const cached = await readCache<{ code: string; name: string }[]>(REGIONS_KEY);
  if (cached !== undefined) return cached;

  const { data, degraded } = await withProvider((p) => p.watchRegions());
  if (!degraded && data.length) await writeCache(REGIONS_KEY, data, REGIONS_TTL_MS);
  return data;
}
