import 'server-only';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { slugify } from '@/lib/utils';
import { db } from '@/server/db';
import {
  activityEvents,
  comments,
  listItems,
  listLikes,
  lists,
  movies,
  users,
  type List,
} from '@/server/db/schema';
import { NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { viewableSql, type Viewer } from '@/server/privacy';

export type ListDetail = {
  list: List;
  owner: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  items: {
    id: string;
    position: number;
    note: string | null;
    movie: typeof movies.$inferSelect;
  }[];
  likedByViewer: boolean;
  canEdit: boolean;
};

export async function getListDetail(listId: string, viewer: Viewer): Promise<ListDetail> {
  const [row] = await db
    .select({ list: lists, owner: users })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.userId))
    .where(and(eq(lists.id, listId), isNull(lists.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError('That list no longer exists.');

  // Re-run the visibility predicate as a guarded query rather than trusting the
  // fetch above; a direct id hit must respect privacy exactly like a listing.
  const [visible] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(
      and(
        eq(lists.id, listId),
        viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
      ),
    )
    .limit(1);
  if (!visible) throw new PermissionError('This list is private.');

  const items = await db
    .select({ item: listItems, movie: movies })
    .from(listItems)
    .innerJoin(movies, eq(movies.id, listItems.movieId))
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));

  const likedByViewer = viewer
    ? (
        await db
          .select({ userId: listLikes.userId })
          .from(listLikes)
          .where(and(eq(listLikes.listId, listId), eq(listLikes.userId, viewer.id)))
          .limit(1)
      ).length > 0
    : false;

  return {
    list: row.list,
    owner: {
      id: row.owner.id,
      username: row.owner.username,
      displayName: row.owner.displayName,
      avatarAssetId: row.owner.avatarAssetId,
    },
    items: items.map(({ item, movie }) => ({
      id: item.id,
      position: item.position,
      note: item.note,
      movie,
    })),
    likedByViewer,
    canEdit: viewer?.id === row.list.userId,
  };
}

export async function createList(input: {
  userId: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'followers' | 'private';
  isRanked: boolean;
  movieIds: string[];
}): Promise<List> {
  const title = input.title.trim();
  if (!title) throw new ValidationError('Give the list a title.', { title: 'Required.' });

  return db.transaction(async (tx) => {
    const slug = await uniqueSlug(input.userId, title, tx);
    const [list] = await tx
      .insert(lists)
      .values({
        userId: input.userId,
        title,
        slug,
        description: input.description,
        visibility: input.visibility,
        isRanked: input.isRanked,
        itemCount: input.movieIds.length,
      })
      .returning();

    if (input.movieIds.length) {
      await tx.insert(listItems).values(
        input.movieIds.map((movieId, index) => ({
          listId: list.id,
          movieId,
          position: index + 1,
          addedByUserId: input.userId,
        })),
      );
    }

    if (input.visibility !== 'private') {
      await tx.insert(activityEvents).values({
        actorId: input.userId,
        type: 'list_created',
        listId: list.id,
        visibility: input.visibility,
        metadata: { title: list.title },
      });
    }

    return list;
  });
}

async function uniqueSlug(
  userId: string,
  title: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const base = slugify(title, 50);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [existing] = await tx
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.userId, userId), eq(lists.slug, candidate)))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function requireOwnedList(listId: string, userId: string): Promise<List> {
  const [list] = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
  if (!list || list.deletedAt) throw new NotFoundError('That list no longer exists.');
  if (list.userId !== userId) throw new PermissionError('That is not your list.');
  return list;
}

export async function updateList(
  listId: string,
  userId: string,
  patch: {
    title?: string;
    description?: string | null;
    visibility?: 'public' | 'followers' | 'private';
    isRanked?: boolean;
  },
): Promise<List> {
  await requireOwnedList(listId, userId);
  const [updated] = await db
    .update(lists)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(lists.id, listId))
    .returning();
  return updated;
}

