import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FeedCard } from '@/components/feed/feed-card';
import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getTasteCircle } from '@/server/services/discovery';
import { getHomeFeed } from '@/server/services/feed';

export const metadata: Metadata = { title: 'Taste circle', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TasteCirclePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/taste-circle');
  const circle = await getTasteCircle(user.id);
  const feed = user.tasteCircleFeedEnabled
    ? await getHomeFeed(
        { id: user.id, role: user.role },
        { actorIds: circle.map((member) => member.id), limit: 30 },
      )
    : [];

  return (
    <Container size="default" className="py-8 pb-20">
      <header className="mb-7 max-w-2xl">
        <p className="eyebrow">Private to you</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Taste circle</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A chronological feed from up to five people whose taste you trust. Nothing here changes
          the order of Home, and nobody can see who is in your circle.
        </p>
      </header>

      {!user.tasteCircleFeedEnabled ? (
        <EmptyState
          title="Taste circle feed is off"
          description="It is optional and stays separate from Home. Turn it on when you want the focused view."
          action={<Button asChild variant="primary"><Link href="/settings/discovery">Discovery settings</Link></Button>}
        />
      ) : !circle.length ? (
        <EmptyState
          title="Your circle is empty"
          description="Choose up to five people you already follow."
          action={<Button asChild variant="primary"><Link href="/settings/discovery">Choose people</Link></Button>}
        />
      ) : feed.length ? (
        <div className="divide-y divide-line">
          {feed.map((item) => (
            <FeedCard
              key={item.id}
              signedIn
              item={{
                id: item.id,
                types: item.types,
                createdAt: item.createdAt.toISOString(),
                actor: item.actor,
                movie: item.movie ? {
                  id: item.movie.id,
                  slug: item.movie.slug,
                  title: item.movie.title,
                  year: item.movie.year,
                  posterPath: item.movie.posterPath,
                } : null,
                entry: item.entry,
                list: item.list,
                club: item.club,
                metadata: item.metadata,
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing new in your circle" description="This view stays chronological, so quiet days remain quiet." />
      )}
    </Container>
  );
}
