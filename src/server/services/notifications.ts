import 'server-only';

import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';

import { db, type DbOrTx } from '@/server/db';
import { blocks, clubMembers, notifications, users, type Notification } from '@/server/db/schema';

type NotificationType = Notification['type'];

export type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  url: string;
  body?: string;
  subjectType?: Notification['subjectType'];
  subjectId?: string | null;
  clubId?: string | null;
  metadata?: Record<string, unknown>;
  /** Same key within a burst collapses into one row. */
  dedupeKey?: string;
  /** Stable subject-level key used to collapse a burst into one counted row. */
  groupKey?: string;
};

/**
 * Fan-out is deliberately conservative: never notify yourself, never notify
 * across a block, and honour per-club mutes. Clubs are the noisiest surface in
 * the product, so they get the most restraint.
 */
export async function notify(input: NotifyInput, tx: DbOrTx = db): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;

  if (input.actorId) {
    const blocked = await tx
      .select({ x: sql<number>`1` })
      .from(blocks)
      .where(
        sql`(${blocks.blockerId} = ${input.userId} and ${blocks.blockedId} = ${input.actorId})
            or (${blocks.blockerId} = ${input.actorId} and ${blocks.blockedId} = ${input.userId})`,
      )
      .limit(1);
    if (blocked.length) return;
  }

  if (input.clubId) {
    const [membership] = await tx
      .select({ muted: clubMembers.notificationsMuted, status: clubMembers.status })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, input.clubId), eq(clubMembers.userId, input.userId)))
      .limit(1);
    if (membership && (membership.muted || membership.status !== 'active')) return;
  }

  if (input.groupKey) {
    await tx.insert(notifications).values({
      userId: input.userId, actorId: input.actorId ?? null, type: input.type, url: input.url,
      body: input.body ?? null, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null,
      clubId: input.clubId ?? null, metadata: input.metadata ?? {}, groupKey: input.groupKey,
    }).onConflictDoUpdate({
      target: [notifications.userId, notifications.groupKey],
      targetWhere: sql`${notifications.groupKey} is not null`,
      set: { actorId: input.actorId ?? null, body: input.body ?? null, url: input.url,
        metadata: input.metadata ?? {}, groupCount: sql`${notifications.groupCount} + 1`, readAt: null, createdAt: new Date() },
    });
    return;
  }

  await tx
    .insert(notifications)
    .values({
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      url: input.url,
      body: input.body ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      clubId: input.clubId ?? null,
      metadata: input.metadata ?? {},
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing();
}

/** Notifies every active member of a club except the actor. One statement. */
export async function notifyClub(
  clubId: string,
  input: Omit<NotifyInput, 'userId' | 'clubId'>,
  tx: DbOrTx = db,
): Promise<void> {
  const members = await tx
    .select({ userId: clubMembers.userId })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.status, 'active'),
        eq(clubMembers.notificationsMuted, false),
      ),
    );

  const recipients = members.map((m) => m.userId).filter((id) => id !== input.actorId);
  if (!recipients.length) return;

  await tx
    .insert(notifications)
    .values(
      recipients.map((userId) => ({
        userId,
        actorId: input.actorId ?? null,
        type: input.type,
        url: input.url,
        body: input.body ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        clubId,
        metadata: input.metadata ?? {},
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
      })),
    )
    .onConflictDoNothing();
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  } catch {
    // The bell must never take down a page render.
    return 0;
  }
}

export type NotificationRow = Notification & {
  actor: { username: string; displayName: string; avatarAssetId: string | null } | null;
};

export async function listNotifications(
  userId: string,
  options: { before?: Date; limit?: number } = {},
): Promise<NotificationRow[]> {
  const limit = options.limit ?? 40;
  const rows = await db
    .select({
      notification: notifications,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatar: users.avatarAssetId,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(
      and(
        eq(notifications.userId, userId),
        options.before ? lt(notifications.createdAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.notification,
    actor: row.actorUsername
      ? {
          username: row.actorUsername,
          displayName: row.actorDisplayName ?? row.actorUsername,
          avatarAssetId: row.actorAvatar ?? null,
        }
      : null,
  }));
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ids?.length ? inArray(notifications.id, ids) : undefined,
      ),
    );
}
