import 'server-only';

import { and, asc, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';

import { slugify } from '@/lib/utils';
import { invitationIsExpired, isCompleteReorder, planListTransfer } from '@/lib/list-curation';
import { db, type DbOrTx } from '@/server/db';
import {
  activityEvents,
  clubMembers,
  clubQueueItems,
  comments,
  listActivity,
  listCollaborationInvitations,
  listCollaborators,
  listItems,
  listLikes,
  lists,
  movies,
  savedLists,
  users,
  type List,
} from '@/server/db/schema';
import { ConflictError, NotFoundError, PermissionError, ValidationError } from '@/server/errors';
import { notBlockedSql, viewableSql, type Viewer } from '@/server/privacy';
import { assertCanInteractWith } from '@/server/privacy';
import { notify } from '@/server/services/notifications';

export type ListDetail = {
  list: List;
  owner: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  items: {
    id: string;
    position: number;
    note: string | null;
    addedBy: { id: string; username: string; displayName: string } | null;
    movie: typeof movies.$inferSelect;
  }[];
  likedByViewer: boolean;
  savedByViewer: boolean;
  canEdit: boolean;
  isOwner: boolean;
  collaborators: Array<{ id: string; username: string; displayName: string }>;
  activity: Array<{
    id: string;
    action: typeof listActivity.$inferSelect.action;
    createdAt: Date;
    actor: { id: string; username: string; displayName: string };
    movieId: string | null;
    metadata: Record<string, unknown>;
  }>;
  clonedFrom: { id: string; title: string } | null;
};

export type ListRole = 'owner' | 'editor' | null;

export async function getListRole(listId: string, userId: string | null, tx: DbOrTx = db): Promise<{ list: List; role: ListRole }> {
  const [list] = await tx.select().from(lists).where(and(eq(lists.id, listId), isNull(lists.deletedAt))).limit(1);
  if (!list) throw new NotFoundError('That list no longer exists.');
  if (!userId) return { list, role: null };
  if (list.userId === userId) return { list, role: 'owner' };
  const [collaborator] = await tx
    .select({ userId: listCollaborators.userId })
    .from(listCollaborators)
    .where(and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, userId),
      eq(listCollaborators.canEdit, true),
      sql`not exists (
        select 1 from nitrate.blocks b
        where (b.blocker_id = ${list.userId} and b.blocked_id = ${userId})
           or (b.blocker_id = ${userId} and b.blocked_id = ${list.userId})
      )`,
    ))
    .limit(1);
  return { list, role: collaborator && list.allowCollaborators ? 'editor' : null };
}

