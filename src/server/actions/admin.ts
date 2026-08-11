'use server';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/server/auth/session';
import { db } from '@/server/db';
import {
  clubDiscussionPosts,
  clubs,
  comments,
  diaryEntries,
  lists,
  moderationActions,
  reports,
  users,
} from '@/server/db/schema';
import { actionGuard, NotFoundError, type ActionResult } from '@/server/errors';
import { flushEmailQueue, type FlushResult } from '@/server/email/queue';
import { ensureMovieDetails } from '@/server/movies/catalog';
import { notify } from '@/server/services/notifications';

const resolutionSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['reviewing', 'actioned', 'dismissed']),
  note: z.string().trim().max(1000).optional(),
  action: z
    .enum(['none', 'remove_content', 'warn_user', 'suspend_user', 'unsuspend_user'])
    .default('none'),
});

/**
 * Resolving a report is the single moderation entry point: it updates the
 * report, performs the chosen action, writes an audit row, and (for anything a
 * user should know about) notifies them. Every step is in one transaction.
 */
export async function resolveReportAction(
  input: z.infer<typeof resolutionSchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const moderator = await requireAdmin();
    const parsed = resolutionSchema.parse(input);

    const [report] = await db.select().from(reports).where(eq(reports.id, parsed.reportId)).limit(1);
    if (!report) throw new NotFoundError('That report no longer exists.');

    await db.transaction(async (tx) => {
      await tx
        .update(reports)
        .set({
          status: parsed.status,
          resolutionNote: parsed.note ?? null,
          resolvedByUserId: parsed.status === 'reviewing' ? null : moderator.id,
          resolvedAt: parsed.status === 'reviewing' ? null : new Date(),
        })
        .where(eq(reports.id, parsed.reportId));

      if (parsed.action === 'remove_content') {
        await removeContent(tx, report.subjectType, report.subjectId, moderator.id);
      }

      if (parsed.action === 'suspend_user' && report.subjectOwnerId) {
        await tx
          .update(users)
          .set({ suspendedAt: new Date(), suspensionReason: parsed.note ?? 'Community guidelines' })
          .where(eq(users.id, report.subjectOwnerId));
      }

      if (parsed.action === 'unsuspend_user' && report.subjectOwnerId) {
        await tx
          .update(users)
          .set({ suspendedAt: null, suspensionReason: null })
          .where(eq(users.id, report.subjectOwnerId));
      }

      await tx.insert(moderationActions).values({
        actorUserId: moderator.id,
        action: parsed.action,
        subjectType: report.subjectType,
        subjectId: report.subjectId,
        reportId: report.id,
        reason: parsed.note ?? null,
        metadata: { status: parsed.status, category: report.category },
      });
    });

    if (
      report.subjectOwnerId &&
      (parsed.action === 'warn_user' ||
        parsed.action === 'remove_content' ||
        parsed.action === 'suspend_user')
    ) {
      await notify({
        userId: report.subjectOwnerId,
        type: 'moderation_action',
        url: '/guidelines',
        body:
          parsed.action === 'suspend_user'
            ? 'Your account has been suspended for breaching the community guidelines.'
            : parsed.action === 'remove_content'
              ? 'Some of your content was removed for breaching the community guidelines.'
              : 'A moderator has issued a warning about content you posted.',
      });
    }

    revalidatePath('/admin/reports');
    return null;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function removeContent(
  tx: Tx,
  subjectType: string,
  subjectId: string,
  moderatorId: string,
): Promise<void> {
  const now = new Date();
  switch (subjectType) {
    case 'review':
      await tx.update(diaryEntries).set({ deletedAt: now }).where(eq(diaryEntries.id, subjectId));
      break;
    case 'comment':
      await tx
        .update(comments)
        .set({ deletedAt: now, deletedByUserId: moderatorId })
        .where(eq(comments.id, subjectId));
      break;
    case 'list':
      await tx.update(lists).set({ deletedAt: now }).where(eq(lists.id, subjectId));
      break;
    case 'club':
      await tx.update(clubs).set({ deletedAt: now }).where(eq(clubs.id, subjectId));
      break;
    case 'club_post':
      await tx
        .update(clubDiscussionPosts)
        .set({ deletedAt: now, deletedByUserId: moderatorId })
        .where(eq(clubDiscussionPosts.id, subjectId));
      break;
  }
}

export async function setUserRoleAction(
  userId: string,
  role: 'member' | 'moderator' | 'admin',
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const moderator = await requireAdmin();
    if (moderator.role !== 'admin') {
      const { PermissionError } = await import('@/server/errors');
      throw new PermissionError('Only admins can change roles.');
    }
    await db.update(users).set({ role }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      actorUserId: moderator.id,
      action: 'set_role',
      subjectType: 'user',
      subjectId: userId,
      metadata: { role },
    });
    revalidatePath('/admin/users');
    return null;
  });
}

