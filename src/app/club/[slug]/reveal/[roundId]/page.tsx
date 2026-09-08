import { notFound, redirect } from 'next/navigation';

import { WheelExperience } from '@/components/club/wheel-experience';
import { Container, EmptyState } from '@/components/ui/primitives';
import { cadenceLabel, roundMovieLabel } from '@/lib/club-cadence';
import { getCurrentUser } from '@/server/auth/session';
import {
  getClubRound,
  getClubBySlug,
  getClubMembers,
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
  // Look the round up directly rather than asking for the club's *active*
  // round: scheduling movie night ends a round's active life, and a member who
  // has not revealed yet would otherwise be sent here by the screening page
  // and hit a dead end.
  const round = await getClubRound(club.id, roundId);
  const cancelled = round?.status === 'cancelled';
  if (!round || round.mode !== 'wheel' || cancelled) {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState
          title="That wheel is no longer active"
          description="Return to the club to see the current selection."
        />
      </Container>
    );
  }

  const [nominations, revealState, permissions, participants, members] = await Promise.all([
    getRoundNominations(round.id, user.id),
    getWheelRevealState(round.id, user.id),
    getClubPermissions(club.id, user.id),
    getRoundParticipants(round.id),
    getClubMembers(club.id),
  ]);
  const pickCounts = nominations.memberPickCounts;
  const activeParticipantIds = participants.filter((participant) => participant.participating).map((participant) => participant.userId);
  const allReady = activeParticipantIds.length > 0 && activeParticipantIds.every((id) => (pickCounts[id] ?? 0) >= round.nominationLimitPerMember);
  const deadlineReady = Boolean(round.nominationsCloseAt && round.nominationsCloseAt <= new Date() && nominations.nominationCount >= 2);
  const canSpin = permissions.has('start_wheel');
  const initialPayload = revealState.revealed ? await beginWheelReveal(round.id, user.id) : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
      <WheelExperience
        clubId={club.id}
        clubSlug={club.slug}
        clubName={club.name}
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
        selectionMovieLabel={roundMovieLabel(club.selectionCadence, round.roundStartAt)}
        canPlanMovieNight={permissions.has('edit_movie_night')}
        members={members}
        memberLine={`${members.length} ${members.length === 1 ? 'member' : 'members'} · ${cadenceLabel(club.selectionCadence, club.customCadenceDays)}`}
      />
    </div>
  );
}
