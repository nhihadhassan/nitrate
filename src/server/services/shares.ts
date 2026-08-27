import 'server-only';

import { and, desc, eq, isNull, or } from 'drizzle-orm';

import { createPublicShareToken, hashPublicShareToken } from '@/lib/share-token';
import type { ShareSnapshot } from '@/lib/stats';
import { db } from '@/server/db';
import { blocks, clubs, shareSnapshots, users } from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { getMembership } from '@/server/services/clubs';
import { getClubYearbook, getPersonalRecap, getTasteComparison } from '@/server/services/stats';

function publicPoster<T extends { movieId: string; slug: string }>(film: T): T {
  return { ...film, movieId: film.slug };
}

function sanitizeRecap(recap: Awaited<ReturnType<typeof getPersonalRecap>>) {
  return {
    ...recap,
    owner: { ...recap.owner, id: recap.owner.username },
    openingFilm: recap.openingFilm ? publicPoster(recap.openingFilm) : null,
    highestRated: recap.highestRated.map(publicPoster),
    collage: recap.collage.map(publicPoster),
    stats: {
      ...recap.stats,
      latestViewings: recap.stats.latestViewings.map(publicPoster),
      opinionOutliers: recap.stats.opinionOutliers.map(publicPoster),
    },
  };
}

function sanitizeComparison(comparison: Awaited<ReturnType<typeof getTasteComparison>>) {
  return {
    ...comparison,
    left: { ...comparison.left, id: comparison.left.username },
    right: { ...comparison.right, id: comparison.right.username },
    sharedFavourites: comparison.sharedFavourites.map(publicPoster),
    agreements: comparison.agreements.map(publicPoster),
    disagreements: comparison.disagreements.map(publicPoster),
    recommendationsForLeft: comparison.recommendationsForLeft.map(publicPoster),
    recommendationsForRight: comparison.recommendationsForRight.map(publicPoster),
  };
}

async function profilesArePublicAndUnblocked(leftId: string, rightId: string): Promise<boolean> {
  const [profiles, blocked] = await Promise.all([
    db
      .select({ id: users.id, visibility: users.profileVisibility })
      .from(users)
      .where(and(or(eq(users.id, leftId), eq(users.id, rightId)), isNull(users.deletedAt), isNull(users.suspendedAt))),
    db
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, leftId), eq(blocks.blockedId, rightId)),
          and(eq(blocks.blockerId, rightId), eq(blocks.blockedId, leftId)),
        ),
      )
      .limit(1),
  ]);
  return profiles.length === 2 && profiles.every((profile) => profile.visibility === 'public') && blocked.length === 0;
}

export async function createPersonalRecapShare(ownerUserId: string, year: number) {
  const recap = sanitizeRecap(await getPersonalRecap(ownerUserId, year));
  const snapshot: ShareSnapshot = {
    version: 1,
    kind: 'personal_recap',
    createdAt: new Date().toISOString(),
    payload: recap,
  };
  return insertSnapshot({
    ownerUserId,
    kind: snapshot.kind,
    payload: snapshot,
    sourceUserId: ownerUserId,
    sourceYear: year,
  });
}

export async function createClubYearbookShare(ownerUserId: string, clubId: string, year: number | null) {
  const [club, membership] = await Promise.all([
    db.select().from(clubs).where(and(eq(clubs.id, clubId), isNull(clubs.deletedAt))).limit(1),
    getMembership(clubId, ownerUserId),
  ]);
  if (!club[0] || club[0].visibility !== 'public') {
    throw new ValidationError('Only a public club can have a public Yearbook link.');
  }
  if (!membership || membership.status !== 'active' || membership.role === 'member') {
    throw new PermissionError('A club admin must create the public Yearbook link.');
  }
  const yearbook = await getClubYearbook(clubId, year, ownerUserId);
  // Public Yearbooks never serialize blind group scores. The live page may show
  // them to an eligible rater, but a bearer link has no such entitlement.
  yearbook.screenings = yearbook.screenings.map((screening) => ({ ...screening, groupRating: null }));
  yearbook.ratingsWithheld = club[0].blindRatingsEnabled;
  yearbook.club.id = yearbook.club.slug;
  yearbook.screenings = yearbook.screenings.map((screening, index) => ({
    ...publicPoster(screening),
    screeningId: `${screening.slug}-${index + 1}`,
  }));
  yearbook.collage = yearbook.collage.map(publicPoster);
  const snapshot: ShareSnapshot = {
    version: 1,
    kind: 'club_yearbook',
    createdAt: new Date().toISOString(),
    payload: yearbook,
  };
  return insertSnapshot({
    ownerUserId,
    kind: snapshot.kind,
    payload: snapshot,
    sourceClubId: clubId,
    sourceYear: year,
  });
}