export async function requireListRole(
  listId: string,
  userId: string,
  required: 'owner' | 'editor',
  tx: DbOrTx = db,
): Promise<{ list: List; role: Exclude<ListRole, null> }> {
  const access = await getListRole(listId, userId, tx);
  const allowed = access.role === 'owner' || (required === 'editor' && access.role === 'editor');
  if (!allowed) throw new PermissionError(required === 'owner' ? 'Only the list owner can do that.' : 'You cannot edit this list.');
  return access as { list: List; role: Exclude<ListRole, null> };
}

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
        viewer
          ? or(
              viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
              and(
                notBlockedSql(sql`${lists.userId}`, viewer.id),
                sql`exists (
                  select 1 from ${listCollaborators} lc
                  where lc.list_id = ${lists.id} and lc.user_id = ${viewer.id} and lc.can_edit
                )`,
              ),
            )
          : viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, viewer),
      ),
    )
    .limit(1);
  if (!visible) throw new PermissionError('This list is private.');

  const items = await db
    .select({
      item: listItems,
      movie: movies,
      addedById: users.id,
      addedByUsername: users.username,
      addedByName: users.displayName,
    })
    .from(listItems)
    .innerJoin(movies, eq(movies.id, listItems.movieId))
    .leftJoin(users, eq(users.id, listItems.addedByUserId))
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
  const savedByViewer = viewer
    ? (
        await db.select({ id: savedLists.listId }).from(savedLists).where(and(
          eq(savedLists.userId, viewer.id),
          eq(savedLists.listId, listId),
        )).limit(1)
      ).length > 0
    : false;

  const role = viewer ? (await getListRole(listId, viewer.id)).role : null;
  const [collaboratorRows, activityRows, cloneSourceRows] = await Promise.all([
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(listCollaborators)
      .innerJoin(users, eq(users.id, listCollaborators.userId))
      .where(eq(listCollaborators.listId, listId))
      .orderBy(asc(listCollaborators.createdAt)),
    db
      .select({
        activity: listActivity,
        actorId: users.id,
        actorUsername: users.username,
        actorName: users.displayName,
      })
      .from(listActivity)
      .innerJoin(users, eq(users.id, listActivity.actorUserId))
      .where(eq(listActivity.listId, listId))
      .orderBy(desc(listActivity.createdAt))
      .limit(40),
    row.list.clonedFromListId
      ? db.select({ id: lists.id, title: lists.title, visibility: lists.visibility, ownerId: lists.userId }).from(lists).where(and(
          eq(lists.id, row.list.clonedFromListId),
          isNull(lists.deletedAt),
        )).limit(1)
      : Promise.resolve([]),
  ]);
  const cloneSource = cloneSourceRows[0];
  const visibleCloneSource = cloneSource && (cloneSource.visibility === 'public' || cloneSource.ownerId === viewer?.id)
    ? { id: cloneSource.id, title: cloneSource.title }
    : null;

  return {
    list: row.list,
    owner: {
      id: row.owner.id,
      username: row.owner.username,
      displayName: row.owner.displayName,
      avatarAssetId: row.owner.avatarAssetId,
    },
    items: items.map(({ item, movie, addedById, addedByUsername, addedByName }) => ({
      id: item.id,
      position: item.position,
      note: item.note,
      addedBy: addedById ? { id: addedById, username: addedByUsername!, displayName: addedByName! } : null,
      movie,
    })),
    likedByViewer,
    savedByViewer,
    canEdit: role === 'owner' || role === 'editor',
    isOwner: role === 'owner',
    collaborators: collaboratorRows,
    activity: activityRows.map((row) => ({
      id: row.activity.id,
      action: row.activity.action,
      createdAt: row.activity.createdAt,
      actor: { id: row.actorId, username: row.actorUsername, displayName: row.actorName },
      movieId: row.activity.movieId,
      metadata: row.activity.metadata,
    })),
    clonedFrom: visibleCloneSource,
  };
}

export async function createList(input: {
  userId: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'followers' | 'private';
  isRanked: boolean;
  movieIds: string[];
  clonedFromListId?: string | null;
}): Promise<List> {
  const title = input.title.trim();
  if (!title) throw new ValidationError('Give the list a title.', { title: 'Required.' });
  const movieIds = [...new Set(input.movieIds)];

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
        itemCount: movieIds.length,
        clonedFromListId: input.clonedFromListId ?? null,
      })
      .returning();

    if (movieIds.length) {
      await tx.insert(listItems).values(
        movieIds.map((movieId, index) => ({
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

export async function updateList(
  listId: string,
  userId: string,
  patch: {
    title?: string;
    description?: string | null;
    visibility?: 'public' | 'followers' | 'private';
    isRanked?: boolean;
    allowCollaborators?: boolean;
    isPinned?: boolean;
  },
): Promise<List> {
  return db.transaction(async (tx) => {
    await requireListRole(listId, userId, 'owner', tx);
    const [updated] = await tx
      .update(lists)
      .set({ ...patch, version: sql`${lists.version} + 1`, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();
    await tx.insert(listActivity).values({ listId, actorUserId: userId, action: 'list_updated', metadata: { fields: Object.keys(patch) } });
    return updated;
  });
}

export async function deleteList(listId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireListRole(listId, userId, 'owner', tx);
    await tx.update(lists).set({ deletedAt: new Date() }).where(eq(lists.id, listId));
    await tx.delete(activityEvents).where(eq(activityEvents.listId, listId));
  });
}

export async function addListItem(
  listId: string,
  userId: string,
  movieId: string,
  note: string | null,
): Promise<{ added: boolean; version: number }> {
  return db.transaction(async (tx) => {
    const { list } = await requireListRole(listId, userId, 'editor', tx);
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
      const [updated] = await tx
        .update(lists)
        .set({ itemCount: sql`${lists.itemCount} + 1`, version: sql`${lists.version} + 1`, updatedAt: new Date() })
        .where(eq(lists.id, listId))
        .returning({ version: lists.version });
      await tx.insert(listActivity).values({
        listId,
        actorUserId: userId,
        action: 'item_added',
        listItemId: inserted[0].id,
        movieId,
      });
      return { added: true, version: updated.version };
    }
    return { added: false, version: list.version };
  });
}

export async function removeListItem(listId: string, userId: string, itemId: string): Promise<{ removed: boolean; version: number }> {
  return db.transaction(async (tx) => {
    const { list } = await requireListRole(listId, userId, 'editor', tx);
    const deleted = await tx
      .delete(listItems)
      .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)))
      .returning({ id: listItems.id, movieId: listItems.movieId });
    if (!deleted.length) return { removed: false, version: list.version };

    const [updated] = await tx
      .update(lists)
      .set({ itemCount: sql`greatest(${lists.itemCount} - 1, 0)`, version: sql`${lists.version} + 1`, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning({ version: lists.version });
    await renumber(tx, listId);
    await tx.insert(listActivity).values({
      listId,
      actorUserId: userId,
      action: 'item_removed',
      movieId: deleted[0].movieId,
    });
    return { removed: true, version: updated.version };
  });
}

export async function updateListItemNote(
  listId: string,
  userId: string,
  itemId: string,
  note: string | null,
): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    await requireListRole(listId, userId, 'editor', tx);
    const [item] = await tx
      .update(listItems)
      .set({ note })
      .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)))
      .returning({ id: listItems.id, movieId: listItems.movieId });
    if (!item) throw new NotFoundError('That list item no longer exists.');
    const [updated] = await tx
      .update(lists)
      .set({ version: sql`${lists.version} + 1`, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning({ version: lists.version });
    await tx.insert(listActivity).values({
      listId,
      actorUserId: userId,
      action: 'note_updated',
      listItemId: item.id,
      movieId: item.movieId,
    });
    return { version: updated.version };
  });
}

