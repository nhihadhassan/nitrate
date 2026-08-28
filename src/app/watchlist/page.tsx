import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { WatchlistNote } from '@/components/film/watchlist-note';
import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/primitives';
import { cn, formatRuntime, pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { countWatchlist, getWatchlist, type WatchlistSort } from '@/server/services/profile';
import { getMovieRecommendationContext } from '@/server/services/discovery';
import { getOwnershipMap } from '@/server/services/ownership';

export const metadata: Metadata = { title: 'Watchlist' };
export const dynamic = 'force-dynamic';

const SORTS: { key: WatchlistSort; label: string }[] = [
  { key: 'added', label: 'Recently added' },
  { key: 'release', label: 'Newest' },
  { key: 'runtime', label: 'Shortest' },
  { key: 'rating', label: 'Best rated' },
  { key: 'title', label: 'A–Z' },
];

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960];

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; decade?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/watchlist');

  const { sort, decade } = await searchParams;
  const activeSort = (SORTS.find((s) => s.key === sort)?.key ?? 'added') as WatchlistSort;
  const activeDecade = decade ? Number(decade) : undefined;

  const [films, total] = await Promise.all([
    getWatchlist(user.id, { sort: activeSort, decade: activeDecade, limit: 120 }),
    countWatchlist(user.id),
  ]);
  const filmContext = await getMovieRecommendationContext(user.id, films.map(({ movie }) => movie.id));
  const ownership = await getOwnershipMap(user.id, films.map(({ movie }) => movie.id));

  const totalRuntime = films.reduce((sum, f) => sum + (f.movie.runtime ?? 0), 0);

  return (
    <Container size="wide" className="py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Watchlist</h1>
          <p className="mt-1.5 text-sm text-muted">
            {pluralize(total, 'film')} waiting.
            {totalRuntime > 0 ? ` About ${formatRuntime(totalRuntime)} of viewing.` : ''} Logging one
            takes it off this list automatically.
          </p>
        </div>
        {films.length ? (
          <Button asChild variant="primary" size="sm">
            <Link href="/tonight">Choose for tonight</Link>
          </Button>
        ) : null}
      </header>

      <div className="mb-5 space-y-2.5">
        <nav
          aria-label="Sort watchlist"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/watchlist', query: { sort: option.key, decade } }}
              aria-current={activeSort === option.key ? 'true' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
                activeSort === option.key
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <nav
          aria-label="Filter by decade"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <Link
            href={{ pathname: '/watchlist', query: { sort: activeSort } }}
            className={cn(
              'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
              !activeDecade ? 'border-line-strong text-text' : 'border-line text-muted hover:text-text',
            )}
          >
            Any era
          </Link>
          {DECADES.map((d) => (
            <Link
              key={d}
              href={{ pathname: '/watchlist', query: { sort: activeSort, decade: d } }}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 tabular transition-colors',
                activeDecade === d
                  ? 'border-line-strong text-text'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {d}s
            </Link>
          ))}
        </nav>
      </div>

      {films.length ? (
        <PosterGrid>
          {films.map(({ movie, note }) => (
            <PosterCard
              key={movie.id}
              film={{
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                posterPath: movie.posterPath,
              }}
              footer={
                <>
                  {movie.runtime ? (
                    <p className="mt-0.5 text-[0.6875rem] text-dim tabular">
                      {formatRuntime(movie.runtime)}
                    </p>
                  ) : null}
                  <WatchlistNote movieId={movie.id} initialNote={note} />
                  {ownership.has(movie.id) ? <Badge tone="iris">Owned · {ownership.get(movie.id)!.map((copy) => copy.format.replaceAll('_', ' ')).join(', ')}</Badge> : null}
                  <RecommendationContext reasons={(filmContext.get(movie.id) ?? []).filter((reason) => reason.kind !== 'on_watchlist')} />
                </>
              }
            />
          ))}
        </PosterGrid>
      ) : (
        <EmptyState
          title={activeDecade ? 'Nothing from that era' : 'Your watchlist is empty'}
          description="Add films from any film page, a friend's review, or Explore."
          action={
            <Button asChild variant="primary">
              <Link href="/explore">Find something to watch</Link>
            </Button>
          }
        />
      )}
    </Container>
  );
}
