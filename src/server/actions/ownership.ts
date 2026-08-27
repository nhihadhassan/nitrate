'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/server/auth/session';
import { actionGuard, type ActionResult } from '@/server/errors';
import { addOwnershipCopy, removeOwnershipCopy, updateOwnershipCopy } from '@/server/services/ownership';

const ownershipSchema = z.object({
  movieId: z.string().uuid(),
  copyId: z.string().uuid().optional(),
  format: z.enum(['4k_uhd', 'blu_ray', 'dvd', 'digital', 'other']),
  edition: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function saveOwnershipCopyAction(input: z.infer<typeof ownershipSchema>): Promise<ActionResult<{ id: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = ownershipSchema.parse(input);
    const copy = parsed.copyId
      ? await updateOwnershipCopy(user.id, parsed.copyId, parsed)
      : await addOwnershipCopy(user.id, parsed.movieId, parsed);
    revalidatePath('/films');
    revalidatePath('/watchlist');
    revalidatePath('/film/[slug]', 'page');
    return { id: copy.id };
  });
}

export async function removeOwnershipCopyAction(input: { copyId: string }): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const { copyId } = z.object({ copyId: z.string().uuid() }).parse(input);
    await removeOwnershipCopy(user.id, copyId);
    revalidatePath('/films');
    revalidatePath('/watchlist');
    revalidatePath('/film/[slug]', 'page');
    return null;
  });
}
