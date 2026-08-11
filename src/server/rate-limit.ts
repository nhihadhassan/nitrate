import 'server-only';

import { sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { RateLimitError } from '@/server/errors';

type Bucket = { limit: number; windowSeconds: number };

/**
 * Named buckets keep limits in one place and make it obvious when a new action
 * has been added without one.
 */
export const LIMITS = {
  signup: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 15 * 60 },
  log_film: { limit: 120, windowSeconds: 60 * 60 },
  review: { limit: 60, windowSeconds: 60 * 60 },
  comment: { limit: 60, windowSeconds: 60 * 60 },
  follow: { limit: 100, windowSeconds: 60 * 60 },
  report: { limit: 20, windowSeconds: 24 * 60 * 60 },
  club_create: { limit: 10, windowSeconds: 24 * 60 * 60 },
  club_post: { limit: 120, windowSeconds: 60 * 60 },
  invite: { limit: 50, windowSeconds: 24 * 60 * 60 },
  import: { limit: 5, windowSeconds: 60 * 60 },
  upload: { limit: 30, windowSeconds: 60 * 60 },
  search: { limit: 300, windowSeconds: 60 * 60 },
} satisfies Record<string, Bucket>;

export type LimitName = keyof typeof LIMITS;

/**
 * Fixed-window counter kept in Postgres. A single upsert does the whole job,
 * which matters because serverless instances share no memory.
 */
export async function consumeRateLimit(name: LimitName, subject: string): Promise<void> {
  const bucket = LIMITS[name];
  const windowMs = bucket.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = `${name}:${subject}:${windowStart.getTime()}`;

  const rows = await db.execute<{ count: number }>(sql`
    insert into nitrate.rate_limits (key, window_start, count)
    values (${key}, ${windowStart}, 1)
    on conflict (key) do update set count = nitrate.rate_limits.count + 1
    returning count
  `);

  const count = Number(rows[0]?.count ?? 1);
  if (count > bucket.limit) {
    throw new RateLimitError();
  }
}

/** Best-effort cleanup of counters older than a day. */
export async function pruneRateLimits(): Promise<void> {
  await db.execute(sql`delete from nitrate.rate_limits where window_start < now() - interval '1 day'`);
}
