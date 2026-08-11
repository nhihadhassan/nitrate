import 'server-only';

import { randomBytes, randomInt } from 'node:crypto';

import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { formatRuntime, slugify } from '@/lib/utils';
import { db, type DbOrTx } from '@/server/db';
import {
  activityEvents,
  attendances,
  clubDiscussionPosts,
  clubInvites,
  clubMembers,
  clubQueueItems,
  clubRatings,
  clubs,
  diaryEntries,
  movies,
  nominations,
  screenings,
  selectionRounds,
  userMovieState,
  users,
  votes,
  type Club,
  type ClubMember,
  type Movie,
  type Screening,
  type SelectionRound,
} from '@/server/db/schema';
import { queueClubEmail } from '@/server/email/queue';
import {
  ConflictError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/server/errors';

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

export type RoundStatus = SelectionRound['status'];

/**
 * A selection round is a real state machine, not a bag of booleans. Every
 * transition in the product is checked against this table server-side, so an
 * out-of-order request (stale tab, replayed form, hand-rolled fetch) is rejected
 * rather than corrupting a round mid-vote.
 */
const ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  draft: ['nominations_open', 'cancelled'],
  // A wheel round jumps straight to a winner; only `spinWheel` may take that
  // edge, and it refuses unless the round's mode is 'wheel'.
  nominations_open: ['voting_open', 'winner_selected', 'cancelled'],
  voting_open: ['winner_selected', 'cancelled'],
  winner_selected: ['screening_scheduled', 'completed', 'cancelled'],
  screening_scheduled: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RoundStatus, to: RoundStatus): boolean {
  return ROUND_TRANSITIONS[from].includes(to);
}