export async function createTasteComparisonShare(ownerUserId: string, otherUserId: string) {
  if (!(await profilesArePublicAndUnblocked(ownerUserId, otherUserId))) {
    throw new ValidationError('Both profiles must be public and unblocked to share this comparison.');
  }
  const comparison = sanitizeComparison(await getTasteComparison(ownerUserId, otherUserId));
  const snapshot: ShareSnapshot = {
    version: 1,
    kind: 'taste_comparison',
    createdAt: new Date().toISOString(),
    payload: comparison,
  };
  return insertSnapshot({
    ownerUserId,
    kind: snapshot.kind,
    payload: snapshot,
    sourceUserId: ownerUserId,
    comparedUserId: otherUserId,
  });
}

async function insertSnapshot(input: {
  ownerUserId: string;
  kind: 'personal_recap' | 'club_yearbook' | 'taste_comparison';
  payload: ShareSnapshot;
  sourceUserId?: string;
  comparedUserId?: string;
  sourceClubId?: string;
  sourceYear?: number | null;
}) {
  const token = createPublicShareToken();
  const tokenHash = hashPublicShareToken(token);
  const [row] = await db
    .insert(shareSnapshots)
    .values({
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      schemaVersion: 1,
      tokenHash,
      payload: input.payload as unknown as Record<string, unknown>,
      sourceUserId: input.sourceUserId,
      comparedUserId: input.comparedUserId,
      sourceClubId: input.sourceClubId,
      sourceYear: input.sourceYear,
    })
    .returning({ id: shareSnapshots.id });
  return { id: row.id, token };
}

export async function getPublicShareSnapshot(token: string): Promise<ShareSnapshot> {
  let tokenHash: Buffer;
  try {
    tokenHash = hashPublicShareToken(token);
  } catch {
    throw new NotFoundError('That shared story is unavailable.');
  }
  const [row] = await db
    .select()
    .from(shareSnapshots)
    .where(and(eq(shareSnapshots.tokenHash, tokenHash), isNull(shareSnapshots.revokedAt)))
    .limit(1);
  if (!row) throw new NotFoundError('That shared story is unavailable.');

  const payload = row.payload as { version?: unknown; kind?: unknown };
  if (row.schemaVersion !== 1 || payload.version !== 1 || payload.kind !== row.kind) {
    throw new NotFoundError('That shared story uses an unsupported format.');
  }

  let valid = true;
  if (row.kind === 'club_yearbook') {
    const [club] = row.sourceClubId
      ? await db.select({ visibility: clubs.visibility, deletedAt: clubs.deletedAt }).from(clubs).where(eq(clubs.id, row.sourceClubId)).limit(1)
      : [];
    valid = Boolean(club && club.visibility === 'public' && !club.deletedAt);
  } else if (row.kind === 'taste_comparison') {
    valid = Boolean(
      row.sourceUserId &&
        row.comparedUserId &&
        (await profilesArePublicAndUnblocked(row.sourceUserId, row.comparedUserId)),
    );
  } else if (row.sourceUserId) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, row.sourceUserId), isNull(users.deletedAt), isNull(users.suspendedAt)))
      .limit(1);
    valid = Boolean(owner);
  }

  if (!valid) {
    await db.update(shareSnapshots).set({ revokedAt: new Date() }).where(eq(shareSnapshots.id, row.id));
    throw new NotFoundError('That shared story is unavailable.');
  }
  await db.update(shareSnapshots).set({ lastAccessedAt: new Date() }).where(eq(shareSnapshots.id, row.id));
  return row.payload as unknown as ShareSnapshot;
}

export async function revokeShareSnapshot(id: string, ownerUserId: string): Promise<void> {
  const [revoked] = await db
    .update(shareSnapshots)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareSnapshots.id, id), eq(shareSnapshots.ownerUserId, ownerUserId), isNull(shareSnapshots.revokedAt)))
    .returning({ id: shareSnapshots.id });
  if (!revoked) throw new NotFoundError('That share link is already unavailable.');
}

export async function listShareSnapshots(ownerUserId: string) {
  return db
    .select({
      id: shareSnapshots.id,
      kind: shareSnapshots.kind,
      year: shareSnapshots.sourceYear,
      createdAt: shareSnapshots.createdAt,
      lastAccessedAt: shareSnapshots.lastAccessedAt,
    })
    .from(shareSnapshots)
    .where(and(eq(shareSnapshots.ownerUserId, ownerUserId), isNull(shareSnapshots.revokedAt)))
    .orderBy(desc(shareSnapshots.createdAt));
}