/** Persists a full reorder. Positions are rewritten so they stay 1..n dense. */
export async function reorderList(
  listId: string,
  userId: string,
  itemIds: string[],
  expectedVersion: number,
): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    const { list } = await requireListRole(listId, userId, 'editor', tx);
    if (list.version !== expectedVersion) throw new ConflictError('This list changed in another tab. Refresh before reordering.');
    const existing = await tx
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    const currentIds = existing.map((row) => row.id);
    if (!isCompleteReorder(currentIds, itemIds)) {
      throw new ValidationError('The reorder must include every current list item exactly once.');
    }

    let position = 0;
    for (const itemId of itemIds) {
      position += 1;
      await tx
        .update(listItems)
        .set({ position })
        .where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)));
    }
    const [updated] = await tx
      .update(lists)
      .set({ version: sql`${lists.version} + 1`, updatedAt: new Date() })
      .where(and(eq(lists.id, listId), eq(lists.version, expectedVersion)))
      .returning({ version: lists.version });
    if (!updated) throw new ConflictError('This list changed in another tab. Refresh before reordering.');
    await tx.insert(listActivity).values({
      listId,
      actorUserId: userId,
      action: 'reordered',
      metadata: { itemCount: itemIds.length, fromVersion: expectedVersion },
    });
    return { version: updated.version };
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

/* -------------------------------------------------------------------------- */
/* Collaboration                                                              */
/* -------------------------------------------------------------------------- */

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function inviteListCollaborator(
  listId: string,
  ownerUserId: string,
  username: string,
) {
  const { list } = await requireListRole(listId, ownerUserId, 'owner');
  const [invitee] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(sql`lower(${users.username}) = ${username.trim().toLowerCase()}`, isNull(users.deletedAt), isNull(users.suspendedAt)))
    .limit(1);
  if (!invitee) throw new NotFoundError('No active member has that username.');
  if (invitee.id === ownerUserId) throw new ValidationError('The owner already controls this list.');
  await assertCanInteractWith(ownerUserId, invitee.id);

  const invitation = await db.transaction(async (tx) => {
    const [existingEditor] = await tx.select({ id: listCollaborators.userId }).from(listCollaborators).where(and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, invitee.id),
    )).limit(1);
    if (existingEditor) throw new ConflictError('That person is already an editor.');

    await tx.update(listCollaborationInvitations).set({ status: 'expired', respondedAt: new Date() }).where(and(
      eq(listCollaborationInvitations.listId, listId),
      eq(listCollaborationInvitations.inviteeUserId, invitee.id),
      eq(listCollaborationInvitations.status, 'pending'),
      sql`${listCollaborationInvitations.expiresAt} <= now()`,
    ));
    const [pending] = await tx.select({ id: listCollaborationInvitations.id }).from(listCollaborationInvitations).where(and(
      eq(listCollaborationInvitations.listId, listId),
      eq(listCollaborationInvitations.inviteeUserId, invitee.id),
      eq(listCollaborationInvitations.status, 'pending'),
      gt(listCollaborationInvitations.expiresAt, new Date()),
    )).limit(1);
    if (pending) throw new ConflictError('That invitation is still waiting for a response.');
    const [created] = await tx.insert(listCollaborationInvitations).values({
      listId,
      inviterUserId: ownerUserId,
      inviteeUserId: invitee.id,
      role: 'editor',
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    }).returning();
    await tx.update(lists).set({ allowCollaborators: true, updatedAt: new Date() }).where(eq(lists.id, listId));
    return created;
  });

  await notify({
    userId: invitee.id,
    actorId: ownerUserId,
    type: 'list_collaboration_invite',
    url: '/lists/collaboration',
    body: `You were invited to edit “${list.title}”`,
    subjectType: 'list',
    subjectId: listId,
    dedupeKey: `list-collaboration:${invitation.id}`,
  });
  return { invitation, invitee };
}

