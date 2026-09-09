import { notFound } from 'next/navigation';

import { QueueManager } from '@/components/club/queue-manager';
import { EmptyState } from '@/components/ui/primitives';
import { recommendationReasonLabel } from '@/lib/recommendations';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
  getClubIntelligence,
  getClubQueue,
  getMembership,
  getRoundNominations,
} from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubQueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  if (membership?.status !== 'active') {
    return (
      <EmptyState
        title="Members only"
        description="Movie Ideas are visible to people in the club."
      />
    );
  }

  const [queue, round, intelligence] = await Promise.all([
    getClubQueue(club.id, 100),
    getActiveRound(club.id),
    getClubIntelligence(club.id),
  ]);
  const roundPicks = round?.status === 'nominations_open'
    ? await getRoundNominations(round.id, user!.id)
    : null;

  return (
    <QueueManager
      clubId={club.id}
      clubSlug={club.slug}
      viewerId={user!.id}
      isAdmin={membership.role !== 'member'}
      memberCount={club.memberCount}
      activeRound={round && roundPicks ? {
        id: round.id,
        mode: round.mode,
        limit: round.nominationLimitPerMember,
        myPicks: roundPicks.nominations
          .filter((pick) => pick.nominatedBy.id === user!.id)
          .map((pick) => ({ id: pick.id, movieId: pick.movie.id })),
      } : null}
      discoverySections={[
        {
          id: 'for-your-club',
          title: 'For your club',
          subtitle: 'Picked for your shared taste',
          items: intelligence.shortlist.map((item) => ({
            movie: item.movie,
            reason: item.reasons.map(recommendationReasonLabel).join(' · '),
          })),
        },
        {
          id: 'on-your-radar',
          title: 'On everyone’s radar',
          subtitle: 'Saved by more than one member',
          items: intelligence.onEveryonesRadar.map((item) => ({ movie: item.movie, reason: recommendationReasonLabel(item.reason) })),
        },
        {
          id: 'unseen-by-the-club',
          title: 'Nobody has seen it',
          subtitle: 'Fresh territory for movie night',
          items: intelligence.nobodyHasSeen.map((item) => ({ movie: item.movie, reason: recommendationReasonLabel(item.reason) })),
        },
      ]}
      items={queue.map((item) => ({
        id: item.id,
        note: item.note,
        addedBy: item.addedBy,
        onWatchlistCount: item.onWatchlistCount,
        watchedByCount: item.watchedByCount,
        alreadyScreened: item.alreadyScreened,
        movie: {
          id: item.movie.id,
          slug: item.movie.slug,
          title: item.movie.title,
          year: item.movie.year,
          posterPath: item.movie.posterPath,
          runtime: item.movie.runtime,
        },
      }))}
    />
  );
}
