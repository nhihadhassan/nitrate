import 'server-only';

import { and, asc, eq, lt, or, sql } from 'drizzle-orm';

import { db, type DbOrTx } from '@/server/db';
import { clubMembers, emailDeliveries, users } from '@/server/db/schema';

import { renderTemplate, type TemplateName } from './templates';
import { mailTransport } from './transport';

const MAX_ATTEMPTS = 4;

export type QueueEmailInput = {
  userId: string;
  toEmail: string;
  template: TemplateName;
  subject: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
};

/**
 * Writes to the outbox. Call this inside the transaction that caused the mail:
 * if that transaction rolls back, the mail is never queued, which is the whole
 * point of an outbox rather than sending inline.
 */
export async function queueEmail(input: QueueEmailInput, tx: DbOrTx = db): Promise<void> {
  await tx
    .insert(emailDeliveries)
    .values({
      userId: input.userId,
      toEmail: input.toEmail,
      template: input.template,
      subject: input.subject,
      payload: input.payload,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Queues one mail per active, unmuted club member.
 *
 * Addresses are resolved here rather than at send time so the outbox records
 * who it was actually for, and deleted accounts (whose address is scrubbed to
 * an .invalid domain) are excluded.
 */
export async function queueClubEmail(
  clubId: string,
  template: TemplateName,
  subject: string,
  payloadFor: (member: { displayName: string }) => Record<string, unknown>,
  options: {
    excludeUserId?: string;
    dedupePrefix?: string;
    preference?: 'movieNightReminders' | 'picksAndVoting' | 'winnerSelected';
  } = {},
  tx: DbOrTx = db,
): Promise<number> {
  const members = await tx
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      movieNightReminders: users.emailMovieNightReminders,
      picksAndVoting: users.emailPicksAndVoting,
      winnerSelected: users.emailWinnerSelected,
    })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.status, 'active'),
        eq(clubMembers.notificationsMuted, false),
        sql`${users.deletedAt} is null`,
        sql`${users.suspendedAt} is null`,
        sql`${users.email} not like '%@nitrate.invalid'`,
      ),
    );

  const recipients = members.filter(
    (member) =>
      member.id !== options.excludeUserId &&
      (!options.preference || member[options.preference]),
  );
  if (!recipients.length) return 0;

  await tx
    .insert(emailDeliveries)
    .values(
      recipients.map((member) => ({
        userId: member.id,
        toEmail: member.email,
        template,
        subject,
        payload: payloadFor({ displayName: member.displayName }),
        dedupeKey: options.dedupePrefix ? `${options.dedupePrefix}:${member.id}` : null,
      })),
    )
    .onConflictDoNothing();

  return recipients.length;
}

export type FlushResult = { sent: number; failed: number; remaining: number };

/**
 * Drains the outbox. Safe to run concurrently: each row is claimed with a
 * conditional update before any network call, so two workers cannot send the
 * same message twice.
 */
export async function flushEmailQueue(limit = 40): Promise<FlushResult> {
  const transport = mailTransport();
  const result: FlushResult = { sent: 0, failed: 0, remaining: 0 };

  const pending = await db
    .select()
    .from(emailDeliveries)
    .where(and(eq(emailDeliveries.status, 'queued'), lt(emailDeliveries.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(emailDeliveries.createdAt))
    .limit(limit);

  for (const row of pending) {
    // Claim it. If another worker got there first, the update affects no rows.
    const claimed = await db
      .update(emailDeliveries)
      .set({ attempts: row.attempts + 1 })
      .where(and(eq(emailDeliveries.id, row.id), eq(emailDeliveries.attempts, row.attempts)))
      .returning({ id: emailDeliveries.id });
    if (!claimed.length) continue;

    let rendered;
    try {
      rendered = renderTemplate(row.template as TemplateName, row.payload);
    } catch (error) {
      await db
        .update(emailDeliveries)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message.slice(0, 300) : 'Render failed',
        })
        .where(eq(emailDeliveries.id, row.id));
      result.failed += 1;
      continue;
    }

    const outcome = await transport.send({ ...rendered, to: row.toEmail });

    if (outcome.ok) {
      await db
        .update(emailDeliveries)
        .set({
          status: 'sent',
          sentAt: new Date(),
          providerMessageId: outcome.providerMessageId,
          error: null,
        })
        .where(eq(emailDeliveries.id, row.id));
      result.sent += 1;
    } else {
      const exhausted = !outcome.retryable || row.attempts + 1 >= MAX_ATTEMPTS;
      await db
        .update(emailDeliveries)
        .set({
          status: exhausted ? 'failed' : 'queued',
          error: outcome.error.slice(0, 300),
        })
        .where(eq(emailDeliveries.id, row.id));
      result.failed += 1;
    }
  }

  const [{ value }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(emailDeliveries)
    .where(and(eq(emailDeliveries.status, 'queued'), lt(emailDeliveries.attempts, MAX_ATTEMPTS)));
  result.remaining = value ?? 0;

  return result;
}

export async function getOutbox(limit = 60) {
  return db
    .select({
      id: emailDeliveries.id,
      toEmail: emailDeliveries.toEmail,
      template: emailDeliveries.template,
      subject: emailDeliveries.subject,
      status: emailDeliveries.status,
      attempts: emailDeliveries.attempts,
      error: emailDeliveries.error,
      createdAt: emailDeliveries.createdAt,
      sentAt: emailDeliveries.sentAt,
    })
    .from(emailDeliveries)
    .orderBy(sql`${emailDeliveries.createdAt} desc`)
    .limit(limit);
}

export async function getOutboxCounts() {
  const rows = await db
    .select({ status: emailDeliveries.status, value: sql<number>`count(*)::int` })
    .from(emailDeliveries)
    .groupBy(emailDeliveries.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.value])) as Record<string, number>;
}

/** Used by the admin outbox to re-queue something that failed for a fixable reason. */
export async function retryEmail(id: string): Promise<void> {
  await db
    .update(emailDeliveries)
    .set({ status: 'queued', attempts: 0, error: null })
    .where(and(eq(emailDeliveries.id, id), or(eq(emailDeliveries.status, 'failed'))));
}
