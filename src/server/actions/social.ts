'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track, trackFirst } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import {
  activityEvents,
  blocks,
  comments,
  diaryEntries,
  follows,
  listLikes,
  lists,
  reports,
  reviewLikes,
  tasteCircleMembers,
  users,
} from '@/server/db/schema';
import {
  actionGuard,
  NotFoundError,
  PermissionError,
  ValidationError,
  type ActionResult,
} from '@/server/errors';
import { assertCanInteractWith } from '@/server/privacy';
import { consumeRateLimit } from '@/server/rate-limit';
import { notify } from '@/server/services/notifications';

/* -------------------------------------------------------------------------- */
/* Following                                                                  */
/* -------------------------------------------------------------------------- */

export async function toggleFollowAction(
  targetUserId: string,
  source?: 'recommendation',
): Promise<ActionResult<{ following: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    if (user.id === targetUserId) throw new ValidationError('You cannot follow yourself.');
    await consumeRateLimit('follow', user.id);
    await assertCanInteractWith(user.id, targetUserId);

    const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!target || target.deletedAt) throw new NotFoundError('That account no longer exists.');
    if (!target.allowFollows) throw new PermissionError('This account is not accepting followers.');

    const following = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetUserId)))
        .limit(1);

      if (existing) {
        await tx
          .delete(follows)
          .where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetUserId)));
        await tx
          .delete(tasteCircleMembers)
          .where(and(
            eq(tasteCircleMembers.userId, user.id),
            eq(tasteCircleMembers.memberUserId, targetUserId),
          ));
        await tx
          .update(users)
          .set({ followingCount: sql`greatest(${users.followingCount} - 1, 0)` })
          .where(eq(users.id, user.id));
        await tx
          .update(users)
          .set({ followerCount: sql`greatest(${users.followerCount} - 1, 0)` })
          .where(eq(users.id, targetUserId));
        return false;
      }

      await tx.insert(follows).values({ followerId: user.id, followingId: targetUserId });
      await tx
        .update(users)
        .set({ followingCount: sql`${users.followingCount} + 1` })
        .where(eq(users.id, user.id));
      await tx
        .update(users)
        .set({ followerCount: sql`${users.followerCount} + 1` })
        .where(eq(users.id, targetUserId));
      await tx.insert(activityEvents).values({
        actorId: user.id,
        type: 'user_followed',
        targetUserId,
        visibility: 'public',
      });
      return true;
    });

    if (following) {
      await notify({
        userId: targetUserId,
        actorId: user.id,
        type: 'new_follower',
        url: `/@${user.username}`,
        body: `${user.displayName} started following you`,
        subjectType: 'user',
        subjectId: user.id,
        dedupeKey: `follow:${user.id}`,
      });
      await trackFirst('user_followed', 'first_follow', user.id, user.followingCount === 0, {
        targetUserId,
      });
      if (source === 'recommendation') {
        await track('recommended_follow', user.id, { targetUserId });
      }
    }

    revalidatePath(`/@${target.username}`);
    return { following };
  });
}

export async function toggleBlockAction(
  targetUserId: string,
): Promise<ActionResult<{ blocked: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    if (user.id === targetUserId) throw new ValidationError('You cannot block yourself.');

    const blocked = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ blockerId: blocks.blockerId })
        .from(blocks)
        .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetUserId)))
        .limit(1);

      if (existing) {
        await tx
          .delete(blocks)
          .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetUserId)));
        return false;
      }

      await tx.insert(blocks).values({ blockerId: user.id, blockedId: targetUserId });
      // Blocking severs the graph in both directions.
      await tx
        .delete(follows)
        .where(
          sql`(${follows.followerId} = ${user.id} and ${follows.followingId} = ${targetUserId})
              or (${follows.followerId} = ${targetUserId} and ${follows.followingId} = ${user.id})`,
        );
      await recountFollows(tx, user.id);
      await recountFollows(tx, targetUserId);
      return true;
    });

    revalidatePath('/');
    return { blocked };
  });
}

async function recountFollows(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  await tx
    .update(users)
    .set({
      followerCount: sql`(select count(*) from ${follows} f where f.following_id = ${userId})`,
      followingCount: sql`(select count(*) from ${follows} f where f.follower_id = ${userId})`,
    })
    .where(eq(users.id, userId));
}

/* -------------------------------------------------------------------------- */
/* Likes                                                                      */
/* -------------------------------------------------------------------------- */

