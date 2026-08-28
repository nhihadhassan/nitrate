import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Badge, Container, EmptyState } from '@/components/ui/primitives';
import { cn, formatRuntime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getTonightRecommendations, type TonightConstraints } from '@/server/services/discovery';
import { getGenres } from '@/server/services/explore';
import { getOwnershipMap } from '@/server/services/ownership';
import { resolveWatchRegion } from '@/server/services/region';

export const metadata: Metadata = { title: 'Tonight' };
export const dynamic = 'force-dynamic';

const TIME_OPTIONS = [
  { key: '', label: 'Any length', minutes: null },
  { key: '100', label: 'Under 100 min', minutes: 100 },
  { key: '130', label: 'Under 2h 10m', minutes: 130 },
] as const;

type SearchParams = {
  scope?: string;
  time?: string;
  genre?: string;
  available?: string;
  more?: string;
};

export default async function TonightPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/tonight');
  const params = await searchParams;

  const scope: TonightConstraints['scope'] = params.scope === 'broader' ? 'broader' : 'watchlist';
  const timeOption = TIME_OPTIONS.find((option) => option.key === (params.time ?? '')) ?? TIME_OPTIONS[0];
  const onlyAvailable = params.available === '1';
  const genreId = params.genre?.trim() || null;
  const seed = Math.max(0, Number.parseInt(params.more ?? '0', 10) || 0);

  const region = await resolveWatchRegion(user.watchRegion);
  const [suggestions, genres] = await Promise.all([
    getTonightRecommendations(user.id, region, {
      scope,
      maxRuntimeMinutes: timeOption.minutes,
      genreId,
      onlyAvailable,
      seed,
    }),
    getGenres(),
  ]);
  const ownership = await getOwnershipMap(user.id, suggestions.map(({ movie }) => movie.id));

  const queryFor = (patch: Partial<SearchParams>) => {
    const merged = {
      scope: scope === 'watchlist' ? undefined : scope,
      time: timeOption.key || undefined,
      genre: genreId || undefined,
      available: onlyAvailable ? '1' : undefined,
      ...patch,
    };
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (value) query[key] = value;
    }
    return query;
  };

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-6 max-w-2xl">
        <p className="eyebrow">Tonight</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">A short, honest shortlist.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Drawn from your watchlist and Movie Ideas, with friend context and region-aware availability.
          Streaming leads when known; missing provider data is never treated as unavailable.
        </p>
      </header>

      <div className="mb-8 space-y-2.5">
        <nav
          aria-label="Where to look"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {(['watchlist', 'broader'] as const).map((option) => (
            <Link
              key={option}
              href={{ pathname: '/tonight', query: queryFor({ scope: option === 'watchlist' ? undefined : option, more: undefined }) }}
              aria-current={scope === option ? 'true' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
                scope === option
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option === 'watchlist' ? 'Your watchlist & Ideas' : 'Wider picks too'}
            </Link>
          ))}
        </nav>

        <nav
          aria-label="How much time"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {TIME_OPTIONS.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/tonight', query: queryFor({ time: option.key || undefined, more: undefined }) }}
              aria-current={timeOption.key === option.key ? 'true' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
                timeOption.key === option.key
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <nav
          aria-label="Genre and availability"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <Link
            href={{ pathname: '/tonight', query: queryFor({ genre: undefined, more: undefined }) }}
            className={cn(
              'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
              !genreId ? 'border-line-strong text-text' : 'border-line text-muted hover:text-text',
            )}
          >
            Any genre
          </Link>
          {genres.slice(0, 8).map((genre) => (
            <Link
              key={genre.providerId}
              href={{ pathname: '/tonight', query: queryFor({ genre: genre.providerId, more: undefined }) }}
              className={cn(
                'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
                genreId === genre.providerId
                  ? 'border-line-strong text-text'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {genre.name}
            </Link>
          ))}
          <Link
            href={{ pathname: '/tonight', query: queryFor({ available: onlyAvailable ? undefined : '1', more: undefined }) }}
            aria-pressed={onlyAvailable}
            className={cn(
              'flex min-h-10 shrink-0 items-center rounded-md border px-3 transition-colors',
              onlyAvailable
                ? 'border-jade/40 bg-jade/10 text-jade'
                : 'border-line text-muted hover:text-text',
            )}
          >
            Only what I can stream now
          </Link>
        </nav>
      </div>

      {suggestions.length ? (
        <>
          <PosterGrid density="shortlist">
            {suggestions.map(({ movie, reasons, availability }) => {
              const atHome = availability ? [...availability.stream, ...availability.free] : [];
              return (
                <PosterCard
                  key={movie.id}
                  film={movie}
                  size="xl"
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

          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline">
              <Link href={{ pathname: '/tonight', query: queryFor({ more: String(seed + 1) }) }}>
                Show me three more
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          title="Nothing to shortlist yet"
          description={
            scope === 'watchlist'
              ? 'Add a few films to your watchlist or a club’s Movie Ideas, or try wider picks.'
              : 'Try loosening the time limit, genre, or availability filter.'
          }
          action={<Button asChild variant="primary"><Link href="/explore">Explore films</Link></Button>}
        />
      )}
    </Container>
  );
}
