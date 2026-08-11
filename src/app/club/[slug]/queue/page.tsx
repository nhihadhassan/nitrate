import { notFound } from 'next/navigation';

import { QueueManager } from '@/components/club/queue-manager';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getClubQueue, getMembership } from '@/server/services/clubs';

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
        description="The shared queue is visible to people in the club."
      />
    );
  }

  const queue = await getClubQueue(club.id, 100);

  return (
    <QueueManager
      clubId={club.id}
      clubSlug={club.slug}
      viewerId={user!.id}
      isAdmin={membership.role !== 'member'}
      memberCount={club.memberCount}
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