export async function respondToListInvitation(
  invitationId: string,
  userId: string,
  response: 'accept' | 'decline',
): Promise<void> {
  const [row] = await db
    .select({ invitation: listCollaborationInvitations, ownerId: lists.userId })
    .from(listCollaborationInvitations)
    .innerJoin(lists, eq(lists.id, listCollaborationInvitations.listId))
    .where(eq(listCollaborationInvitations.id, invitationId))
    .limit(1);
  if (!row || row.invitation.inviteeUserId !== userId) throw new NotFoundError('That invitation is unavailable.');
  await assertCanInteractWith(userId, row.ownerId);
  if (row.invitation.status !== 'pending') throw new ConflictError('That invitation has already been handled.');
  if (invitationIsExpired(row.invitation.expiresAt)) {
    await db.update(listCollaborationInvitations).set({ status: 'expired', respondedAt: new Date() }).where(and(
      eq(listCollaborationInvitations.id, invitationId),
      eq(listCollaborationInvitations.status, 'pending'),
    ));
    throw new ConflictError('That invitation has expired. Ask the owner to send another.');
  }

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(listCollaborationInvitations).where(eq(listCollaborationInvitations.id, invitationId)).limit(1);
    if (!current || current.inviteeUserId !== userId || current.status !== 'pending') {
      throw new ConflictError('That invitation has already been handled.');
    }
    const status = response === 'accept' ? 'accepted' : 'declined';
    await tx.update(listCollaborationInvitations).set({ status, respondedAt: new Date() }).where(eq(listCollaborationInvitations.id, invitationId));
    if (response === 'accept') {
      await tx.insert(listCollaborators).values({ listId: current.listId, userId, canEdit: true }).onConflictDoUpdate({
        target: [listCollaborators.listId, listCollaborators.userId],
        set: { canEdit: true },
      });
      await tx.insert(listActivity).values({ listId: current.listId, actorUserId: userId, action: 'collaborator_added' });
    }
  });
}

export async function revokeListInvitation(invitationId: string, ownerUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(listCollaborationInvitations).where(eq(listCollaborationInvitations.id, invitationId)).limit(1);
    if (!invite) throw new NotFoundError('That invitation no longer exists.');
    await requireListRole(invite.listId, ownerUserId, 'owner', tx);
    if (invite.status !== 'pending') throw new ConflictError('That invitation has already been handled.');
    await tx.update(listCollaborationInvitations).set({ status: 'revoked', revokedAt: new Date(), respondedAt: new Date() }).where(eq(listCollaborationInvitations.id, invitationId));
  });
}

export async function removeListCollaborator(listId: string, ownerUserId: string, collaboratorUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireListRole(listId, ownerUserId, 'owner', tx);
    const removed = await tx.delete(listCollaborators).where(and(
      eq(listCollaborators.listId, listId),
      eq(listCollaborators.userId, collaboratorUserId),
    )).returning({ id: listCollaborators.userId });
    if (!removed.length) return;
    await tx.insert(listActivity).values({
      listId,
      actorUserId: ownerUserId,
      action: 'collaborator_removed',
      metadata: { collaboratorUserId },
    });
  });
}

