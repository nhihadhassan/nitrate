'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { actionGuard, type ActionResult } from '@/server/errors';
import { ensureMovieByProviderId, getMovieById } from '@/server/movies/catalog';
import { consumeRateLimit } from '@/server/rate-limit';
import {
  addListItem,
  cloneList,
  createList,
  deleteList,
  inviteListCollaborator,
  removeListCollaborator,
  removeListItem,
  reorderList,
  respondToListInvitation,
  revokeListInvitation,
  setListPinned,
  toggleSavedList,
  transferListItemsToMovieIdeas,
  updateList,
  updateListItemNote,
} from '@/server/services/lists';

const visibilityEnum = z.enum(['public', 'followers', 'private']);

const createSchema = z.object({
  title: z.string().trim().min(1, 'Give the list a title.').max(120),
  description: z.string().trim().max(2000).nullable(),
  visibility: visibilityEnum,
  isRanked: z.boolean(),
  films: z.array(z.object({ movieId: z.string().uuid().optional(), providerId: z.string().optional() })).max(500),
});

export async function createListAction(input: z.infer<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = createSchema.parse(input);
    const movieIds: string[] = [];
    for (const film of parsed.films) {
      const movie = film.movieId ? await getMovieById(film.movieId) : await ensureMovieByProviderId(film.providerId!);
      movieIds.push(movie.id);
    }
    const list = await createList({
      userId: user.id,
      title: parsed.title,
      description: parsed.description,
      visibility: parsed.visibility,
      isRanked: parsed.isRanked,
      movieIds,
    });
    await track('list_created', user.id, { listId: list.id, itemCount: movieIds.length });
    revalidatePath(`/@${user.username}/lists`);
    revalidatePath('/lists');
    return { id: list.id };
  });
}

export async function updateListAction(input: {
  listId: string;
  title?: string;
  description?: string | null;
  visibility?: 'public' | 'followers' | 'private';
  isRanked?: boolean;
  allowCollaborators?: boolean;
  isPinned?: boolean;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const schema = z.object({
      listId: z.string().uuid(),
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      visibility: visibilityEnum.optional(),
      isRanked: z.boolean().optional(),
      allowCollaborators: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    });
    const { listId, ...patch } = schema.parse(input);
    await updateList(listId, user.id, patch);
    revalidatePath(`/list/${listId}`);
    revalidatePath('/lists');
    return null;
  });
}

export async function deleteListAction(listId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await deleteList(z.string().uuid().parse(listId), user.id);
    revalidatePath(`/@${user.username}/lists`);
    revalidatePath('/lists');
    return null;
  });
}

export async function addListItemAction(input: {
  listId: string;
  movieId?: string;
  providerId?: string;
  note?: string | null;
}): Promise<ActionResult<{ added: boolean; version: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const movie = input.movieId ? await getMovieById(input.movieId) : await ensureMovieByProviderId(input.providerId!);
    const result = await addListItem(input.listId, user.id, movie.id, input.note?.trim() || null);
    revalidatePath(`/list/${input.listId}`);
    return result;
  });
}

export async function removeListItemAction(listId: string, itemId: string): Promise<ActionResult<{ removed: boolean; version: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const result = await removeListItem(z.string().uuid().parse(listId), user.id, z.string().uuid().parse(itemId));
    revalidatePath(`/list/${listId}`);
    return result;
  });
}

export async function updateListItemNoteAction(input: {
  listId: string;
  itemId: string;
  note: string | null;
}): Promise<ActionResult<{ version: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z.object({ listId: z.string().uuid(), itemId: z.string().uuid(), note: z.string().trim().max(500).nullable() }).parse(input);
    const result = await updateListItemNote(parsed.listId, user.id, parsed.itemId, parsed.note || null);
    revalidatePath(`/list/${parsed.listId}`);
    return result;
  });
}

export async function reorderListAction(
  listId: string,
  itemIds: string[],
  expectedVersion: number,
): Promise<ActionResult<{ version: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const result = await reorderList(
      z.string().uuid().parse(listId),
      user.id,
      z.array(z.string().uuid()).max(500).parse(itemIds),
      z.number().int().positive().parse(expectedVersion),
    );
    revalidatePath(`/list/${listId}`);
    return result;
  });
}

export async function inviteListCollaboratorAction(input: { listId: string; username: string }): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z.object({ listId: z.string().uuid(), username: z.string().trim().min(1).max(40) }).parse(input);
    await consumeRateLimit('invite', user.id);
    await inviteListCollaborator(parsed.listId, user.id, parsed.username);
    revalidatePath(`/list/${parsed.listId}`);
    revalidatePath('/lists/collaboration');
    return null;
  });
}

export async function respondToListInvitationAction(invitationId: string, response: 'accept' | 'decline'): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await respondToListInvitation(z.string().uuid().parse(invitationId), user.id, z.enum(['accept', 'decline']).parse(response));
    revalidatePath('/lists/collaboration');
    revalidatePath('/lists');
    return null;
  });
}

export async function revokeListInvitationAction(invitationId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await revokeListInvitation(z.string().uuid().parse(invitationId), user.id);
    revalidatePath('/lists/collaboration');
    return null;
  });
}

export async function removeListCollaboratorAction(listId: string, collaboratorUserId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await removeListCollaborator(z.string().uuid().parse(listId), user.id, z.string().uuid().parse(collaboratorUserId));
    revalidatePath(`/list/${listId}`);
    return null;
  });
}

export async function toggleSavedListAction(listId: string): Promise<ActionResult<{ saved: boolean }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const id = z.string().uuid().parse(listId);
    const saved = await toggleSavedList(id, user.id);
    revalidatePath(`/list/${id}`);
    revalidatePath('/lists');
    return { saved };
  });
}

export async function setListPinnedAction(input: { listId: string; pinned: boolean; kind: 'owned' | 'saved' }): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z.object({ listId: z.string().uuid(), pinned: z.boolean(), kind: z.enum(['owned', 'saved']) }).parse(input);
    await setListPinned(parsed.listId, user.id, parsed.pinned, parsed.kind);
    revalidatePath('/lists');
    revalidatePath(`/list/${parsed.listId}`);
    return null;
  });
}

export async function cloneListAction(listId: string): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const clone = await cloneList(z.string().uuid().parse(listId), user.id);
    revalidatePath('/lists');
    return { id: clone.id };
  });
}

export async function transferListToMovieIdeasAction(input: {
  listId: string;
  clubId: string;
  movieIds: string[];
}): Promise<ActionResult<{ added: number; skipped: number }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z.object({ listId: z.string().uuid(), clubId: z.string().uuid(), movieIds: z.array(z.string().uuid()).min(1).max(25) }).parse(input);
    const result = await transferListItemsToMovieIdeas({ ...parsed, userId: user.id });
    revalidatePath(`/list/${parsed.listId}`);
    return result;
  });
}
