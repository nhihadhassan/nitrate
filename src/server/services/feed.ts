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

export type FeedEntry = {
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
};

export type FeedItem = {
  id: string;
  /** Every event type folded into this card, newest first. */
  types: ActivityEvent['type'][];
  createdAt: Date;
  /** Oldest event in the group — the keyset cursor for the next page. */
  oldestAt: Date;
  actor: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: Movie | null;
  entry: FeedEntry | null;
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
 * Logging a film writes several events within a second or two — watched, rated,
 * liked, reviewed. Internally that is worth keeping: each is a real fact with
 * its own timestamp. As a feed it is four near-identical cards about one act of
 * watching one film, which is the fastest way to make a feed unreadable.
 */
const AGGREGATION_TYPES = new Set<ActivityEvent['type']>([
  'film_logged',
  'film_rated',
  'film_liked',
  'review_created',
]);

/**
 * The widest a single card is allowed to span. Generous enough to cover "log it
 * now, write the review after the credits", short enough that rating a film
 * again next week is its own moment.
 *
 * Measured from the group's newest event rather than from the previous one on
 * purpose: chaining event-to-event would let a slow drip of activity merge
 * across days, which is exactly the incorrect merge this has to avoid.
 */
const SESSION_WINDOW_MS = 1000 * 60 * 60 * 6;

/**
 * Collapses a chronological event stream into what a reader would call
 * "things that happened".
 *
 * Only same-actor, same-film events inside one sitting merge. Club decisions,
 * list creation and anything without a film stay distinct, and a rating added
 * weeks after the log is a genuinely separate moment — so it stays one.
 */
export function aggregateFeedItems(items: FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  const openGroups = new Map<string, FeedItem>();

  for (const item of items) {
    const mergeable =
      item.movie && item.types.every((type) => AGGREGATION_TYPES.has(type)) && item.types.length > 0;
    if (!mergeable) {
      out.push(item);
      continue;
    }

    const key = `${item.actor.id}:${item.movie!.id}`;
    const open = openGroups.get(key);

    // Items arrive newest first, so `open.createdAt` is where the group began.
    if (open && open.createdAt.getTime() - item.createdAt.getTime() <= SESSION_WINDOW_MS) {
      open.types = [...open.types, ...item.types];
      open.oldestAt = item.createdAt;
      // Whichever event carried the richest diary entry wins the card body.
      if (!open.entry || (item.entry?.reviewText && !open.entry.reviewText)) {
        open.entry = item.entry ?? open.entry;
      }
      open.metadata = { ...item.metadata, ...open.metadata };
      continue;
    }

    const group: FeedItem = { ...item, types: [...item.types] };
    openGroups.set(key, group);
    out.push(group);
  }

  return out;
}

/**
 * Chronological feed over a single append-only event table.
 *
 * One query with three left joins, keyset-paginated on createdAt. No fan-out
 * across per-type tables, and privacy is applied in SQL rather than trimmed
 * afterwards — so a private entry never leaves the database in the first place.
 * Aggregation happens after the fact, in memory, over an over-fetched window:
 * merging in SQL would mean giving up the index-only scan that makes this fast.
 */
export async function getHomeFeed(
  viewer: Viewer,
  options: { before?: Date; limit?: number; scope?: 'following' | 'everyone'; actorIds?: string[] } = {},
): Promise<FeedItem[]> {
  const limit = options.limit ?? 25;
  const scope = options.scope ?? (viewer ? 'following' : 'everyone');

  const audience = options.actorIds
    ? options.actorIds.length
      ? inArray(activityEvents.actorId, options.actorIds)
      : sql`false`
    : scope === 'following' && viewer
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
    // Over-fetch: a page of 25 cards can easily be 60 raw events once a few
    // people log properly. Capped so a quiet feed does not pay for the ceiling.
    .limit(Math.min(limit * 4, 200));

  const entryIds = rows.map((r) => r.entry?.id).filter((id): id is string => Boolean(id));
  const likedByViewer =
    viewer && entryIds.length ? await likedEntryIds(viewer.id, entryIds) : new Set<string>();

  const items = rows.map((row) => ({
    id: row.event.id,
    types: [row.event.type],
    createdAt: row.event.createdAt,
    oldestAt: row.event.createdAt,
    actor: {
      id: row.actorId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
    movie: row.movie,
    entry: toFeedEntry(row.entry, likedByViewer),
    list: row.listId
      ? { id: row.listId, title: row.listTitle!, slug: row.listSlug!, itemCount: row.listItemCount! }
      : null,
    club: row.clubId ? { id: row.clubId, name: row.clubName!, slug: row.clubSlug! } : null,
    metadata: row.event.metadata,
  }));

  return aggregateFeedItems(items).slice(0, limit);
}

function toFeedEntry(
  entry: typeof diaryEntries.$inferSelect | null,
  likedByViewer: Set<string>,
): FeedEntry | null {
  if (!entry) return null;
  return {
    id: entry.id,
    rating: entry.rating,
    liked: entry.liked,
    reviewText: entry.reviewText,
    containsSpoilers: entry.containsSpoilers,
    watchedDate: entry.watchedDate,
    isRewatch: entry.isRewatch,
    likeCount: entry.likeCount,
    commentCount: entry.commentCount,
    likedByViewer: likedByViewer.has(entry.id),
  };
}

async function likedEntryIds(viewerId: string, entryIds: string[]): Promise<Set<string>> {
  const rows = await db
    .select({ id: reviewLikes.diaryEntryId })
    .from(reviewLikes)
    .where(and(eq(reviewLikes.userId, viewerId), inArray(reviewLikes.diaryEntryId, entryIds)));
  return new Set(rows.map((r) => r.id));
}

export async function getUserActivity(
  userId: string,
  viewer: Viewer,
  limit = 12,
): Promise<FeedItem[]> {
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
    .limit(Math.min(limit * 4, 120));

  const items = rows.map((row) => ({
    id: row.event.id,
    types: [row.event.type],
    createdAt: row.event.createdAt,
    oldestAt: row.event.createdAt,
    actor: {
      id: userId,
      username: row.username,
      displayName: row.displayName,
      avatarAssetId: row.avatarAssetId,
    },
    movie: row.movie,
    entry: toFeedEntry(row.entry, new Set<string>()),
    list: null,
    club: null,
    metadata: row.event.metadata,
  }));

  return aggregateFeedItems(items).slice(0, limit);
}