export async function getListCollaborationInbox(userId: string) {
  await db.update(listCollaborationInvitations).set({ status: 'expired', respondedAt: new Date() }).where(and(
    eq(listCollaborationInvitations.inviteeUserId, userId),
    eq(listCollaborationInvitations.status, 'pending'),
    sql`${listCollaborationInvitations.expiresAt} <= now()`,
  ));
  return db
    .select({
      invitation: listCollaborationInvitations,
      list: lists,
      owner: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(listCollaborationInvitations)
    .innerJoin(lists, eq(lists.id, listCollaborationInvitations.listId))
    .innerJoin(users, eq(users.id, listCollaborationInvitations.inviterUserId))
    .where(eq(listCollaborationInvitations.inviteeUserId, userId))
    .orderBy(desc(listCollaborationInvitations.createdAt));
}

export async function getOwnerListInvitations(listId: string, ownerUserId: string) {
  await requireListRole(listId, ownerUserId, 'owner');
  await db.update(listCollaborationInvitations).set({ status: 'expired', respondedAt: new Date() }).where(and(
    eq(listCollaborationInvitations.listId, listId),
    eq(listCollaborationInvitations.status, 'pending'),
    sql`${listCollaborationInvitations.expiresAt} <= now()`,
  ));
  return db
    .select({
      invitation: listCollaborationInvitations,
      invitee: { id: users.id, username: users.username, displayName: users.displayName },
    })
    .from(listCollaborationInvitations)
    .innerJoin(users, eq(users.id, listCollaborationInvitations.inviteeUserId))
    .where(eq(listCollaborationInvitations.listId, listId))
    .orderBy(desc(listCollaborationInvitations.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Personal library, cloning and Movie Ideas transfer                         */
/* -------------------------------------------------------------------------- */

export async function toggleSavedList(listId: string, userId: string): Promise<boolean> {
  const detail = await getListDetail(listId, { id: userId, role: 'member' });
  if (detail.list.userId === userId) throw new ValidationError('Your own lists are already in your library.');
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: savedLists.listId }).from(savedLists).where(and(
      eq(savedLists.userId, userId),
      eq(savedLists.listId, listId),
    )).limit(1);
    if (existing) {
      await tx.delete(savedLists).where(and(eq(savedLists.userId, userId), eq(savedLists.listId, listId)));
      return false;
    }
    await tx.insert(savedLists).values({ userId, listId });
    return true;
  });
}

export async function setListPinned(listId: string, userId: string, pinned: boolean, kind: 'owned' | 'saved'): Promise<void> {
  if (kind === 'owned') {
    await requireListRole(listId, userId, 'owner');
    await db.update(lists).set({ isPinned: pinned, updatedAt: new Date() }).where(eq(lists.id, listId));
    return;
  }
  const updated = await db.update(savedLists).set({ isPinned: pinned }).where(and(
    eq(savedLists.userId, userId),
    eq(savedLists.listId, listId),
  )).returning({ id: savedLists.listId });
  if (!updated.length) throw new NotFoundError('Save this list before pinning it.');
}

export async function cloneList(listId: string, userId: string): Promise<List> {
  const detail = await getListDetail(listId, { id: userId, role: 'member' });
  const clone = await createList({
    userId,
    title: `Copy of ${detail.list.title}`.slice(0, 120),
    description: detail.list.description,
    visibility: 'private',
    isRanked: detail.list.isRanked,
    movieIds: detail.items.map((item) => item.movie.id),
    clonedFromListId: detail.list.id,
  });
  await db.insert(listActivity).values({
    listId: clone.id,
    actorUserId: userId,
    action: 'cloned',
    metadata: { sourceListId: detail.list.id, sourceTitle: detail.list.title },
  });
  return clone;
}

export async function transferListItemsToMovieIdeas(input: {
  listId: string;
  clubId: string;
  userId: string;
  movieIds: string[];
}): Promise<{ added: number; skipped: number }> {
  const ids = [...new Set(input.movieIds)];
  if (!ids.length) throw new ValidationError('Select at least one film.');
  if (ids.length > 25) throw new ValidationError('Transfer up to 25 films at a time.');
  await getListDetail(input.listId, { id: input.userId, role: 'member' });
  return db.transaction(async (tx) => {
    const [membership] = await tx.select({ id: clubMembers.userId }).from(clubMembers).where(and(
      eq(clubMembers.clubId, input.clubId),
      eq(clubMembers.userId, input.userId),
      eq(clubMembers.status, 'active'),
    )).limit(1);
    if (!membership) throw new PermissionError('Join that club before adding Movie Ideas.');
    const validRows = await tx.select({ movieId: listItems.movieId }).from(listItems).where(and(
      eq(listItems.listId, input.listId),
      inArray(listItems.movieId, ids),
    ));
    if (validRows.length !== ids.length) throw new ValidationError('Every selected film must still belong to this list.');
    const existing = await tx.select({ movieId: clubQueueItems.movieId }).from(clubQueueItems).where(and(
      eq(clubQueueItems.clubId, input.clubId),
      inArray(clubQueueItems.movieId, ids),
    ));
    const plan = planListTransfer(ids, existing.map((row) => row.movieId));
    const additions = plan.additions;
    if (additions.length) {
      await tx.insert(clubQueueItems).values(additions.map((movieId) => ({
        clubId: input.clubId,
        movieId,
        addedByUserId: input.userId,
        note: 'Transferred from a curated list',
      })));
    }
    await tx.insert(listActivity).values({
      listId: input.listId,
      actorUserId: input.userId,
      action: 'bulk_transferred',
      metadata: { clubId: input.clubId, selected: plan.selected.length, added: additions.length, skipped: plan.skipped },
    });
    return { added: additions.length, skipped: plan.skipped };
  });
}

export type ListLibraryView = 'mine' | 'saved' | 'liked';
export type ListLibrarySort = 'updated' | 'title' | 'popular';

export async function getListLibrary(
  userId: string,
  options: { view?: ListLibraryView; q?: string; sort?: ListLibrarySort; limit?: number } = {},
) {
  const view = options.view ?? 'mine';
  const query = options.q?.trim();
  const order = options.sort === 'title'
    ? [asc(lists.title)]
    : options.sort === 'popular'
      ? [desc(lists.likeCount), desc(lists.itemCount)]
      : [desc(view === 'saved' ? savedLists.isPinned : lists.isPinned), desc(lists.updatedAt)];
  const select = { list: lists, owner: { username: users.username, displayName: users.displayName } };
  const rows = view === 'saved'
    ? await db.select(select).from(savedLists).innerJoin(lists, eq(lists.id, savedLists.listId)).innerJoin(users, eq(users.id, lists.userId)).where(and(
        eq(savedLists.userId, userId),
        isNull(lists.deletedAt),
        viewableSql(sql`${lists.visibility}`, sql`${lists.userId}`, { id: userId, role: 'member' }),
        query ? or(ilike(lists.title, `%${query}%`), ilike(lists.description, `%${query}%`)) : undefined,
      )).orderBy(...order).limit(options.limit ?? 80)
    : view === 'liked'
      ? await db.select(select).from(listLikes).innerJoin(lists, eq(lists.id, listLikes.listId)).innerJoin(users, eq(users.id, lists.userId)).where(and(
          eq(listLikes.userId, userId),
          eq(lists.visibility, 'public'),
          isNull(lists.deletedAt),
          query ? or(ilike(lists.title, `%${query}%`), ilike(lists.description, `%${query}%`)) : undefined,
        )).orderBy(...order).limit(options.limit ?? 80)
      : await db.select(select).from(lists).innerJoin(users, eq(users.id, lists.userId)).where(and(
          eq(lists.userId, userId),
          isNull(lists.deletedAt),
          query ? or(ilike(lists.title, `%${query}%`), ilike(lists.description, `%${query}%`)) : undefined,
        )).orderBy(...order).limit(options.limit ?? 80);

  if (!rows.length) return [];
  const rowIds = rows.map((row) => row.list.id);
  const [coverRows, savedPinRows] = await Promise.all([
    db.select({ listId: listItems.listId, posterPath: movies.posterPath }).from(listItems).innerJoin(movies, eq(movies.id, listItems.movieId)).where(inArray(listItems.listId, rowIds)).orderBy(asc(listItems.position)),
    view === 'saved'
      ? db.select({ listId: savedLists.listId, isPinned: savedLists.isPinned }).from(savedLists).where(and(eq(savedLists.userId, userId), inArray(savedLists.listId, rowIds)))
      : Promise.resolve([]),
  ]);
  const savedPins = new Map(savedPinRows.map((row) => [row.listId, row.isPinned]));
  const covers = new Map<string, string[]>();
  coverRows.forEach((row) => {
    if (!row.posterPath) return;
    const current = covers.get(row.listId) ?? [];
    if (current.length < 5) current.push(row.posterPath);
    covers.set(row.listId, current);
  });
  return rows.map((row) => ({
    ...row.list,
    owner: row.owner,
    covers: covers.get(row.list.id) ?? [],
    libraryPinned: view === 'saved' ? (savedPins.get(row.list.id) ?? false) : view === 'mine' ? row.list.isPinned : false,
  }));
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