function assertTransition(from: RoundStatus, to: RoundStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `A round that is "${from.replace(/_/g, ' ')}" cannot move to "${to.replace(/_/g, ' ')}".`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Membership & permissions                                                   */
/* -------------------------------------------------------------------------- */

export type Membership = Pick<ClubMember, 'role' | 'status' | 'userId' | 'clubId' | 'notificationsMuted'>;

export async function getMembership(
  clubId: string,
  userId: string | null,
  tx: DbOrTx = db,
): Promise<Membership | null> {
  if (!userId) return null;
  const [row] = await tx
    .select({
      role: clubMembers.role,
      status: clubMembers.status,
      userId: clubMembers.userId,
      clubId: clubMembers.clubId,
      notificationsMuted: clubMembers.notificationsMuted,
    })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function requireMembership(
  clubId: string,
  userId: string,
  minRole: 'member' | 'admin' | 'owner' = 'member',
  tx: DbOrTx = db,
): Promise<Membership> {
  const membership = await getMembership(clubId, userId, tx);
  if (!membership || membership.status !== 'active') {
    throw new PermissionError('You are not a member of this club.');
  }
  const rank = { member: 0, admin: 1, owner: 2 } as const;
  if (rank[membership.role] < rank[minRole]) {
    throw new PermissionError(
      minRole === 'owner' ? 'Only the club owner can do that.' : 'Only club admins can do that.',
    );
  }
  return membership;
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const [row] = await db
    .select()
    .from(clubs)
    .where(and(eq(clubs.slug, slug), isNull(clubs.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getClubById(id: string, tx: DbOrTx = db): Promise<Club> {
  const [row] = await tx.select().from(clubs).where(eq(clubs.id, id)).limit(1);
  if (!row || row.deletedAt) throw new NotFoundError('That club no longer exists.');
  return row;
}

/** Private clubs are invisible to non-members everywhere, including search. */
export async function assertCanViewClub(club: Club, userId: string | null): Promise<Membership | null> {
  const membership = await getMembership(club.id, userId);
  if (club.visibility === 'public') return membership;
  if (!membership || membership.status !== 'active') {
    throw new PermissionError('This club is private.');
  }
  return membership;
}

/* -------------------------------------------------------------------------- */
/* Club lifecycle                                                             */
/* -------------------------------------------------------------------------- */

function newCode(bytes = 6): string {
  return randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toLowerCase();
}

async function uniqueClubSlug(name: string, tx: DbOrTx): Promise<string> {
  const base = slugify(name, 40);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${newCode(3)}`;
    const [existing] = await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createClub(input: {
  ownerId: string;
  name: string;
  description: string | null;
  visibility: 'private' | 'public';
  timezone: string;
  interests: string[];
  imageAssetId: string | null;
}): Promise<Club> {
  return db.transaction(async (tx) => {
    const slug = await uniqueClubSlug(input.name, tx);
    const [club] = await tx
      .insert(clubs)
      .values({
        name: input.name,
        slug,
        description: input.description,
        visibility: input.visibility,
        timezone: input.timezone,
        interests: input.interests,
        imageAssetId: input.imageAssetId,
        ownerId: input.ownerId,
        inviteCode: newCode(),
        memberCount: 1,
      })
      .returning();

    await tx.insert(clubMembers).values({ clubId: club.id, userId: input.ownerId, role: 'owner' });
    await tx.insert(activityEvents).values({
      actorId: input.ownerId,
      type: 'club_created',
      clubId: club.id,
      visibility: input.visibility === 'public' ? 'public' : 'private',
      metadata: { clubName: club.name, clubSlug: club.slug },
    });

    return club;
  });
}

export async function updateClub(
  clubId: string,
  userId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    visibility: 'private' | 'public';
    timezone: string;
    interests: string[];
    imageAssetId: string | null;
  }>,
): Promise<Club> {
  await requireMembership(clubId, userId, 'admin');
  const [club] = await db
    .update(clubs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clubs.id, clubId))
    .returning();
  return club;
}

export async function transferOwnership(clubId: string, ownerId: string, toUserId: string): Promise<void> {
  await requireMembership(clubId, ownerId, 'owner');
  await db.transaction(async (tx) => {
    const target = await getMembership(clubId, toUserId, tx);
    if (!target || target.status !== 'active') {
      throw new ValidationError('That person is not an active member of this club.');
    }
    await tx
      .update(clubMembers)
      .set({ role: 'owner' })
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, toUserId)));
    await tx
      .update(clubMembers)
      .set({ role: 'admin' })
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, ownerId)));
    await tx.update(clubs).set({ ownerId: toUserId }).where(eq(clubs.id, clubId));
  });
}

export async function setMemberRole(
  clubId: string,
  actorId: string,
  targetUserId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await requireMembership(clubId, actorId, 'owner');
  if (actorId === targetUserId) throw new ValidationError('Transfer ownership instead.');
  await db
    .update(clubMembers)
    .set({ role })
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.userId, targetUserId),
        ne(clubMembers.role, 'owner'),
      ),
    );
}

export async function removeMember(
  clubId: string,
  actorId: string,
  targetUserId: string,
  mode: 'remove' | 'ban' | 'leave',
): Promise<void> {
  if (mode === 'leave') {
    const membership = await requireMembership(clubId, actorId);
    if (membership.role === 'owner') {
      throw new ValidationError('Transfer ownership before leaving your own club.');
    }
  } else {
    await requireMembership(clubId, actorId, 'admin');
    const target = await getMembership(clubId, targetUserId);
    if (target?.role === 'owner') throw new PermissionError('The owner cannot be removed.');
  }

  const userId = mode === 'leave' ? actorId : targetUserId;
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(clubMembers)
      .set({ status: mode === 'ban' ? 'banned' : 'left' })
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.userId, userId),
          eq(clubMembers.status, 'active'),
        ),
      )
      .returning();
    if (updated) {
      await tx
        .update(clubs)
        .set({ memberCount: sql`greatest(${clubs.memberCount} - 1, 0)` })
        .where(eq(clubs.id, clubId));
    }
  });
}

export async function deleteClub(clubId: string, userId: string): Promise<void> {
  await requireMembership(clubId, userId, 'owner');
  await db.update(clubs).set({ deletedAt: new Date() }).where(eq(clubs.id, clubId));
}

/* -------------------------------------------------------------------------- */
/* Invitations                                                                */
/* -------------------------------------------------------------------------- */

export async function getClubPreviewByInvite(
  code: string,
): Promise<{ id: string; name: string; slug: string; description: string | null; memberCount: number } | null> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  const [row] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      description: clubs.description,
      memberCount: clubs.memberCount,
    })
    .from(clubs)
    .leftJoin(clubInvites, eq(clubInvites.clubId, clubs.id))
    .where(
      and(
        isNull(clubs.deletedAt),
        or(
          eq(clubs.inviteCode, trimmed),
          and(
            eq(clubInvites.code, trimmed),
            isNull(clubInvites.revokedAt),
            or(isNull(clubInvites.expiresAt), gt(clubInvites.expiresAt, new Date())),
          ),
        ),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function createInvite(input: {
  clubId: string;
  createdByUserId: string;
  invitedUserId?: string | null;
  maxUses?: number | null;
  expiresInDays?: number | null;
}): Promise<{ code: string }> {
  await requireMembership(input.clubId, input.createdByUserId, 'member');
  const code = newCode(8);
  await db.insert(clubInvites).values({
    clubId: input.clubId,
    code,
    createdByUserId: input.createdByUserId,
    invitedUserId: input.invitedUserId ?? null,
    maxUses: input.maxUses ?? null,
    expiresAt: input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null,
  });
  return { code };
}

export type JoinResult = { club: Club; alreadyMember: boolean };

/**
 * Accepts either a personal invite code or the club's standing invite code.
 * Re-running it for an existing member is a no-op, so a shared link can be
 * clicked repeatedly without side effects.
 */
export async function joinClubByCode(code: string, userId: string): Promise<JoinResult> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new ValidationError('Enter an invite code.');

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(clubInvites)
      .where(eq(clubInvites.code, trimmed))
      .limit(1);

    let clubId: string;
    if (invite) {
      if (invite.revokedAt) throw new ValidationError('That invite has been revoked.');
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new ValidationError('That invite has expired.');
      }
      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
        throw new ValidationError('That invite has already been used.');
      }
      if (invite.invitedUserId && invite.invitedUserId !== userId) {
        throw new PermissionError('That invite was issued to someone else.');
      }
      clubId = invite.clubId;
    } else {
      const [club] = await tx
        .select({ id: clubs.id })
        .from(clubs)
        .where(and(eq(clubs.inviteCode, trimmed), isNull(clubs.deletedAt)))
        .limit(1);
      if (!club) throw new NotFoundError('We could not find a club for that code.');
      clubId = club.id;
    }

    const club = await getClubById(clubId, tx);
    const existing = await getMembership(clubId, userId, tx);
    if (existing?.status === 'banned') {
      throw new PermissionError('You cannot rejoin this club.');
    }
    if (existing?.status === 'active') {
      return { club, alreadyMember: true };
    }

    if (existing) {
      await tx
        .update(clubMembers)
        .set({ status: 'active', joinedAt: new Date() })
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    } else {
      await tx.insert(clubMembers).values({ clubId, userId, role: 'member' });
    }

    await tx
      .update(clubs)
      .set({ memberCount: sql`${clubs.memberCount} + 1` })
      .where(eq(clubs.id, clubId));

    if (invite) {
      await tx
        .update(clubInvites)
        .set({ useCount: sql`${clubInvites.useCount} + 1`, acceptedAt: new Date() })
        .where(eq(clubInvites.id, invite.id));
    }

    return { club, alreadyMember: false };
  });
}

/* -------------------------------------------------------------------------- */
/* Shared queue                                                               */
/* -------------------------------------------------------------------------- */

export async function addToQueue(
  clubId: string,
  userId: string,
  movieId: string,
  note: string | null,
): Promise<void> {
  await requireMembership(clubId, userId);
  await db
    .insert(clubQueueItems)
    .values({ clubId, movieId, addedByUserId: userId, note })
    .onConflictDoUpdate({
      target: [clubQueueItems.clubId, clubQueueItems.movieId],
      set: { removedAt: null, note },
    });
}

export async function removeFromQueue(clubId: string, userId: string, itemId: string): Promise<void> {
  const membership = await requireMembership(clubId, userId);
  const [item] = await db
    .select()
    .from(clubQueueItems)
    .where(and(eq(clubQueueItems.id, itemId), eq(clubQueueItems.clubId, clubId)))
    .limit(1);
  if (!item) throw new NotFoundError('That queue item is already gone.');
  if (item.addedByUserId !== userId && membership.role === 'member') {
    throw new PermissionError('Only the person who suggested it, or an admin, can remove it.');
  }
  await db.update(clubQueueItems).set({ removedAt: new Date() }).where(eq(clubQueueItems.id, itemId));
}

export type QueueEntry = {
  id: string;
  note: string | null;
  createdAt: Date;
  movie: Movie;
  addedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  onWatchlistCount: number;
  watchedByCount: number;
  alreadyScreened: boolean;
};

/**
 * The queue carries the group context that makes a suggestion decidable:
 * how many members already want it, how many have seen it, and whether the club
 * has already screened it. All of it resolves in three queries, not N.
 */
export async function getClubQueue(clubId: string, limit = 50): Promise<QueueEntry[]> {
  const rows = await db
    .select({
      item: clubQueueItems,
      movie: movies,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(clubQueueItems)
    .innerJoin(movies, eq(movies.id, clubQueueItems.movieId))
    .innerJoin(users, eq(users.id, clubQueueItems.addedByUserId))
    .where(and(eq(clubQueueItems.clubId, clubId), isNull(clubQueueItems.removedAt)))
    .orderBy(desc(clubQueueItems.createdAt))
    .limit(limit);

  if (!rows.length) return [];
  const movieIds = rows.map((r) => r.movie.id);

  const [stateRows, screenedRows] = await Promise.all([
    db
      .select({
        movieId: userMovieState.movieId,
        watchlist: sql<number>`count(*) filter (where ${userMovieState.inWatchlist})::int`,
        watched: sql<number>`count(*) filter (where ${userMovieState.watched})::int`,
      })
      .from(userMovieState)
      .innerJoin(
        clubMembers,
        and(eq(clubMembers.userId, userMovieState.userId), eq(clubMembers.clubId, clubId), eq(clubMembers.status, 'active')),
      )
      .where(inArray(userMovieState.movieId, movieIds))
      .groupBy(userMovieState.movieId),
    db
      .select({ movieId: screenings.movieId })
      .from(screenings)
      .where(
        and(
          eq(screenings.clubId, clubId),
          inArray(screenings.movieId, movieIds),
          ne(screenings.status, 'cancelled'),
        ),
      ),
  ]);

  const stateByMovie = new Map(stateRows.map((r) => [r.movieId, r]));
  const screened = new Set(screenedRows.map((r) => r.movieId));

  return rows.map((row) => ({
    id: row.item.id,
    note: row.item.note,
    createdAt: row.item.createdAt,
    movie: row.movie,
    addedBy: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
    onWatchlistCount: stateByMovie.get(row.movie.id)?.watchlist ?? 0,
    watchedByCount: stateByMovie.get(row.movie.id)?.watched ?? 0,
    alreadyScreened: screened.has(row.movie.id),
  }));
}

/* -------------------------------------------------------------------------- */
/* Selection rounds                                                           */
/* -------------------------------------------------------------------------- */

export async function getActiveRound(clubId: string): Promise<SelectionRound | null> {
  const [row] = await db
    .select()
    .from(selectionRounds)
    .where(
      and(
        eq(selectionRounds.clubId, clubId),
        inArray(selectionRounds.status, ['draft', 'nominations_open', 'voting_open', 'winner_selected']),
      ),
    )
    .orderBy(desc(selectionRounds.createdAt))
    .limit(1);
  return row ?? null;
}

export async function startRound(input: {
  clubId: string;
  userId: string;
  title: string | null;
  mode?: 'vote' | 'wheel';
  nominationLimitPerMember: number;
  nominationsCloseAt: Date | null;
  votingCloseAt: Date | null;
}): Promise<SelectionRound> {
  await requireMembership(input.clubId, input.userId, 'admin');

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: selectionRounds.id })
      .from(selectionRounds)
      .where(
        and(
          eq(selectionRounds.clubId, input.clubId),
          inArray(selectionRounds.status, ['draft', 'nominations_open', 'voting_open', 'winner_selected']),
        ),
      )
      .limit(1);
    if (existing.length) {
      throw new ConflictError('This club already has a round in progress.');
    }

    const [{ value: last } = { value: 0 }] = await tx
      .select({ value: sql<number>`coalesce(max(${selectionRounds.roundNumber}), 0)::int` })
      .from(selectionRounds)
      .where(eq(selectionRounds.clubId, input.clubId));

    const [round] = await tx
      .insert(selectionRounds)
      .values({
        clubId: input.clubId,
        roundNumber: last + 1,
        title: input.title,
        status: 'nominations_open',
        mode: input.mode ?? 'vote',
        nominationLimitPerMember: input.nominationLimitPerMember,
        nominationsCloseAt: input.nominationsCloseAt,
        votingCloseAt: input.votingCloseAt,
        createdByUserId: input.userId,
      })
      .returning();

    return round;
  });
}

export async function nominate(input: {
  roundId: string;
  userId: string;
  movieId: string;
  pitch: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const round = await loadRound(input.roundId, tx);
    await requireMembership(round.clubId, input.userId, 'member', tx);
    if (round.status !== 'nominations_open') {
      throw new ConflictError('Nominations are not open for this round.');
    }
    if (round.nominationsCloseAt && round.nominationsCloseAt < new Date()) {
      throw new ConflictError('The nomination window has closed.');
    }

    const [{ value: mine }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(nominations)
      .where(
        and(
          eq(nominations.roundId, input.roundId),
          eq(nominations.nominatedByUserId, input.userId),
          isNull(nominations.withdrawnAt),
        ),
      );
    if (mine >= round.nominationLimitPerMember) {
      throw new ValidationError(
        `You have used all ${round.nominationLimitPerMember} of your nominations for this round.`,
      );
    }

    // Duplicate titles are a dead end, so say who got there first.
    const [duplicate] = await tx
      .select({ id: nominations.id, by: users.displayName })
      .from(nominations)
      .innerJoin(users, eq(users.id, nominations.nominatedByUserId))
      .where(
        and(
          eq(nominations.roundId, input.roundId),
          eq(nominations.movieId, input.movieId),
          isNull(nominations.withdrawnAt),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new ConflictError(`${duplicate.by} already nominated that film for this round.`);
    }

    const alreadyScreened = await tx
      .select({ id: screenings.id })
      .from(screenings)
      .where(
        and(
          eq(screenings.clubId, round.clubId),
          eq(screenings.movieId, input.movieId),
          eq(screenings.status, 'completed'),
        ),
      )
      .limit(1);
    if (alreadyScreened.length) {
      throw new ConflictError('The club has already watched that film together.');
    }

    await tx.insert(nominations).values({
      roundId: input.roundId,
      movieId: input.movieId,
      nominatedByUserId: input.userId,
      pitch: input.pitch,
    });
  });
}

export async function withdrawNomination(nominationId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [nomination] = await tx
      .select()
      .from(nominations)
      .where(eq(nominations.id, nominationId))
      .limit(1);
    if (!nomination) throw new NotFoundError('That nomination is already gone.');
    const round = await loadRound(nomination.roundId, tx);
    const membership = await requireMembership(round.clubId, userId, 'member', tx);
    if (nomination.nominatedByUserId !== userId && membership.role === 'member') {
      throw new PermissionError('Only the nominator or an admin can withdraw this.');
    }
    if (round.status !== 'nominations_open') {
      throw new ConflictError('Nominations can only be withdrawn while the window is open.');
    }
    await tx.update(nominations).set({ withdrawnAt: new Date() }).where(eq(nominations.id, nominationId));
  });
}

async function loadRound(roundId: string, tx: DbOrTx = db): Promise<SelectionRound> {
  const [round] = await tx.select().from(selectionRounds).where(eq(selectionRounds.id, roundId)).limit(1);
  if (!round) throw new NotFoundError('That round no longer exists.');
  return round;
}

export async function openVoting(roundId: string, userId: string): Promise<SelectionRound> {
  return db.transaction(async (tx) => {
    const round = await loadRound(roundId, tx);
    await requireMembership(round.clubId, userId, 'admin', tx);
    assertTransition(round.status, 'voting_open');

    const [{ value: total }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(nominations)
      .where(and(eq(nominations.roundId, roundId), isNull(nominations.withdrawnAt)));
    if (total < 2) {
      throw new ValidationError('You need at least two nominations before voting can open.');
    }

    const [updated] = await tx
      .update(selectionRounds)
      .set({ status: 'voting_open', updatedAt: new Date() })
      .where(eq(selectionRounds.id, roundId))
      .returning();
    return updated;
  });
}

export async function castVote(roundId: string, userId: string, nominationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const round = await loadRound(roundId, tx);
    await requireMembership(round.clubId, userId, 'member', tx);
    if (round.status !== 'voting_open') throw new ConflictError('Voting is not open for this round.');
    if (round.votingCloseAt && round.votingCloseAt < new Date()) {
      throw new ConflictError('Voting has closed for this round.');
    }

    const [nomination] = await tx
      .select()
      .from(nominations)
      .where(
        and(
          eq(nominations.id, nominationId),
          eq(nominations.roundId, roundId),
          isNull(nominations.withdrawnAt),
        ),
      )
      .limit(1);
    if (!nomination) throw new NotFoundError('That nomination is not part of this round.');

    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.roundId, roundId), eq(votes.userId, userId)))
      .limit(1);

    if (existing) {
      if (existing.nominationId === nominationId) return;
      await tx
        .update(nominations)
        .set({ voteCount: sql`greatest(${nominations.voteCount} - 1, 0)` })
        .where(eq(nominations.id, existing.nominationId));
      await tx.update(votes).set({ nominationId }).where(eq(votes.id, existing.id));
    } else {
      await tx.insert(votes).values({ roundId, userId, nominationId });
    }

    await tx
      .update(nominations)
      .set({ voteCount: sql`${nominations.voteCount} + 1` })
      .where(eq(nominations.id, nominationId));
  });
}

export type RoundResult = {
  round: SelectionRound;
  winner: { nominationId: string; movie: Movie; voteCount: number; nominatedBy: string } | null;
  tied: boolean;
};

/**
 * Closes voting and picks the winner. Ties break on earliest nomination by
 * default, which is deterministic and explainable — the alternative (random)
 * makes people feel cheated.
 */
export async function closeVoting(roundId: string, userId: string): Promise<RoundResult> {
  return db.transaction(async (tx) => {
    const round = await loadRound(roundId, tx);
    await requireMembership(round.clubId, userId, 'admin', tx);
    assertTransition(round.status, 'winner_selected');

    const ranked = await tx
      .select({ nomination: nominations, movie: movies, by: users.displayName })
      .from(nominations)
      .innerJoin(movies, eq(movies.id, nominations.movieId))
      .innerJoin(users, eq(users.id, nominations.nominatedByUserId))
      .where(and(eq(nominations.roundId, roundId), isNull(nominations.withdrawnAt)))
      .orderBy(desc(nominations.voteCount), asc(nominations.createdAt));

    const top = ranked[0];
    if (!top) throw new ValidationError('This round has no nominations to choose from.');

    const tied = ranked.length > 1 && ranked[1].nomination.voteCount === top.nomination.voteCount;

    const [updated] = await tx
      .update(selectionRounds)
      .set({
        status: 'winner_selected',
        winnerNominationId: top.nomination.id,
        updatedAt: new Date(),
      })
      .where(eq(selectionRounds.id, roundId))
      .returning();

    await tx.insert(activityEvents).values({
      actorId: userId,
      type: 'club_movie_selected',
      clubId: round.clubId,
      movieId: top.movie.id,
      visibility: 'private',
      metadata: { roundId, voteCount: top.nomination.voteCount },
    });

    return {
      round: updated,
      winner: {
        nominationId: top.nomination.id,
        movie: top.movie,
        voteCount: top.nomination.voteCount,
        nominatedBy: top.by,
      },
      tied,
    };
  });
}

export type SpinResult = RoundResult & {
  /** Index of the winner in the wheel's segment order, so the client can animate to it. */
  winnerIndex: number;
  seed: string;
  alreadySpun: boolean;
  order: { nominationId: string; movieTitle: string }[];
};

/**
 * Spins the wheel.
 *
 * The randomness is server-side and the outcome is committed before the client
 * ever animates, so a spin cannot be re-rolled by refreshing, racing two tabs,
 * or calling the action twice — the second call returns the first result.
 * Any active member may spin; it is a group ritual, not an admin chore.
 */
export async function spinWheel(roundId: string, userId: string): Promise<SpinResult> {
  return db.transaction(async (tx) => {
    // Lock the round row so two concurrent spins serialise instead of racing.
    const [locked] = await tx
      .select()
      .from(selectionRounds)
      .where(eq(selectionRounds.id, roundId))
      .for('update')
      .limit(1);
    if (!locked) throw new NotFoundError('That round no longer exists.');

    await requireMembership(locked.clubId, userId, 'member', tx);
    if (locked.mode !== 'wheel') {
      throw new ConflictError('This round is decided by voting, not the wheel.');
    }

    // Segment order is stable (nomination order) so the reveal matches the wheel.
    const contenders = await tx
      .select({ nomination: nominations, movie: movies, by: users.displayName })
      .from(nominations)
      .innerJoin(movies, eq(movies.id, nominations.movieId))
      .innerJoin(users, eq(users.id, nominations.nominatedByUserId))
      .where(and(eq(nominations.roundId, roundId), isNull(nominations.withdrawnAt)))
      .orderBy(asc(nominations.createdAt));

    const order = contenders.map((c) => ({
      nominationId: c.nomination.id,
      movieTitle: c.movie.title,
    }));

    // Already spun: replay the stored outcome rather than picking again.
    if (locked.winnerNominationId && locked.spinSeed) {
      const index = order.findIndex((o) => o.nominationId === locked.winnerNominationId);
      const winner = contenders[index] ?? contenders[0];
      return {
        round: locked,
        winner: winner
          ? {
              nominationId: winner.nomination.id,
              movie: winner.movie,
              voteCount: 0,
              nominatedBy: winner.by,
            }
          : null,
        tied: false,
        winnerIndex: Math.max(index, 0),
        seed: locked.spinSeed,
        alreadySpun: true,
        order,
      };
    }

    if (contenders.length < 2) {
      throw new ValidationError('You need at least two submissions before spinning.');
    }
    assertTransition(locked.status, 'winner_selected');

    const winnerIndex = randomInt(0, contenders.length);
    const chosen = contenders[winnerIndex];
    const seed = randomBytes(8).toString('hex');

    const [updated] = await tx
      .update(selectionRounds)
      .set({
        status: 'winner_selected',
        winnerNominationId: chosen.nomination.id,
        spunAt: new Date(),
        spinSeed: seed,
        updatedAt: new Date(),
      })
      // Guard against a concurrent spin that beat us to the commit.
      .where(and(eq(selectionRounds.id, roundId), isNull(selectionRounds.winnerNominationId)))
      .returning();

    if (!updated) {
      throw new ConflictError('Someone just spun the wheel. Refresh to see the result.');
    }

    await tx.insert(activityEvents).values({
      actorId: userId,
      type: 'club_movie_selected',
      clubId: locked.clubId,
      movieId: chosen.movie.id,
      visibility: 'private',
      metadata: { roundId, mode: 'wheel', contenders: contenders.length },
    });

    const club = await getClubById(locked.clubId, tx);
    await queueClubEmail(
      locked.clubId,
      'wheel_winner',
      `🎬 ${club.name} is watching ${chosen.movie.title}`,
      (member) => ({
        clubName: club.name,
        clubSlug: club.slug,
        movieTitle: chosen.movie.title,
        movieYear: chosen.movie.year,
        movieSlug: chosen.movie.slug,
        runtime: chosen.movie.runtime ? formatRuntime(chosen.movie.runtime) : null,
        nominatedBy: chosen.by,
        contenderCount: contenders.length,
        recipientName: member.displayName,
      }),
      // One winner email per member per round, however many times this is called.
      { dedupePrefix: `wheel:${roundId}` },
      tx,
    );

    return {
      round: updated,
      winner: {
        nominationId: chosen.nomination.id,
        movie: chosen.movie,
        voteCount: 0,
        nominatedBy: chosen.by,
      },
      tied: false,
      winnerIndex,
      seed,
      alreadySpun: false,
      order,
    };
  });
}

export async function cancelRound(roundId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const round = await loadRound(roundId, tx);
    await requireMembership(round.clubId, userId, 'admin', tx);
    assertTransition(round.status, 'cancelled');
    await tx
      .update(selectionRounds)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(selectionRounds.id, roundId));
  });
}

export type NominationView = {
  id: string;
  movie: Movie;
  pitch: string | null;
  voteCount: number;
  nominatedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  votedByViewer: boolean;
};

/**
 * Vote totals stay hidden until the round closes — or until the viewer has voted
 * and the round is over. Hiding is done here, not in the component, so the
 * numbers never reach the client early.
 */
export async function getRoundNominations(
  roundId: string,
  viewerId: string | null,
): Promise<{ nominations: NominationView[]; totalsVisible: boolean; viewerVoted: boolean }> {
  const round = await loadRound(roundId);
  const totalsVisible =
    round.status === 'winner_selected' ||
    round.status === 'screening_scheduled' ||
    round.status === 'completed';

  const rows = await db
    .select({
      nomination: nominations,
      movie: movies,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(nominations)
    .innerJoin(movies, eq(movies.id, nominations.movieId))
    .innerJoin(users, eq(users.id, nominations.nominatedByUserId))
    .where(and(eq(nominations.roundId, roundId), isNull(nominations.withdrawnAt)))
    .orderBy(totalsVisible ? desc(nominations.voteCount) : asc(nominations.createdAt));

  const viewerVote = viewerId
    ? await db
        .select({ nominationId: votes.nominationId })
        .from(votes)
        .where(and(eq(votes.roundId, roundId), eq(votes.userId, viewerId)))
        .limit(1)
    : [];

  return {
    totalsVisible,
    viewerVoted: viewerVote.length > 0,
    nominations: rows.map((row) => ({
      id: row.nomination.id,
      movie: row.movie,
      pitch: row.nomination.pitch,
      voteCount: totalsVisible ? row.nomination.voteCount : 0,
      nominatedBy: {
        id: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarAssetId: row.avatarAssetId,
      },
      votedByViewer: viewerVote[0]?.nominationId === row.nomination.id,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Screenings                                                                 */
/* -------------------------------------------------------------------------- */

export async function scheduleScreening(input: {
  clubId: string;
  userId: string;
  movieId: string;
  roundId: string | null;
  scheduledAt: Date;
  timezone: string;
  location: string | null;
  watchLink: string | null;
  notes: string | null;
}): Promise<Screening> {
  await requireMembership(input.clubId, input.userId, 'admin');

  return db.transaction(async (tx) => {
    if (input.roundId) {
      const round = await loadRound(input.roundId, tx);
      assertTransition(round.status, 'screening_scheduled');
      await tx
        .update(selectionRounds)
        .set({ status: 'screening_scheduled', updatedAt: new Date() })
        .where(eq(selectionRounds.id, input.roundId));
    }

    const [screening] = await tx
      .insert(screenings)
      .values({
        clubId: input.clubId,
        roundId: input.roundId,
        movieId: input.movieId,
        scheduledAt: input.scheduledAt,
        timezone: input.timezone,
        location: input.location,
        watchLink: input.watchLink,
        notes: input.notes,
        createdByUserId: input.userId,
      })
      .returning();

    // A scheduled film leaves the queue; it is no longer a suggestion.
    await tx
      .update(clubQueueItems)
      .set({ removedAt: new Date() })
      .where(and(eq(clubQueueItems.clubId, input.clubId), eq(clubQueueItems.movieId, input.movieId)));

    await tx.insert(activityEvents).values({
      actorId: input.userId,
      type: 'club_screening_scheduled',
      clubId: input.clubId,
      movieId: input.movieId,
      screeningId: screening.id,
      visibility: 'private',
    });

    return screening;
  });
}

export async function updateScreening(
  screeningId: string,
  userId: string,
  patch: Partial<{
    scheduledAt: Date;
    location: string | null;
    watchLink: string | null;
    notes: string | null;
  }>,
): Promise<Screening> {
  const screening = await getScreeningById(screeningId);
  await requireMembership(screening.clubId, userId, 'admin');
  const [updated] = await db
    .update(screenings)
    .set(patch)
    .where(eq(screenings.id, screeningId))
    .returning();
  return updated;
}

export async function cancelScreening(screeningId: string, userId: string): Promise<void> {
  const screening = await getScreeningById(screeningId);
  await requireMembership(screening.clubId, userId, 'admin');
  await db.transaction(async (tx) => {
    await tx
      .update(screenings)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(screenings.id, screeningId));
    if (screening.roundId) {
      await tx
        .update(selectionRounds)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(selectionRounds.id, screening.roundId));
    }
  });
}

export async function getScreeningById(id: string, tx: DbOrTx = db): Promise<Screening> {
  const [row] = await tx.select().from(screenings).where(eq(screenings.id, id)).limit(1);
  if (!row) throw new NotFoundError('That screening no longer exists.');
  return row;
}

export async function setRsvp(
  screeningId: string,
  userId: string,
  rsvp: 'going' | 'maybe' | 'cant',
): Promise<void> {
  const screening = await getScreeningById(screeningId);
  await requireMembership(screening.clubId, userId);
  await db
    .insert(attendances)
    .values({ screeningId, userId, rsvp, respondedAt: new Date() })
    .onConflictDoUpdate({
      target: [attendances.screeningId, attendances.userId],
      set: { rsvp, respondedAt: new Date() },
    });
}

export async function confirmAttendance(
  screeningId: string,
  userId: string,
  attended: boolean,
): Promise<void> {
  const screening = await getScreeningById(screeningId);
  await requireMembership(screening.clubId, userId);

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(attendances)
      .where(and(eq(attendances.screeningId, screeningId), eq(attendances.userId, userId)))
      .limit(1);

    await tx
      .insert(attendances)
      .values({ screeningId, userId, attended, confirmedAt: new Date() })
      .onConflictDoUpdate({
        target: [attendances.screeningId, attendances.userId],
        set: { attended, confirmedAt: new Date() },
      });

    const delta = (attended ? 1 : 0) - (before?.attended ? 1 : 0);
    if (delta !== 0) {
      await tx
        .update(screenings)
        .set({ attendeeCount: sql`greatest(${screenings.attendeeCount} + ${delta}, 0)` })
        .where(eq(screenings.id, screeningId));
    }
  });
}

/**
 * Marks a screening done. Completing it is what turns a plan into a permanent
 * record: it closes the round, bumps club history, and opens the blind-rating
 * and discussion phase.
 */
export async function completeScreening(screeningId: string, userId: string): Promise<Screening> {
  return db.transaction(async (tx) => {
    const screening = await getScreeningById(screeningId, tx);
    await requireMembership(screening.clubId, userId, 'admin', tx);
    if (screening.status === 'completed') return screening;
    if (screening.status === 'cancelled') {
      throw new ConflictError('That screening was cancelled.');
    }

    const [updated] = await tx
      .update(screenings)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(screenings.id, screeningId))
      .returning();

    if (screening.roundId) {
      const round = await loadRound(screening.roundId, tx);
      if (canTransition(round.status, 'completed')) {
        await tx
          .update(selectionRounds)
          .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
          .where(eq(selectionRounds.id, screening.roundId));
      }
    }

    await tx
      .update(clubs)
      .set({ screeningCount: sql`${clubs.screeningCount} + 1` })
      .where(eq(clubs.id, screening.clubId));

    await tx.insert(activityEvents).values({
      actorId: userId,
      type: 'club_screening_completed',
      clubId: screening.clubId,
      movieId: screening.movieId,
      screeningId: screening.id,
      visibility: 'private',
    });

    return updated;
  });
}

/* -------------------------------------------------------------------------- */
/* Blind club ratings                                                         */
/* -------------------------------------------------------------------------- */

export async function submitClubRating(
  screeningId: string,
  userId: string,
  rating: number,
): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new ValidationError('Pick a rating between half a star and five.');
  }
  await db.transaction(async (tx) => {
    const screening = await getScreeningById(screeningId, tx);
    await requireMembership(screening.clubId, userId, 'member', tx);

    const [existing] = await tx
      .select()
      .from(clubRatings)
      .where(and(eq(clubRatings.screeningId, screeningId), eq(clubRatings.userId, userId)))
      .limit(1);

    if (existing) {
      await tx
        .update(clubRatings)
        .set({ rating, updatedAt: new Date() })
        .where(eq(clubRatings.id, existing.id));
      await tx
        .update(screenings)
        .set({ groupRatingSum: sql`${screenings.groupRatingSum} + ${rating - existing.rating}` })
        .where(eq(screenings.id, screeningId));
    } else {
      await tx.insert(clubRatings).values({ screeningId, userId, rating });
      await tx
        .update(screenings)
        .set({
          groupRatingSum: sql`${screenings.groupRatingSum} + ${rating}`,
          groupRatingCount: sql`${screenings.groupRatingCount} + 1`,
        })
        .where(eq(screenings.id, screeningId));
    }
  });
}

export type ClubRatingsView = {
  revealed: boolean;
  viewerRating: number | null;
  average: number | null;
  count: number;
  spread: { user: { username: string; displayName: string; avatarAssetId: string | null }; rating: number }[];
  pendingMembers: number;
};

/**
 * Blind by default. Until you have submitted a score you get the count of
 * ratings in and nothing else — no average to anchor on, no individual scores.
 */
export async function getClubRatings(
  screeningId: string,
  viewerId: string | null,
): Promise<ClubRatingsView> {
  const screening = await getScreeningById(screeningId);
  const rows = await db
    .select({
      rating: clubRatings.rating,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      userId: users.id,
    })
    .from(clubRatings)
    .innerJoin(users, eq(users.id, clubRatings.userId))
    .where(eq(clubRatings.screeningId, screeningId))
    .orderBy(desc(clubRatings.rating));

  const viewerRating = rows.find((r) => r.userId === viewerId)?.rating ?? null;
  const revealed = viewerRating !== null;

  const [{ value: memberCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, screening.clubId), eq(clubMembers.status, 'active')));

  return {
    revealed,
    viewerRating,
    count: rows.length,
    average: revealed && rows.length ? screening.groupRatingSum / screening.groupRatingCount : null,
    spread: revealed
      ? rows.map((r) => ({
          user: { username: r.username, displayName: r.displayName, avatarAssetId: r.avatarAssetId },
          rating: r.rating,
        }))
      : [],
    pendingMembers: Math.max(memberCount - rows.length, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Discussions                                                                */
/* -------------------------------------------------------------------------- */

export async function postDiscussion(input: {
  clubId: string;
  screeningId: string | null;
  parentId: string | null;
  userId: string;
  body: string;
  containsSpoilers: boolean;
}): Promise<{ id: string }> {
  const body = input.body.trim();
  if (!body) throw new ValidationError('Write something first.');
  if (body.length > 5000) throw new ValidationError('That message is too long.');

  return db.transaction(async (tx) => {
    await requireMembership(input.clubId, input.userId, 'member', tx);

    if (input.parentId) {
      const [parent] = await tx
        .select({ clubId: clubDiscussionPosts.clubId })
        .from(clubDiscussionPosts)
        .where(eq(clubDiscussionPosts.id, input.parentId))
        .limit(1);
      if (!parent || parent.clubId !== input.clubId) {
        throw new NotFoundError('That message no longer exists.');
      }
      await tx
        .update(clubDiscussionPosts)
        .set({ replyCount: sql`${clubDiscussionPosts.replyCount} + 1` })
        .where(eq(clubDiscussionPosts.id, input.parentId));
    }

    const [post] = await tx
      .insert(clubDiscussionPosts)
      .values({
        clubId: input.clubId,
        screeningId: input.screeningId,
        parentId: input.parentId,
        userId: input.userId,
        body,
        containsSpoilers: input.containsSpoilers,
      })
      .returning({ id: clubDiscussionPosts.id });

    if (input.screeningId) {
      await tx
        .update(screenings)
        .set({ postCount: sql`${screenings.postCount} + 1` })
        .where(eq(screenings.id, input.screeningId));
    }

    return post;
  });
}

export async function deleteDiscussionPost(postId: string, userId: string): Promise<void> {
  const [post] = await db
    .select()
    .from(clubDiscussionPosts)
    .where(eq(clubDiscussionPosts.id, postId))
    .limit(1);
  if (!post || post.deletedAt) throw new NotFoundError('That message is already gone.');

  const membership = await requireMembership(post.clubId, userId, 'member');
  if (post.userId !== userId && membership.role === 'member') {
    throw new PermissionError('Only the author or a club admin can remove this.');
  }

  await db
    .update(clubDiscussionPosts)
    .set({ deletedAt: new Date(), deletedByUserId: userId })
    .where(eq(clubDiscussionPosts.id, postId));
}

export type DiscussionPost = {
  id: string;
  body: string;
  containsSpoilers: boolean;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  parentId: string | null;
  replyCount: number;
  author: { id: string; username: string; displayName: string; avatarAssetId: string | null };
};

export async function getDiscussion(screeningId: string, limit = 100): Promise<DiscussionPost[]> {
  const rows = await db
    .select({
      post: clubDiscussionPosts,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(clubDiscussionPosts)
    .innerJoin(users, eq(users.id, clubDiscussionPosts.userId))
    .where(eq(clubDiscussionPosts.screeningId, screeningId))
    .orderBy(asc(clubDiscussionPosts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.post.id,
    body: row.post.body,
    containsSpoilers: row.post.containsSpoilers,
    createdAt: row.post.createdAt,
    editedAt: row.post.editedAt,
    deletedAt: row.post.deletedAt,
    parentId: row.post.parentId,
    replyCount: row.post.replyCount,
    author: {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
  }));
}

/**
 * Whether the viewer should walk into the discussion or hit a spoiler wall.
 * Attending or logging the film counts as "you have seen it".
 */
export async function viewerHasSeenScreeningFilm(
  screening: Screening,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const [state] = await db
    .select({ watched: userMovieState.watched })
    .from(userMovieState)
    .where(and(eq(userMovieState.userId, userId), eq(userMovieState.movieId, screening.movieId)))
    .limit(1);
  if (state?.watched) return true;

  const [attendance] = await db
    .select({ attended: attendances.attended })
    .from(attendances)
    .where(and(eq(attendances.screeningId, screening.id), eq(attendances.userId, userId)))
    .limit(1);
  return Boolean(attendance?.attended);
}

/* -------------------------------------------------------------------------- */
/* Dashboard reads                                                            */
/* -------------------------------------------------------------------------- */

export async function getClubMembers(clubId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      role: clubMembers.role,
      joinedAt: clubMembers.joinedAt,
      filmCount: users.filmCount,
    })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, 'active')))
    .orderBy(asc(clubMembers.joinedAt));
}

export async function getUpcomingScreening(clubId: string) {
  const [row] = await db
    .select({ screening: screenings, movie: movies })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(and(eq(screenings.clubId, clubId), eq(screenings.status, 'scheduled')))
    .orderBy(asc(screenings.scheduledAt))
    .limit(1);
  return row ?? null;
}

/** Finished but still awaiting ratings/discussion — the club's "do this next". */
export async function getRecentlyCompleted(clubId: string, limit = 6) {
  return db
    .select({ screening: screenings, movie: movies })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(and(eq(screenings.clubId, clubId), eq(screenings.status, 'completed')))
    .orderBy(desc(screenings.completedAt))
    .limit(limit);
}

export async function getScreeningAttendance(screeningId: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      rsvp: attendances.rsvp,
      attended: attendances.attended,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(eq(attendances.screeningId, screeningId));
}

export async function getUserClubs(userId: string) {
  return db
    .select({
      club: clubs,
      role: clubMembers.role,
      nextScreeningAt: sql<Date | null>`(
        select min(s.scheduled_at) from nitrate.screenings s
        where s.club_id = ${clubs.id} and s.status = 'scheduled'
      )`,
      activeRoundStatus: sql<string | null>`(
        select r.status from nitrate.selection_rounds r
        where r.club_id = ${clubs.id}
          and r.status in ('nominations_open','voting_open','winner_selected')
        order by r.created_at desc limit 1
      )`,
    })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(
      and(eq(clubMembers.userId, userId), eq(clubMembers.status, 'active'), isNull(clubs.deletedAt)),
    )
    .orderBy(desc(clubs.updatedAt));
}

export async function getClubHistory(clubId: string, limit = 50) {
  return db
    .select({
      screening: screenings,
      movie: movies,
      round: selectionRounds,
    })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .leftJoin(selectionRounds, eq(selectionRounds.id, screenings.roundId))
    .where(and(eq(screenings.clubId, clubId), eq(screenings.status, 'completed')))
    .orderBy(desc(screenings.completedAt))
    .limit(limit);
}

export type ClubStats = {
  screeningCount: number;
  memberCount: number;
  averageRating: number | null;
  totalRuntimeMinutes: number;
  topRated: { title: string; slug: string; rating: number } | null;
};

export async function getClubStats(clubId: string): Promise<ClubStats> {
  const [row] = await db
    .select({
      screeningCount: sql<number>`count(*)::int`,
      ratingSum: sql<number>`coalesce(sum(${screenings.groupRatingSum}), 0)::int`,
      ratingCount: sql<number>`coalesce(sum(${screenings.groupRatingCount}), 0)::int`,
      runtime: sql<number>`coalesce(sum(${movies.runtime}), 0)::int`,
    })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(and(eq(screenings.clubId, clubId), eq(screenings.status, 'completed')));

  const [top] = await db
    .select({
      title: movies.title,
      slug: movies.slug,
      rating: sql<number>`(${screenings.groupRatingSum}::float / nullif(${screenings.groupRatingCount}, 0))`,
    })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(
      and(
        eq(screenings.clubId, clubId),
        eq(screenings.status, 'completed'),
        gt(screenings.groupRatingCount, 0),
      ),
    )
    .orderBy(desc(sql`(${screenings.groupRatingSum}::float / nullif(${screenings.groupRatingCount}, 0))`))
    .limit(1);

  const [{ value: memberCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, 'active')));

  return {
    screeningCount: row?.screeningCount ?? 0,
    memberCount,
    averageRating: row?.ratingCount ? row.ratingSum / row.ratingCount : null,
    totalRuntimeMinutes: row?.runtime ?? 0,
    topRated: top?.rating ? { title: top.title, slug: top.slug, rating: top.rating } : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Club intelligence (heuristics, not ML)                                     */
/* -------------------------------------------------------------------------- */

export type ClubSuggestion = {
  movie: Movie;
  reason: string;
  metric: number;
};

/**
 * Deliberately simple, explainable group signals. Each one answers a question a
 * human would ask out loud in the group chat, and each is a single indexed
 * query. The shapes here are what a real recommender would later replace.
 */
export async function getClubIntelligence(clubId: string): Promise<{
  onEveryonesRadar: ClubSuggestion[];
  nobodyHasSeen: ClubSuggestion[];
  fromTheQueue: ClubSuggestion[];
}> {
  const [{ value: memberCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, 'active')));

  if (memberCount === 0) {
    return { onEveryonesRadar: [], nobodyHasSeen: [], fromTheQueue: [] };
  }

  const screened = db
    .select({ movieId: screenings.movieId })
    .from(screenings)
    .where(and(eq(screenings.clubId, clubId), ne(screenings.status, 'cancelled')));

  const [radar, unseen, queue] = await Promise.all([
    // On multiple members' watchlists.
    db
      .select({ movie: movies, metric: sql<number>`count(*)::int` })
      .from(userMovieState)
      .innerJoin(movies, eq(movies.id, userMovieState.movieId))
      .innerJoin(
        clubMembers,
        and(
          eq(clubMembers.userId, userMovieState.userId),
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.status, 'active'),
        ),
      )
      .where(and(eq(userMovieState.inWatchlist, true), sql`${movies.id} not in ${screened}`))
      .groupBy(movies.id)
      .having(sql`count(*) >= 2`)
      .orderBy(desc(sql`count(*)`), desc(movies.providerPopularity))
      .limit(8),

    // In the shared queue and unwatched by every member.
    db
      .select({ movie: movies })
      .from(clubQueueItems)
      .innerJoin(movies, eq(movies.id, clubQueueItems.movieId))
      .where(
        and(
          eq(clubQueueItems.clubId, clubId),
          isNull(clubQueueItems.removedAt),
          sql`not exists (
            select 1 from nitrate.user_movie_state ums
            join nitrate.club_members cm on cm.user_id = ums.user_id
              and cm.club_id = ${clubId} and cm.status = 'active'
            where ums.movie_id = ${movies.id} and ums.watched
          )`,
        ),
      )
      .limit(8),

    // Anything else waiting in the queue.
    db
      .select({
        movie: movies,
        metric: sql<number>`(
          select count(*) from nitrate.user_movie_state ums
          join nitrate.club_members cm on cm.user_id = ums.user_id
            and cm.club_id = ${clubId} and cm.status = 'active'
          where ums.movie_id = ${movies.id} and ums.in_watchlist
        )::int`,
      })
      .from(clubQueueItems)
      .innerJoin(movies, eq(movies.id, clubQueueItems.movieId))
      .where(and(eq(clubQueueItems.clubId, clubId), isNull(clubQueueItems.removedAt)))
      .orderBy(desc(clubQueueItems.createdAt))
      .limit(8),
  ]);

  return {
    onEveryonesRadar: radar.map((r) => ({
      movie: r.movie,
      metric: r.metric,
      reason: `On ${r.metric} members' watchlists`,
    })),
    nobodyHasSeen: unseen.map((r) => ({
      movie: r.movie,
      metric: 0,
      reason: 'Nobody in the club has seen it',
    })),
    fromTheQueue: queue.map((r) => ({
      movie: r.movie,
      metric: r.metric,
      reason: r.metric > 0 ? `${r.metric} already want to see it` : 'Waiting in the queue',
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Post-screening helpers                                                     */
/* -------------------------------------------------------------------------- */

export async function getViewerScreeningContext(screening: Screening, userId: string | null) {
  if (!userId) {
    return { attendance: null, hasLogged: false, clubRating: null as number | null };
  }
  const [attendance, logged, rating] = await Promise.all([
    db
      .select()
      .from(attendances)
      .where(and(eq(attendances.screeningId, screening.id), eq(attendances.userId, userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, userId),
          eq(diaryEntries.movieId, screening.movieId),
          isNull(diaryEntries.deletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows.length > 0),
    db
      .select({ rating: clubRatings.rating })
      .from(clubRatings)
      .where(and(eq(clubRatings.screeningId, screening.id), eq(clubRatings.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]?.rating ?? null),
  ]);

  return { attendance, hasLogged: logged, clubRating: rating };
}

export async function discoverPublicClubs(limit = 24) {
  return db
    .select({ club: clubs })
    .from(clubs)
    .where(and(eq(clubs.visibility, 'public'), isNull(clubs.deletedAt)))
    .orderBy(desc(clubs.memberCount), desc(clubs.screeningCount))
    .limit(limit)
    .then((rows) => rows.map((r) => r.club));
}

export async function countClubsFor(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(clubMembers)
    .where(and(eq(clubMembers.userId, userId), eq(clubMembers.status, 'active')));
  return Number(row?.value ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Weekly ritual                                                              */
/* -------------------------------------------------------------------------- */

export type WeeklyOpenResult = { clubId: string; clubName: string; roundId: string }[];

/**
 * Opens a wheel round for every club whose weekly slot has arrived.
 *
 * Idempotent in two ways, because a cron can fire late, twice, or overlap a
 * manual round: clubs that already have a live round are skipped, and
 * `weeklyPickLastOpenedAt` stops a second open inside the same six days.
 */
export async function openDueWeeklyRounds(now = new Date()): Promise<WeeklyOpenResult> {
  const candidates = await db
    .select()
    .from(clubs)
    .where(and(eq(clubs.weeklyPickEnabled, true), isNull(clubs.deletedAt)));

  const opened: WeeklyOpenResult = [];

  for (const club of candidates) {
    // Evaluate the club's own weekday/hour in its own timezone.
    let localDay: number;
    let localHour: number;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: club.timezone,
        weekday: 'short',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(now);
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
      localDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
      localHour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    } catch {
      continue;
    }

    if (localDay !== club.weeklyPickDay || localHour < club.weeklyPickHour) continue;

    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    if (club.weeklyPickLastOpenedAt && club.weeklyPickLastOpenedAt > sixDaysAgo) continue;

    const live = await getActiveRound(club.id);
    if (live) continue;

    try {
      const round = await startRound({
        clubId: club.id,
        userId: club.ownerId,
        title: null,
        mode: 'wheel',
        nominationLimitPerMember: 1,
        // Submissions close just before the next weekly slot.
        nominationsCloseAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        votingCloseAt: null,
      });

      await db
        .update(clubs)
        .set({ weeklyPickLastOpenedAt: now })
        .where(eq(clubs.id, club.id));

      await queueClubEmail(
        club.id,
        'submissions_open',
        `What should ${club.name} watch this week?`,
        (member) => ({
          clubName: club.name,
          clubSlug: club.slug,
          closesAt: null,
          recipientName: member.displayName,
        }),
        { dedupePrefix: `submissions:${round.id}` },
      );

      opened.push({ clubId: club.id, clubName: club.name, roundId: round.id });
    } catch (error) {
      console.error('[weekly] could not open round for', club.slug, error);
    }
  }

  return opened;
}

export async function setWeeklyPick(
  clubId: string,
  userId: string,
  settings: { enabled: boolean; day: number; hour: number },
): Promise<void> {
  await requireMembership(clubId, userId, 'admin');
  await db
    .update(clubs)
    .set({
      weeklyPickEnabled: settings.enabled,
      weeklyPickDay: Math.max(0, Math.min(6, Math.round(settings.day))),
      weeklyPickHour: Math.max(0, Math.min(23, Math.round(settings.hour))),
      updatedAt: new Date(),
    })
    .where(eq(clubs.id, clubId));
}

export async function getScreeningsNeedingReminder(withinHours = 24) {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
  return db
    .select({ screening: screenings, movie: movies })
    .from(screenings)
    .innerJoin(movies, eq(movies.id, screenings.movieId))
    .where(
      and(
        eq(screenings.status, 'scheduled'),
        isNull(screenings.reminderSentAt),
        gt(screenings.scheduledAt, now),
        lt(screenings.scheduledAt, horizon),
      ),
    );
}
