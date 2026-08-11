'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { track } from '@/server/analytics';
import { requireUser } from '@/server/auth/session';
import { actionGuard, type ActionResult } from '@/server/errors';
import { ensureMovieByProviderId, getMovieById } from '@/server/movies/catalog';
import {
  addListItem,
  createList,
  deleteList,
  removeListItem,
  reorderList,
  updateList,
} from '@/server/services/lists';

const visibilityEnum = z.enum(['public', 'followers', 'private']);

const createSchema = z.object({
  title: z.string().trim().min(1, 'Give the list a title.').max(120),
  description: z.string().trim().max(2000).nullable(),
  visibility: visibilityEnum,
  isRanked: z.boolean(),
  films: z
    .array(z.object({ movieId: z.string().uuid().optional(), providerId: z.string().optional() }))
    .max(500),
});

export async function createListAction(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = createSchema.parse(input);

    // Resolve every film to a canonical local record before the list exists, so
    // a half-imported list can never be created.
    const movieIds: string[] = [];
    for (const film of parsed.films) {
      const movie = film.movieId
        ? await getMovieById(film.movieId)
        : await ensureMovieByProviderId(film.providerId!);
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
    return { id: list.id };
  });
}

export async function updateListAction(input: {
  listId: string;
  title?: string;
  description?: string | null;
  visibility?: 'public' | 'followers' | 'private';
  isRanked?: boolean;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const schema = z.object({
      listId: z.string().uuid(),
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      visibility: visibilityEnum.optional(),
      isRanked: z.boolean().optional(),
    });
    const { listId, ...patch } = schema.parse(input);
    await updateList(listId, user.id, patch);
    revalidatePath(`/list/${listId}`);
    return null;
  });
}

export async function deleteListAction(listId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await deleteList(listId, user.id);
    revalidatePath(`/@${user.username}/lists`);
    return null;
  });
}

export async function addListItemAction(input: {
  listId: string;
  movieId?: string;
  providerId?: string;
  note?: string | null;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const movie = input.movieId
      ? await getMovieById(input.movieId)
      : await ensureMovieByProviderId(input.providerId!);
    await addListItem(input.listId, user.id, movie.id, input.note?.trim() || null);
    revalidatePath(`/list/${input.listId}`);
    return null;
  });
}

export async function removeListItemAction(
  listId: string,
  itemId: string,
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await removeListItem(listId, user.id, itemId);
    revalidatePath(`/list/${listId}`);
    return null;
  });
}

export async function reorderListAction(
  listId: string,
  itemIds: string[],
): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await reorderList(listId, user.id, itemIds);
    revalidatePath(`/list/${listId}`);
    return null;
  });
}
