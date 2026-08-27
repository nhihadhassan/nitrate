import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/server/auth/session';
import { getClubPulse, getMembership } from '@/server/services/clubs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A lightweight polling endpoint for live club state — picks landing, voting
 * opening, the wheel spinning, a winner landing, movie night getting
 * scheduled, RSVPs and the discussion. `club-pulse.tsx` polls this while the
 * tab is visible and a round is live, and refreshes the page on any change,
 * so members watching the same round together see it move without a manual
 * reload. Membership-gated like every other club surface; no rate limit
 * beyond the client's own backoff since a poll is a handful of indexed reads.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const membership = await getMembership(clubId, user.id);
  if (!membership || membership.status !== 'active') {
    return NextResponse.json({ error: 'Not a member of this club.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const screeningId = url.searchParams.get('screeningId');

  const pulse = await getClubPulse(clubId, screeningId);

  return NextResponse.json(pulse, { headers: { 'cache-control': 'private, no-store' } });
}