export async function toggleReviewLikeAction(
  entryId: string,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();

    const [entry] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, entryId)).limit(1);
    if (!entry || entry.deletedAt) throw new NotFoundError('That review no longer exists.');
    await assertCanInteractWith(user.id, entry.userId);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ userId: reviewLikes.userId })
        .from(reviewLikes)
        .where(and(eq(reviewLikes.userId, user.id), eq(reviewLikes.diaryEntryId, entryId)))
        .limit(1);

      const delta = existing ? -1 : 1;
      if (existing) {
        await tx
          .delete(reviewLikes)
          .where(and(eq(reviewLikes.userId, user.id), eq(reviewLikes.diaryEntryId, entryId)));
      } else {
        await tx.insert(reviewLikes).values({ userId: user.id, diaryEntryId: entryId });
      }

      const [updated] = await tx
        .update(diaryEntries)
        .set({ likeCount: sql`greatest(${diaryEntries.likeCount} + ${delta}, 0)` })
        .where(eq(diaryEntries.id, entryId))
        .returning({ likeCount: diaryEntries.likeCount });

      return { liked: !existing, likeCount: updated.likeCount };
    });

    if (result.liked) {
      await notify({
        userId: entry.userId,
        actorId: user.id,
        type: 'review_liked',
        url: `/review/${entryId}`,
        body: `${user.displayName} liked your review`,
        subjectType: 'review',
        subjectId: entryId,
        dedupeKey: `review_like:${entryId}:${user.id}`,
      });
    }
    return result;
  });
}

export async function toggleListLikeAction(
  listId: string,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const [list] = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
    if (!list || list.deletedAt) throw new NotFoundError('That list no longer exists.');
    await assertCanInteractWith(user.id, list.userId);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ userId: listLikes.userId })
        .from(listLikes)
        .where(and(eq(listLikes.userId, user.id), eq(listLikes.listId, listId)))
        .limit(1);

      const delta = existing ? -1 : 1;
      if (existing) {
        await tx
          .delete(listLikes)
          .where(and(eq(listLikes.userId, user.id), eq(listLikes.listId, listId)));
      } else {
        await tx.insert(listLikes).values({ userId: user.id, listId });
      }

      const [updated] = await tx
        .update(lists)
        .set({ likeCount: sql`greatest(${lists.likeCount} + ${delta}, 0)` })
        .where(eq(lists.id, listId))
        .returning({ likeCount: lists.likeCount });

      return { liked: !existing, likeCount: updated.likeCount };
    });

    if (result.liked) {
      await notify({
        userId: list.userId,
        actorId: user.id,
        type: 'list_liked',
        url: `/list/${list.id}`,
        body: `${user.displayName} liked your list “${list.title}”`,
        subjectType: 'list',
        subjectId: listId,
        dedupeKey: `list_like:${listId}:${user.id}`,
      });
    }
    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                   */
/* -------------------------------------------------------------------------- */

const commentSchema = z.object({
  subjectType: z.enum(['review', 'list']),
  subjectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(1, 'Write something first.').max(2000),
  containsSpoilers: z.boolean().optional(),
});

export async function createCommentAction(
  input: z.infer<typeof commentSchema>,
): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('comment', user.id);
    const parsed = commentSchema.parse(input);

    const owner = await resolveSubjectOwner(parsed.subjectType, parsed.subjectId);
    await assertCanInteractWith(user.id, owner.ownerId);

    const [comment] = await db
      .insert(comments)
      .values({
        userId: user.id,
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        parentId: parsed.parentId ?? null,
        body: parsed.body,
        containsSpoilers: parsed.containsSpoilers ?? false,
      })
      .returning({ id: comments.id });

    if (parsed.subjectType === 'review') {
      await db
        .update(diaryEntries)
        .set({ commentCount: sql`${diaryEntries.commentCount} + 1` })
        .where(eq(diaryEntries.id, parsed.subjectId));
    } else {
      await db
        .update(lists)
        .set({ commentCount: sql`${lists.commentCount} + 1` })
        .where(eq(lists.id, parsed.subjectId));
    }

    await notify({
      userId: owner.ownerId,
      actorId: user.id,
      type: parsed.subjectType === 'review' ? 'review_comment' : 'list_comment',
      url: owner.url,
      body: `${user.displayName} commented on your ${parsed.subjectType}`,
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
    });

    if (parsed.parentId) {
      const [parent] = await db
        .select({ userId: comments.userId })
        .from(comments)
        .where(eq(comments.id, parsed.parentId))
        .limit(1);
      if (parent && parent.userId !== owner.ownerId) {
        await notify({
          userId: parent.userId,
          actorId: user.id,
          type: 'comment_reply',
          url: owner.url,
          body: `${user.displayName} replied to your comment`,
          subjectType: 'comment',
          subjectId: parsed.parentId,
        });
      }
    }

    revalidatePath(owner.url);
    return { id: comment.id };
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment || comment.deletedAt) throw new NotFoundError('That comment is already gone.');

    const owner = await resolveSubjectOwner(
      comment.subjectType as 'review' | 'list',
      comment.subjectId,
    );
    const canDelete =
      comment.userId === user.id || owner.ownerId === user.id || user.role !== 'member';
    if (!canDelete) throw new PermissionError('You cannot delete that comment.');

    await db
      .update(comments)
      .set({ deletedAt: new Date(), deletedByUserId: user.id })
      .where(eq(comments.id, commentId));

    if (comment.subjectType === 'review') {
      await db
        .update(diaryEntries)
        .set({ commentCount: sql`greatest(${diaryEntries.commentCount} - 1, 0)` })
        .where(eq(diaryEntries.id, comment.subjectId));
    } else {
      await db
        .update(lists)
        .set({ commentCount: sql`greatest(${lists.commentCount} - 1, 0)` })
        .where(eq(lists.id, comment.subjectId));
    }

    revalidatePath(owner.url);
    return null;
  });
}

