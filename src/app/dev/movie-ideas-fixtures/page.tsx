import { desc, isNotNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { QueueManager } from '@/components/club/queue-manager';
import { Container } from '@/components/ui/primitives';
import { db } from '@/server/db';
import { movies } from '@/server/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Movie Ideas fixture', robots: { index: false, follow: false } };

export default async function MovieIdeasFixturePage() {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') notFound();

  const rows = await db
    .select({
      id: movies.id,
      slug: movies.slug,
      title: movies.title,
      year: movies.year,
      posterPath: movies.posterPath,
      runtime: movies.runtime,
    })
    .from(movies)
    .where(isNotNull(movies.posterPath))
    .orderBy(desc(movies.providerPopularity))
    .limit(12);

  const discoveryItem = (movie: (typeof rows)[number], reason: string) => ({ movie, reason });
  const member = { id: 'member-1', username: 'maya', displayName: 'Maya', avatarAssetId: null };

  return (
    <Container size="wide" className="py-8 pb-24">
      <QueueManager
        clubId="fixture-club"
        clubSlug="velvet-frame"
        viewerId="member-1"
        isAdmin
        memberCount={5}
        activeRound={null}
        discoverySections={[
          { id: 'for-your-club', title: 'For your club', subtitle: 'Picked for your shared taste', items: rows.slice(0, 4).map((movie) => discoveryItem(movie, 'Matches your club’s taste')) },
          { id: 'popular-now', title: 'Popular now', subtitle: 'Trending with moviegoers this week', items: rows.slice(4, 8).map((movie) => discoveryItem(movie, 'Trending this week')) },
          { id: 'top-rated', title: 'Top rated', subtitle: 'All-time favourites with substantial audience ratings', items: rows.slice(8, 12).map((movie) => discoveryItem(movie, 'Highly rated by moviegoers')) },
        ]}
        items={rows.slice(0, 2).map((movie, index) => ({
          id: `idea-${index}`,
          note: index === 0 ? 'This feels perfect for movie night.' : null,
          addedBy: member,
          onWatchlistCount: index + 1,
          watchedByCount: index,
          alreadyScreened: false,
          movie,
        }))}
      />
    </Container>
  );
}
