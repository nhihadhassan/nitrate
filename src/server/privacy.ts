import 'server-only';

import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/server/db';
import { blocks, follows, users, type User } from '@/server/db/schema';
import { NotFoundError, PermissionError } from '@/server/errors';

export type Viewer = Pick<User, 'id' | 'role'> | null;

export function isStaff(viewer: Viewer): boolean {
  return viewer?.role === 'admin' || viewer?.role === 'moderator';
}

/* -------------------------------------------------------------------------- */
/* Blocking                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Blocking is symmetric for visibility purposes: neither party sees the other's
 * content, regardless of who pressed the button. Enforced in SQL so it cannot be
 * bypassed by hitting an API directly.
 */
export function notBlockedSql(authorColumn: SQL | { name: string }, viewerId: string | null): SQL {
  if (!viewerId) return sql`true`;
  const author = 'name' in authorColumn ? sql`${authorColumn}` : authorColumn;
  return sql`not exists (
    select 1 from ${blocks} b
    where (b.blocker_id = ${author} and b.blocked_id = ${viewerId})
       or (b.blocker_id = ${viewerId} and b.blocked_id = ${author})
  )`;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const rows = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Content visibility                                                         */
/* -------------------------------------------------------------------------- */

/**
 * SQL predicate for "viewer may see a row with this visibility owned by this
 * author". `followers` requires an existing follow edge from viewer -> author.
 */
export function visibilitySql(
  visibilityColumn: SQL,
  authorColumn: SQL,
  viewer: Viewer,
): SQL {
  if (isStaff(viewer)) return sql`true`;
  if (!viewer) return sql`${visibilityColumn} = 'public'`;
  return sql`(
    ${authorColumn} = ${viewer.id}
    or ${visibilityColumn} = 'public'
    or (
      ${visibilityColumn} = 'followers'
      and exists (
        select 1 from ${follows} f
        where f.follower_id = ${viewer.id} and f.following_id = ${authorColumn}
      )
    )
  )`;
}

/** Combined visibility + block predicate — the one to reach for by default. */
export function viewableSql(visibilityColumn: SQL, authorColumn: SQL, viewer: Viewer): SQL {
  return and(visibilitySql(visibilityColumn, authorColumn, viewer), notBlockedSql(authorColumn, viewer?.id ?? null))!;
}

export type ProfileAccess = {
  canView: boolean;
  reason: 'ok' | 'private' | 'followers_only' | 'blocked' | 'deleted';
  isSelf: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  hasBlocked: boolean;
};

export async function resolveProfileAccess(profile: User, viewer: Viewer): Promise<ProfileAccess> {
  const isSelf = viewer?.id === profile.id;
  if (profile.deletedAt && !isStaff(viewer)) {
    return {
      canView: false,
      reason: 'deleted',
      isSelf,
      isFollowing: false,
      isFollowedBy: false,
      hasBlocked: false,
    };
  }
  if (isSelf || isStaff(viewer)) {
    return { canView: true, reason: 'ok', isSelf, isFollowing: false, isFollowedBy: false, hasBlocked: false };
  }

  if (!viewer) {
    return {
      canView: profile.profileVisibility === 'public',
      reason: profile.profileVisibility === 'public' ? 'ok' : 'private',
      isSelf: false,
      isFollowing: false,
      isFollowedBy: false,
      hasBlocked: false,
    };
  }

  const [blockRows, followRows] = await Promise.all([
    db
      .select({ blockerId: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, profile.id)),
          and(eq(blocks.blockerId, profile.id), eq(blocks.blockedId, viewer.id)),
        ),
      ),
    db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        or(
          and(eq(follows.followerId, viewer.id), eq(follows.followingId, profile.id)),
          and(eq(follows.followerId, profile.id), eq(follows.followingId, viewer.id)),
        ),
      ),
  ]);

  if (blockRows.length > 0) {
    return {
      canView: false,
      reason: 'blocked',
      isSelf: false,
      isFollowing: false,
      isFollowedBy: false,
      hasBlocked: blockRows.some((r) => r.blockerId === viewer.id),
    };
  }

  const following = followRows.some((r) => r.followerId === viewer.id);
  const followedBy = followRows.some((r) => r.followerId === profile.id);

  const canView =
    profile.profileVisibility === 'public' ||
    (profile.profileVisibility === 'followers' && following);

  return {
    canView,
    reason: canView ? 'ok' : profile.profileVisibility === 'private' ? 'private' : 'followers_only',
    isSelf: false,
    isFollowing: following,
    isFollowedBy: followedBy,
    hasBlocked: false,
  };
}

export async function loadUserByUsername(username: string): Promise<User> {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .limit(1);
  const user = rows[0];
  if (!user) throw new NotFoundError('That profile does not exist.');
  return user;
}

export async function assertCanInteractWith(viewerId: string, targetUserId: string): Promise<void> {
  if (await isBlockedEitherWay(viewerId, targetUserId)) {
    throw new PermissionError('You cannot interact with this account.');
  }
}

/** Ids the viewer must never see content from, useful for in-memory filtering. */
export async function blockedUserIds(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)));
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === viewerId ? row.blockedId : row.blockerId);
  }
  return ids;
}

export async function followingIds(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));
  return rows.map((r) => r.id);
}

export async function usersByIds(ids: string[]): Promise<Map<string, User>> {
  if (!ids.length) return new Map();
  const rows = await db.select().from(users).where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}
