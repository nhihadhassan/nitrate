import 'server-only';

import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import {
  activityEvents,
  clubs,
  diaryEntries,
  follows,
  lists,
  movies,
  reviewLikes,
  users,
  type ActivityEvent,
  type Movie,
} from '@/server/db/schema';
import { notBlockedSql, type Viewer } from '@/server/privacy';

export type FeedItem = {
  id: string;
  type: ActivityEvent['type'];
  createdAt: Date;
  actor: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: Movie | null;
  entry: {
    id: string;
    rating: number | null;
    liked: boolean;
    reviewText: string | null;
    containsSpoilers: boolean;
    watchedDate: string;
    isRewatch: boolean;
    likeCount: number;
    commentCount: number;
    likedByViewer: boolean;
  } | null;
  list: { id: string; title: string; slug: string; itemCount: number } | null;
  club: { id: string; name: string; slug: string } | null;
  metadata: Record<string, unknown>;
};

const FEED_TYPES_HOME = [
  'film_logged',
  'film_rated',
  'film_liked',
  'review_created',
  'list_created',
  'club_movie_selected',
  'club_screening_completed',
] as const;

/**
 * Chronological feed over a single append-only event table.
 *
 * One query with three left joins, keyset-paginated on createdAt. No fan-out
 * across per-type tables, and privacy is applied in SQL rather than trimmed
 * afterwards — so a private entry never leaves the database in the first place.
 */
export async function getHomeFeed(
  viewer: Viewer,
  options: { before?: Date; limit?: number; scope?: 'following' | 'everyone' } = {},
): Promise<FeedItem[]> {
  const limit = options.limit ?? 25;
  const scope = options.scope ?? (viewer ? 'following' : 'everyone');

  const audience =
    scope === 'following' && viewer
      ? or(
          eq(activityEvents.actorId, viewer.id),
          sql`exists (select 1 from ${follows} f where f.follower_id = ${viewer.id} and f.following_id = ${activityEvents.actorId})`,
        )
      : undefined;

  const visibility = viewer
    ? sql`(
        ${activityEvents.actorId} = ${viewer.id}
        or ${activityEvents.visibility} = 'public'
        or (${activityEvents.visibility} = 'followers' and exists (
          select 1 from ${follows} f
          where f.follower_id = ${viewer.id} and f.following_id = ${activityEvents.actorId}
        ))
      )`
    : sql`${activityEvents.visibility} = 'public'`;

  const rows = await db
    .select({
      event: activityEvents,
      actorId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      movie: movies,
      entry: diaryEntries,
      listId: lists.id,
      listTitle: lists.title,
      listSlug: lists.slug,
      listItemCount: lists.itemCount,
      listVisibility: lists.visibility,
      clubId: clubs.id,
      clubName: clubs.name,
      clubSlug: clubs.slug,
    })
    .from(activityEvents)
    .innerJoin(users, eq(users.id, activityEvents.actorId))
    .leftJoin(movies, eq(movies.id, activityEvents.movieId))
    .leftJoin(diaryEntries, eq(diaryEntries.id, activityEvents.diaryEntryId))
    .leftJoin(lists, eq(lists.id, activityEvents.listId))
    .leftJoin(clubs, eq(clubs.id, activityEvents.clubId))
    .where(
      and(
        inArray(activityEvents.type, [...FEED_TYPES_HOME]),
        isNull(users.deletedAt),
        options.before ? lt(activityEvents.createdAt, options.before) : undefined,
        audience,
        visibility,
        notBlockedSql(sql`${activityEvents.actorId}`, viewer?.id ?? null),
        // Deleted diary entries leave their event behind; skip them.
        or(isNull(activityEvents.diaryEntryId), isNull(diaryEntries.deletedAt)),
        // Club events only reach members.
        or(
          isNull(activityEvents.clubId),
          viewer
            ? sql`exists (
                select 1 from nitrate.club_members cm
                where cm.club_id = ${activityEvents.clubId}
                  and cm.user_id = ${viewer.id}
                  and cm.status = 'active'
              )`
            : sql`false`,
        ),
      ),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  const entryIds = rows.map((r) => r.entry?.id).filter((id): id is string => Boolean(id));
  const likedByViewer = viewer && entryIds.length ? await likedEntryIds(viewer.id, entryIds) : new Set<string>();

  return rows.map((row) => ({
    id: row.event.id,
    type: row.event.type,
    createdAt: row.event.createdAt,
    actor: {
      id: row.actorId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
    movie: row.movie,
    entry: row.entry
      ? {
          id: row.entry.id,
          rating: row.entry.rating,
          liked: row.entry.liked,
          reviewText: row.entry.reviewText,
          containsSpoilers: row.entry.containsSpoilers,
          watchedDate: row.entry.watchedDate,
          isRewatch: row.entry.isRewatch,
          likeCount: row.entry.likeCount,
          commentCount: row.entry.commentCount,
          likedByViewer: likedByViewer.has(row.entry.id),
        }
      : null,
    list: row.listId
      ? { id: row.listId, title: row.listTitle!, slug: row.listSlug!, itemCount: row.listItemCount! }
      : null,
    club: row.clubId ? { id: row.clubId, name: row.clubName!, slug: row.clubSlug! } : null,
    metadata: row.event.metadata,
  }));
}

async function likedEntryIds(viewerId: string, entryIds: string[]): Promise<Set<string>> {
  const rows = await db
    .select({ id: reviewLikes.diaryEntryId })
    .from(reviewLikes)
    .where(and(eq(reviewLikes.userId, viewerId), inArray(reviewLikes.diaryEntryId, entryIds)));
  return new Set(rows.map((r) => r.id));
}

export async function getUserActivity(userId: string, viewer: Viewer, limit = 12): Promise<FeedItem[]> {
  const rows = await db
    .select({
      event: activityEvents,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
      movie: movies,
      entry: diaryEntries,
    })
    .from(activityEvents)
    .innerJoin(users, eq(users.id, activityEvents.actorId))
    .leftJoin(movies, eq(movies.id, activityEvents.movieId))
    .leftJoin(diaryEntries, eq(diaryEntries.id, activityEvents.diaryEntryId))
    .where(
      and(
        eq(activityEvents.actorId, userId),
        ne(activityEvents.visibility, 'private'),
        inArray(activityEvents.type, [...FEED_TYPES_HOME]),
        or(isNull(activityEvents.diaryEntryId), isNull(diaryEntries.deletedAt)),
        viewer?.id === userId
          ? undefined
          : sql`(${activityEvents.visibility} = 'public' or (${activityEvents.visibility} = 'followers' and ${
              viewer
                ? sql`exists (select 1 from ${follows} f where f.follower_id = ${viewer.id} and f.following_id = ${userId})`
                : sql`false`
            }))`,
      ),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.event.id,
    type: row.event.type,
    createdAt: row.event.createdAt,
    actor: {
      id: userId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
    movie: row.movie,
    entry: row.entry
      ? {
          id: row.entry.id,
          rating: row.entry.rating,
          liked: row.entry.liked,
          reviewText: row.entry.reviewText,
          containsSpoilers: row.entry.containsSpoilers,
          watchedDate: row.entry.watchedDate,
          isRewatch: row.entry.isRewatch,
          likeCount: row.entry.likeCount,
          commentCount: row.entry.commentCount,
          likedByViewer: false,
        }
      : null,
    list: null,
    club: null,
    metadata: row.event.metadata,
  }));
}
