'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { NETWORK_SURFACES } from '@/lib/network';
import { track } from '@/server/analytics';
import { requireAdmin, requireUser } from '@/server/auth/session';
import { actionGuard, PermissionError, type ActionResult } from '@/server/errors';
import { setNetworkFlagMode } from '@/server/services/network';
import {
  decideClubJoinRequest,
  joinOpenPublicClub,
  requestPublicClubJoin,
  setClubJoinPolicy,
} from '@/server/services/network-clubs';

export async function setNetworkFlagAction(input: {
  surface: string;
  mode: string;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const admin = await requireAdmin();
    if (admin.role !== 'admin') throw new PermissionError('Only admins can change product flags.');
    const parsed = z
      .object({
        surface: z.enum(NETWORK_SURFACES),
        mode: z.enum(['auto', 'forced_on', 'forced_off']),
      })
      .parse(input);
    await setNetworkFlagMode(parsed.surface, parsed.mode, admin.id);
    revalidatePath('/admin/network');
    revalidatePath('/network');
    return null;
  });
}

export async function joinOpenClubAction(clubId: string): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsedClubId = z.string().uuid().parse(clubId);
    const result = await joinOpenPublicClub(parsedClubId, user.id);
    if (result.joined) await track('public_club_joined', user.id, { clubId: parsedClubId });
    revalidatePath(`/club/${result.club.slug}`);
    revalidatePath('/network/clubs');
    return null;
  });
}

export async function requestClubJoinAction(input: {
  clubId: string;
  message?: string;
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const clubId = z.string().uuid().parse(input.clubId);
    const message = z.string().max(500).optional().parse(input.message);
    await requestPublicClubJoin(clubId, user.id, message);
    await track('public_club_join_requested', user.id, { clubId });
    revalidatePath('/network/clubs');
    return null;
  });
}

export async function decideClubJoinRequestAction(input: {
  requestId: string;
  decision: 'approved' | 'declined';
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z
      .object({ requestId: z.string().uuid(), decision: z.enum(['approved', 'declined']) })
      .parse(input);
    const result = await decideClubJoinRequest(parsed.requestId, user.id, parsed.decision);
    revalidatePath(`/club/${result.club.slug}/members`);
    return null;
  });
}

export async function setClubJoinPolicyAction(input: {
  clubId: string;
  joinPolicy: 'invite_only' | 'request' | 'open';
}): Promise<ActionResult<null>> {
  return actionGuard(async () => {
    const user = await requireUser();
    const parsed = z
      .object({
        clubId: z.string().uuid(),
        joinPolicy: z.enum(['invite_only', 'request', 'open']),
      })
      .parse(input);
    const club = await setClubJoinPolicy(parsed.clubId, user.id, parsed.joinPolicy);
    revalidatePath(`/club/${club.slug}/settings`);
    return null;
  });
}
