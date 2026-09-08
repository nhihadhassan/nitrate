import { notFound, redirect } from 'next/navigation';

import { PickScreen } from '@/components/club/mobile/pick-screen';
import { Container, EmptyState } from '@/components/ui/primitives';
import { roundSelectionLabel } from '@/lib/club-cadence';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
  getClubIntelligence,
  getClubMembers,
  getClubPermissions,
  getClubQueue,
  getMembership,
  getRoundNominations,
  getRoundParticipants,
} from '@/server/services/clubs';
import { getWatchlistPreview } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

/**
 * Picking a movie, on its own screen.
 *
 * The club home used to inline this panel underneath everything else; on a
 * phone that buried the one thing the member came to do. Nothing about the
 * write path changes — the same nomination actions, the same round, the same
 * permission for submitting on someone else's behalf.
 */
export default async function ClubPickPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  if (!user || !membership || membership.status !== 'active') {
    redirect(`/login?next=/club/${encodeURIComponent(slug)}/pick`);
  }

  const round = await getActiveRound(club.id);
  if (!round || round.status !== 'nominations_open') {
    return (
      <Container size="narrow" className="py-12">
        <EmptyState
          title="Nothing to pick right now"
          description="This club is not choosing a movie at the moment."
        />
      </Container>
    );
  }

  const [nominations, participants, members, queue, watchlist, intelligence, permissions] =
    await Promise.all([
      getRoundNominations(round.id, user.id),
      getRoundParticipants(round.id),
      getClubMembers(club.id),
      getClubQueue(club.id, 9),
      getWatchlistPreview(user.id, 9),
      getClubIntelligence(club.id),
      getClubPermissions(club.id, user.id),
    ]);

  const participating = new Set(
    participants.filter((participant) => participant.participating).map((participant) => participant.userId),
  );
  const pickCounts = nominations.memberPickCounts;
  const mine = nominations.nominations.filter((nomination) => nomination.nominatedBy.id === user.id);

  const closesAt = round.nominationsCloseAt;
  const picksClosed = Boolean(round.picksClosedAt);
  const expired = Boolean(closesAt && closesAt.getTime() <= Date.now());

  return (
    <Container size="narrow" className="py-4">
      <PickScreen
        clubId={club.id}
        clubSlug={club.slug}
        roundId={round.id}
        limit={round.nominationLimitPerMember}
        viewerId={user.id}
        canSubmitForOthers={permissions.has('submit_picks_for_others')}
        selectionLabel={roundSelectionLabel(club.selectionCadence, round.roundStartAt)}
        dueLabel={dueLabel(closesAt, picksClosed)}
        pickingOpen={!picksClosed && !expired}
        members={members
          .filter((member) => participating.has(member.id))
          .map((member) => ({
            id: member.id,
            username: member.username,
            displayName: member.displayName,
            avatarAssetId: member.avatarAssetId,
            pickCount: pickCounts[member.id] ?? 0,
          }))}
        myPicks={mine.map((nomination) => ({
          id: nomination.id,
          slug: nomination.movie.slug,
          title: nomination.movie.title,
          year: nomination.movie.year,
          posterPath: nomination.movie.posterPath,
        }))}
        ideas={queue.map((item) => ({
          movieId: item.movie.id,
          title: item.movie.title,
          year: item.movie.year,
          posterPath: item.movie.posterPath,
        }))}
        watchlist={watchlist.map((movie) => ({
          movieId: movie.id,
          title: movie.title,
          year: movie.year,
          posterPath: movie.posterPath,
        }))}
        suggestions={(intelligence?.shortlist ?? []).slice(0, 9).map((item) => ({
          movieId: item.movie.id,
          title: item.movie.title,
          year: item.movie.year,
          posterPath: item.movie.posterPath,
        }))}
      />
    </Container>
  );
}

/** "Due in 2 days" — a fact, not a countdown, and nothing at all when open-ended. */
function dueLabel(closesAt: Date | null, picksClosed: boolean): string | null {
  if (picksClosed) return 'Picks are closed';
  if (!closesAt) return null;
  const ms = closesAt.getTime() - Date.now();
  if (ms <= 0) return 'Deadline passed';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'Due today';
  return `Due in ${days} days`;
}