export async function toggleSuspensionAction(
  userId: string,
  reason: string | null,
): Promise<ActionResult<{ suspended: boolean }>> {
  return actionGuard(async () => {
    const moderator = await requireAdmin();
    const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new NotFoundError('No such user.');

    const suspended = !target.suspendedAt;
    await db
      .update(users)
      .set({
        suspendedAt: suspended ? new Date() : null,
        suspensionReason: suspended ? reason : null,
      })
      .where(eq(users.id, userId));

    await db.insert(moderationActions).values({
      actorUserId: moderator.id,
      action: suspended ? 'suspend_user' : 'unsuspend_user',
      subjectType: 'user',
      subjectId: userId,
      reason,
    });

    revalidatePath('/admin/users');
    return { suspended };
  });
}

/** Refreshes a film's metadata when a match or its details look wrong. */
export async function refreshMovieMetadataAction(
  providerId: string,
): Promise<ActionResult<{ title: string }>> {
  return actionGuard(async () => {
    const moderator = await requireAdmin();
    const { movie } = await ensureMovieDetails(providerId, { force: true });
    await db.insert(moderationActions).values({
      actorUserId: moderator.id,
      action: 'refresh_movie_metadata',
      subjectType: 'user',
      subjectId: moderator.id,
      metadata: { providerId, movieId: movie.id },
    });
    revalidatePath('/admin/movies');
    return { title: movie.title };
  });
}

export async function flushEmailQueueAction(): Promise<ActionResult<FlushResult>> {
  return actionGuard(async () => {
    await requireAdmin();
    return flushEmailQueue(60);
  });
}

export async function adminSearchUsers(term: string) {
  await requireAdmin();
  const like = `%${term.trim().toLowerCase()}%`;
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
      filmCount: users.filmCount,
      reportCount: sql<number>`(
        select count(*) from nitrate.reports r where r.subject_owner_id = ${users.id}
      )::int`,
    })
    .from(users)
    .where(
      term.trim()
        ? sql`lower(${users.username}) like ${like} or lower(${users.displayName}) like ${like} or lower(${users.email}) like ${like}`
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(40);
}

export async function adminListClubs() {
  await requireAdmin();
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      visibility: clubs.visibility,
      memberCount: clubs.memberCount,
      screeningCount: clubs.screeningCount,
      createdAt: clubs.createdAt,
      ownerUsername: users.username,
    })
    .from(clubs)
    .innerJoin(users, eq(users.id, clubs.ownerId))
    .where(isNull(clubs.deletedAt))
    .orderBy(desc(clubs.createdAt))
    .limit(50);
}

export async function adminAuditLog() {
  await requireAdmin();
  return db
    .select({
      id: moderationActions.id,
      action: moderationActions.action,
      subjectType: moderationActions.subjectType,
      subjectId: moderationActions.subjectId,
      reason: moderationActions.reason,
      createdAt: moderationActions.createdAt,
      actor: users.username,
    })
    .from(moderationActions)
    .innerJoin(users, eq(users.id, moderationActions.actorUserId))
    .orderBy(desc(moderationActions.createdAt))
    .limit(100);
}

export async function adminReports(status: 'open' | 'reviewing' | 'actioned' | 'dismissed') {
  await requireAdmin();
  return db
    .select({
      report: reports,
      reporter: { username: users.username, displayName: users.displayName },
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(and(eq(reports.status, status)))
    .orderBy(desc(reports.createdAt))
    .limit(60);
}
