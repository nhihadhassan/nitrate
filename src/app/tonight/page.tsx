import type { Metadata } from 'next';
import Link from 'next/link';

import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { formatRuntime } from '@/lib/utils';
import { requireUser } from '@/server/auth/session';
import { getTonightRecommendations } from '@/server/services/discovery';
import { resolveWatchRegion } from '@/server/services/region';
import { getOwnershipMap } from '@/server/services/ownership';
import { Badge } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Tonight' };
export const dynamic = 'force-dynamic';

export default async function TonightPage() {
  const user = await requireUser();
  const region = await resolveWatchRegion(user.watchRegion);
  const suggestions = await getTonightRecommendations(user.id, region);
  const ownership = await getOwnershipMap(user.id, suggestions.map(({ movie }) => movie.id));
  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-8 max-w-2xl">
        <p className="eyebrow">Tonight</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">A short, honest shortlist.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Drawn from your watchlist and Movie Ideas, with friend context and region-aware availability.
          Streaming leads when known; missing provider data is never treated as unavailable.
        </p>
      </header>
      {suggestions.length ? (
        <PosterGrid density="roomy">
          {suggestions.map(({ movie, reasons, availability }) => {
            const atHome = availability ? [...availability.stream, ...availability.free] : [];
            return (
              <PosterCard
                key={movie.id}
                film={movie}
                footer={(
                  <>
                    <p className="mt-0.5 text-[0.6875rem] text-dim">
                      {movie.runtime ? formatRuntime(movie.runtime) : 'Runtime unknown'}
                      {atHome.length ? ` · ${atHome.slice(0, 2).map((provider) => provider.name).join(', ')}` : ''}
                    </p>
                    {ownership.has(movie.id) ? <Badge tone="iris">Owned · ready tonight</Badge> : null}
                    <RecommendationContext movieId={movie.id} reasons={reasons} controls />
                  </>
                )}
              />
            );
          })}
        </PosterGrid>
      ) : (
        <EmptyState
          title="Nothing to shortlist yet"
          description="Add a few films to your watchlist or a club’s Movie Ideas."
          action={<Button asChild variant="primary"><Link href="/explore">Explore films</Link></Button>}
        />
      )}
    </Container>
  );
}
