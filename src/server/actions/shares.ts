'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/server/auth/session';
import { actionGuard, type ActionResult } from '@/server/errors';
import {
  createClubYearbookShare,
  createPersonalRecapShare,
  createTasteComparisonShare,
  revokeShareSnapshot,
} from '@/server/services/shares';

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personal_recap'), year: z.number().int().min(1900).max(2200) }),
  z.object({ kind: z.literal('club_yearbook'), clubId: z.string().uuid(), year: z.number().int().min(1900).max(2200).nullable() }),
  z.object({ kind: z.literal('taste_comparison'), otherUserId: z.string().uuid() }),
]);

export async function createShareSnapshotAction(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ id: string; token: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = createSchema.parse(input);
    if (parsed.kind === 'personal_recap') return createPersonalRecapShare(user.id, parsed.year);
    if (parsed.kind === 'club_yearbook') return createClubYearbookShare(user.id, parsed.clubId, parsed.year);
    return createTasteComparisonShare(user.id, parsed.otherUserId);
  });
}

export async function revokeShareSnapshotAction(id: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await revokeShareSnapshot(z.string().uuid().parse(id), user.id);
    revalidatePath('/settings/sharing');
    return null;
  });
}
