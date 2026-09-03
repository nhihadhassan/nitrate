import { notFound, redirect } from 'next/navigation';

import { WheelExperience } from '@/components/club/wheel-experience';
import { Container, EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
  getClubPermissions,
  getMembership,
  getRoundNominations,
  getRoundParticipants,
  getWheelRevealState,
  beginWheelReveal,
} from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubRevealPage({ params }: { params: Promise<{ slug: string; roundId: string }> }) {
  const { slug, roundId } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  if (!user || !membership || membership.status !== 'active') redirect(`/login?next=/club/${encodeURIComponent(slug)}/reveal/${roundId}`);
  const round = await getActiveRound(club.id);
  if (!round || round.id !== roundId || round.mode !== 'wheel') return <Container size="narrow" className="py-16"><EmptyState title="That wheel is no longer active" description="Return to the club to see the current week." /></Container>;

  const [nominations, revealState, permissions, participants] = await Promise.all([
    getRoundNominations(round.id, user.id),
    getWheelRevealState(round.id, user.id),
    getClubPermissions(club.id, user.id),
    getRoundParticipants(round.id),
  ]);
  const pickCounts = nominations.memberPickCounts;
  const activeParticipantIds = participants.filter((participant) => participant.participating).map((participant) => participant.userId);
  const allReady = activeParticipantIds.length > 0 && activeParticipantIds.every((id) => (pickCounts[id] ?? 0) >= round.nominationLimitPerMember);
  const deadlineReady = Boolean(round.nominationsCloseAt && round.nominationsCloseAt <= new Date() && nominations.nominationCount >= 2);
  const canSpin = permissions.has('start_wheel');
  const initialPayload = revealState.revealed ? await beginWheelReveal(round.id, user.id) : null;

  return (
    <Container size="narrow" className="py-6 sm:py-10">
      <WheelExperience
        clubId={club.id}
        clubSlug={club.slug}
        roundId={round.id}
        previews={revealState.spun && !revealState.revealed ? [] : nominations.nominations.map((nomination) => ({
          nominationId: nomination.id,
          movie: {
            slug: nomination.movie.slug,
            title: nomination.movie.title,
            year: nomination.movie.year,
            posterPath: nomination.movie.posterPath,
            backdropPath: nomination.movie.backdropPath,
            runtime: nomination.movie.runtime,
          },
          nominatedBy: nomination.nominatedBy,
        }))}
        canSpin={canSpin}
        allReady={allReady || deadlineReady || Boolean(round.picksClosedAt)}
        spun={revealState.spun}
        revealed={revealState.revealed}
        initialPayload={initialPayload}
      />
    </Container>
  );
}
