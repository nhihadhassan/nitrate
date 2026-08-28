import 'server-only';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

import { db } from '@/server/db';
import { users } from '@/server/db/schema';

/** Used when nothing else is known — never presented as a guess about the user. */
const DEFAULT_REGION = 'US';

/**
 * The region that decides which streaming providers show up.
 *
 * Preference order: the user's own choice (persisted, always overridable in
 * Settings) → Vercel's edge-resolved country header (coarse, IP-based, no
 * client geolocation) → a plain default. Never presented as "we know where you
 * are" — Settings always shows the honest source and lets it be changed.
 */
export async function resolveWatchRegion(userWatchRegion: string | null | undefined): Promise<string> {
  if (userWatchRegion) return userWatchRegion.toUpperCase();

  try {
    const country = (await headers()).get('x-vercel-ip-country');
    if (country && /^[A-Z]{2}$/i.test(country)) return country.toUpperCase();
  } catch {
    // Outside a request context (e.g. a background job) — fall through.
  }

  return DEFAULT_REGION;
}

/** Persists a resolved region the first time, so it stays stable across requests. */
export async function ensureWatchRegionPersisted(userId: string, currentRegion: string | null): Promise<string> {
  if (currentRegion) return currentRegion.toUpperCase();
  const resolved = await resolveWatchRegion(null);
  await db.update(users).set({ watchRegion: resolved }).where(eq(users.id, userId));
  return resolved;
}