async function resolveSubjectOwner(
  subjectType: 'review' | 'list',
  subjectId: string,
): Promise<{ ownerId: string; url: string }> {
  if (subjectType === 'review') {
    const [entry] = await db
      .select({ userId: diaryEntries.userId, deletedAt: diaryEntries.deletedAt })
      .from(diaryEntries)
      .where(eq(diaryEntries.id, subjectId))
      .limit(1);
    if (!entry || entry.deletedAt) throw new NotFoundError('That review no longer exists.');
    return { ownerId: entry.userId, url: `/review/${subjectId}` };
  }
  const [list] = await db
    .select({ userId: lists.userId, deletedAt: lists.deletedAt })
    .from(lists)
    .where(eq(lists.id, subjectId))
    .limit(1);
  if (!list || list.deletedAt) throw new NotFoundError('That list no longer exists.');
  return { ownerId: list.userId, url: `/list/${subjectId}` };
}

/* -------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* -------------------------------------------------------------------------- */

const reportSchema = z.object({
  subjectType: z.enum(['user', 'review', 'comment', 'list', 'club', 'club_post']),
  subjectId: z.string().uuid(),
  category: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'sexual_content',
    'violence',
    'self_harm',
    'spoilers',
    'misinformation',
    'impersonation',
    'other',
  ]),
  details: z.string().trim().max(1000).optional(),
});

export async function reportAction(
  input: z.infer<typeof reportSchema>,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('report', user.id);
    const parsed = reportSchema.parse(input);

    const snapshot = await snapshotSubject(parsed.subjectType, parsed.subjectId);

    await db
      .insert(reports)
      .values({
        reporterId: user.id,
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        subjectOwnerId: snapshot.ownerId,
        category: parsed.category,
        details: parsed.details ?? null,
        snapshot: snapshot.data,
      })
      .onConflictDoNothing();

    return null;
  });
}

/**
 * Captures the reported content at report time. Without this, a user can delete
 * their post and leave moderators reviewing an empty row.
 */
async function snapshotSubject(
  subjectType: z.infer<typeof reportSchema>['subjectType'],
  subjectId: string,
): Promise<{ ownerId: string | null; data: Record<string, unknown> }> {
  switch (subjectType) {
    case 'review': {
      const [row] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, subjectId)).limit(1);
      return { ownerId: row?.userId ?? null, data: { reviewText: row?.reviewText, rating: row?.rating } };
    }
    case 'comment': {
      const [row] = await db.select().from(comments).where(eq(comments.id, subjectId)).limit(1);
      return { ownerId: row?.userId ?? null, data: { body: row?.body } };
    }
    case 'list': {
      const [row] = await db.select().from(lists).where(eq(lists.id, subjectId)).limit(1);
      return { ownerId: row?.userId ?? null, data: { title: row?.title, description: row?.description } };
    }
    case 'user': {
      const [row] = await db.select().from(users).where(eq(users.id, subjectId)).limit(1);
      return { ownerId: row?.id ?? null, data: { username: row?.username, bio: row?.bio } };
    }
    default:
      return { ownerId: null, data: {} };
  }
}

export async function trackClientEvent(name: string, properties: Record<string, unknown> = {}) {
  const user = await requireUser().catch(() => null);
  if (!user) return;
  await track(name as Parameters<typeof track>[0], user.id, properties);
}