export async function deleteList(listId: string, userId: string): Promise<void> {
  await requireOwnedList(listId, userId);
  await db.transaction(async (tx) => {
    await tx.update(lists).set({ deletedAt: new Date() }).where(eq(lists.id, listId));
    await tx.delete(activityEvents).where(eq(activityEvents.listId, listId));
  });
}

export async function addListItem(
  listId: string,
  userId: string,
  movieId: string,
  note: string | null,
): Promise<void> {
  await requireOwnedList(listId, userId);
  await db.transaction(async (tx) => {
    const [{ value: max }] = await tx
      .select({ value: sql<number>`coalesce(max(${listItems.position}), 0)::int` })
      .from(listItems)
      .where(eq(listItems.listId, listId));

    const inserted = await tx
      .insert(listItems)
      .values({ listId, movieId, position: max + 1, note, addedByUserId: userId })
      .onConflictDoNothing()
      .returning({ id: listItems.id });

    if (inserted.length) {
      await tx
        .update(lists)
        .set({ itemCount: sql`${lists.itemCount} + 1`, updatedAt: new Date() })
        .where(eq(lists.id, listId));
    }
  });
}

export async function removeListItem(listId: string, userId: string, itemId: string): Promise<void> {
  await requireOwnedList(listId, userId);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(listItems)
      .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)))
      .returning({ id: listItems.id });
    if (!deleted.length) return;

    await tx
      .update(lists)
      .set({ itemCount: sql`greatest(${lists.itemCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(lists.id, listId));
    await renumber(tx, listId);
  });
}

/** Persists a full reorder. Positions are rewritten so they stay 1..n dense. */
export async function reorderList(listId: string, userId: string, itemIds: string[]): Promise<void> {
  await requireOwnedList(listId, userId);
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    const valid = new Set(existing.map((row) => row.id));

    let position = 0;
    for (const itemId of itemIds) {
      if (!valid.has(itemId)) continue;
      position += 1;
      await tx
        .update(listItems)
        .set({ position })
        .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)));
    }
    await tx.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));
  });
}

async function renumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  listId: string,
): Promise<void> {
  await tx.execute(sql`
    with ordered as (
      select id, row_number() over (order by position, created_at) as rn
      from nitrate.list_items where list_id = ${listId}
    )
    update nitrate.list_items li set position = ordered.rn
    from ordered where ordered.id = li.id
  `);
}

export async function getPopularLists(viewer: Viewer, limit = 12) {
  const rows = await db
    .select({ list: lists, owner: users })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.userId))
    .where(
      and(
        isNull(lists.deletedAt),
        isNull(users.deletedAt),
        eq(lists.visibility, 'public'),
        sql`${lists.itemCount} > 0`,
      ),
    )
    .orderBy(desc(lists.likeCount), desc(lists.itemCount), desc(lists.updatedAt))
    .limit(limit);

  if (!rows.length) return [];

  const covers = await db
    .select({ listId: listItems.listId, posterPath: movies.posterPath, position: listItems.position })
    .from(listItems)
    .innerJoin(movies, eq(movies.id, listItems.movieId))
    .where(
      sql`${listItems.listId} in ${rows.map((r) => r.list.id)} and ${movies.posterPath} is not null`,
    )
    .orderBy(asc(listItems.position));

  const byList = new Map<string, string[]>();
  for (const cover of covers) {
    const list = byList.get(cover.listId) ?? [];
    if (list.length < 5 && cover.posterPath) list.push(cover.posterPath);
    byList.set(cover.listId, list);
  }

  return rows.map(({ list, owner }) => ({
    ...list,
    covers: byList.get(list.id) ?? [],
    owner: { username: owner.username, displayName: owner.displayName },
  }));
}

export async function getComments(subjectType: 'review' | 'list', subjectId: string) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      parentId: comments.parentId,
      containsSpoilers: comments.containsSpoilers,
      authorId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarAssetId: users.avatarAssetId,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(
      and(
        eq(comments.subjectType, subjectType),
        eq(comments.subjectId, subjectId),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt))
    .limit(200);
}
