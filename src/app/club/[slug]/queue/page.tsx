import { notFound } from 'next/navigation';

import { QueueManager } from '@/components/club/queue-manager';
import { EmptyState } from '@/components/ui/primitives';
import { recommendationReasonLabel } from '@/lib/recommendations';
import { getCurrentUser } from '@/server/auth/session';
import { getEditorialRails } from '@/server/services/explore';
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

  const [queue, round, intelligence, editorial] = await Promise.all([
    getClubQueue(club.id, 100),
    getActiveRound(club.id),
    getClubIntelligence(club.id),
    getEditorialRails(),
  ]);
  const roundPicks = round?.status === 'nominations_open'
    ? await getRoundNominations(round.id, user!.id)
    : null;

  // Keep each rail distinct. The provider's weekly trend and vote-weighted
  // canon refresh whenever this dynamic page is requested, while the first
  // row remains grounded in this club's own watchlists, history, and taste.
  const usedMovieIds = new Set<string>();
  const unique = <T extends { id: string }>(movies: T[], limit = 12): T[] => {
    const result: T[] = [];
    for (const movie of movies) {
      if (usedMovieIds.has(movie.id)) continue;
      usedMovieIds.add(movie.id);
      result.push(movie);
      if (result.length === limit) break;
    }
    return result;
  };
  const forYourClub = unique(intelligence.shortlist.map((item) => item.movie), 8);
  // A saved idea may still be the club's strongest personalized suggestion,
  // but broad discovery rows should introduce something new.
  queue.forEach((item) => usedMovieIds.add(item.movie.id));
  const popularNow = unique(editorial.trending, 12);
  const topRated = unique(editorial.canon, 12);

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
          items: forYourClub.map((movie) => {
            const suggestion = intelligence.shortlist.find((item) => item.movie.id === movie.id)!;
            return { movie, reason: suggestion.reasons.map(recommendationReasonLabel).join(' · ') };
          }),
        },
        {
          id: 'popular-now',
          title: 'Popular now',
          subtitle: 'Trending with moviegoers this week',
          items: popularNow.map((movie) => ({ movie, reason: 'Trending this week' })),
        },
        {
          id: 'top-rated',
          title: 'Top rated',
          subtitle: 'All-time favourites with substantial audience ratings',
          items: topRated.map((movie) => ({ movie, reason: 'Highly rated by moviegoers' })),
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
