import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import { blocks, clubJoinRequests, clubMembers, clubs, moderationActions, notifications, users } from '@/server/db/schema';
import { ConflictError, NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { assertCanInteractWith } from '@/server/privacy';
import { consumeRateLimit } from '@/server/rate-limit';
import { requireNetworkSurface } from '@/server/services/network';
import { notify } from '@/server/services/notifications';

async function publicClub(clubId: string) {
  const [club] = await db.select().from(clubs).where(and(eq(clubs.id, clubId), eq(clubs.visibility, 'public'), isNull(clubs.deletedAt))).limit(1);
  if (!club) throw new NotFoundError('That public club is unavailable.');
  return club;
}

async function addActiveMember(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], clubId: string, userId: string) {
  const [existing] = await tx.select().from(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId))).limit(1);
  if (existing?.status === 'active') return false;
  if (existing?.status === 'banned') throw new PermissionError('You cannot join this club.');
  if (existing) await tx.update(clubMembers).set({ status: 'active', role: 'member', joinedAt: new Date() }).where(eq(clubMembers.id, existing.id));
  else await tx.insert(clubMembers).values({ clubId, userId, role: 'member', status: 'active' });
  await tx.update(clubs).set({ memberCount: sql`${clubs.memberCount} + 1`, updatedAt: new Date() }).where(eq(clubs.id, clubId));
  return true;
}

export async function joinOpenPublicClub(clubId: string, userId: string) {
  await requireNetworkSurface('public_clubs');
  await consumeRateLimit('club_open_join', userId);
  const club = await publicClub(clubId);
  if (club.joinPolicy !== 'open') throw new PermissionError('This club does not allow open joining.');
  await assertCanInteractWith(userId, club.ownerId);
  return db.transaction(async (tx) => {
    const joined = await addActiveMember(tx, clubId, userId);
    if (joined) {
      await tx.insert(moderationActions).values({
        actorUserId: userId,
        action: 'public_club_open_join',
        subjectType: 'club',
        subjectId: clubId,
      });
    }
    return { joined, club };
  });
}

export async function requestPublicClubJoin(clubId: string, userId: string, message?: string | null) {
  await requireNetworkSurface('public_clubs');
  await consumeRateLimit('club_join_request', userId);
  const club = await publicClub(clubId);
  if (club.joinPolicy !== 'request') throw new PermissionError('This club is not accepting requests.');
  await assertCanInteractWith(userId, club.ownerId);
  const [membership] = await db.select().from(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId))).limit(1);
  if (membership?.status === 'active') throw new ConflictError('You are already in this club.');
  if (membership?.status === 'banned') throw new PermissionError('You cannot request to join this club.');
  const [{ value: pending }] = await db.select({ value: sql<number>`count(*)::int` }).from(clubJoinRequests).where(and(eq(clubJoinRequests.userId, userId), eq(clubJoinRequests.status, 'pending')));
  if (pending >= 5) throw new ValidationError('You can have up to five pending club requests.');
  const [request] = await db.insert(clubJoinRequests).values({ clubId, userId, message: message?.trim().slice(0, 500) || null }).onConflictDoNothing().returning();
  if (!request) throw new ConflictError('Your request is already pending.');
  const admins = await db.select({ userId: clubMembers.userId }).from(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, 'active'), sql`${clubMembers.role} in ('owner', 'admin')`));
  for (const admin of admins) await notify({ userId: admin.userId, actorId: userId, type: 'club_join_request', clubId, subjectType: 'club', subjectId: clubId, url: `/club/${club.slug}/members`, body: 'A member requested to join your public club', dedupeKey: `club-join-request:${request.id}:${admin.userId}` });
  return request;
}

export async function decideClubJoinRequest(requestId: string, adminUserId: string, decision: 'approved' | 'declined') {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ request: clubJoinRequests, club: clubs }).from(clubJoinRequests).innerJoin(clubs, eq(clubs.id, clubJoinRequests.clubId)).where(eq(clubJoinRequests.id, requestId)).limit(1);
    if (!row || row.request.status !== 'pending') throw new NotFoundError('That join request is no longer pending.');
    const [admin] = await tx.select().from(clubMembers).where(and(eq(clubMembers.clubId, row.club.id), eq(clubMembers.userId, adminUserId), eq(clubMembers.status, 'active'))).limit(1);
    if (!admin || admin.role === 'member') throw new PermissionError('Only club admins can decide join requests.');
    const blocked = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, row.request.userId), isNull(users.suspendedAt), isNull(users.deletedAt), sql`not exists (select 1 from ${blocks} b where (b.blocker_id = ${adminUserId} and b.blocked_id = ${row.request.userId}) or (b.blocker_id = ${row.request.userId} and b.blocked_id = ${adminUserId}))`)).limit(1);
    if (decision === 'approved' && !blocked.length) throw new PermissionError('This member cannot join the club.');
    if (decision === 'approved') await addActiveMember(tx, row.club.id, row.request.userId);
    await tx.update(clubJoinRequests).set({ status: decision, decidedByUserId: adminUserId, decidedAt: new Date() }).where(eq(clubJoinRequests.id, requestId));
    await tx.insert(moderationActions).values({ actorUserId: adminUserId, action: `club_join_${decision}`, subjectType: 'club', subjectId: row.club.id, metadata: { requestId, userId: row.request.userId } });
    await tx.insert(notifications).values({ userId: row.request.userId, actorId: adminUserId, type: decision === 'approved' ? 'club_join_approved' : 'club_join_declined', clubId: row.club.id, subjectType: 'club', subjectId: row.club.id, url: `/club/${row.club.slug}`, body: decision === 'approved' ? `Your request to join ${row.club.name} was approved` : `Your request to join ${row.club.name} was declined`, dedupeKey: `club-join-decision:${requestId}` });
    return { club: row.club, decision };
  });
}

export async function listPendingClubJoinRequests(clubId: string, adminUserId: string) {
  const [admin] = await db.select().from(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, adminUserId), eq(clubMembers.status, 'active'))).limit(1);
  if (!admin || admin.role === 'member') throw new PermissionError('Only club admins can review requests.');
  return db.select({ request: clubJoinRequests, user: { id: users.id, username: users.username, displayName: users.displayName } }).from(clubJoinRequests).innerJoin(users, eq(users.id, clubJoinRequests.userId)).where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.status, 'pending'), isNull(users.suspendedAt))).orderBy(desc(clubJoinRequests.createdAt)).limit(100);
}

export async function setClubJoinPolicy(clubId: string, adminUserId: string, joinPolicy: 'invite_only' | 'request' | 'open') {
  return db.transaction(async (tx) => {
    const [admin] = await tx
      .select()
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.userId, adminUserId),
          eq(clubMembers.status, 'active'),
        ),
      )
      .limit(1);
    if (!admin || admin.role === 'member') {
      throw new PermissionError('Only club admins can change joining.');
    }
    const [club] = await tx
      .update(clubs)
      .set({ joinPolicy, updatedAt: new Date() })
      .where(and(eq(clubs.id, clubId), eq(clubs.visibility, 'public')))
      .returning();
    if (!club) throw new ValidationError('Only public clubs can change Network joining.');
    await tx.insert(moderationActions).values({
      actorUserId: adminUserId,
      action: 'set_club_join_policy',
      subjectType: 'club',
      subjectId: clubId,
      metadata: { joinPolicy },
    });
    return club;
  });
}
