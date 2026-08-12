import { notFound } from 'next/navigation';

import { QueueManager } from '@/components/club/queue-manager';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
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

  const [queue, round] = await Promise.all([getClubQueue(club.id, 100), getActiveRound(club.id)]);
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
