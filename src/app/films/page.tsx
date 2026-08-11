import type { Metadata } from 'next';
import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Container, EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { browseFilms, getEditorialRails } from '@/server/services/explore';

export const metadata: Metadata = { title: 'Browse films' };
export const dynamic = 'force-dynamic';

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940];
const SORTS = [
  { key: 'popularity', label: 'Popular' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'release_date', label: 'Newest' },
] as const;

export default async function FilmsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; decade?: string; sort?: string; page?: string }>;
}) {
  const { genre, decade, sort, page } = await searchParams;
  const activeSort = (SORTS.find((s) => s.key === sort)?.key ?? 'popularity') as
    | 'popularity'
    | 'rating'
    | 'release_date';
  const activeDecade = decade ? Number(decade) : undefined;
  const pageNumber = Math.max(1, Number(page) || 1);

  const [result, rails] = await Promise.all([
    browseFilms({ genreId: genre, decade: activeDecade, sort: activeSort, page: pageNumber }),
    getEditorialRails(),
  ]);

  const activeGenre = rails.genres.find((g) => g.providerId === genre);

  const queryFor = (patch: Record<string, string | number | undefined>) => {
    const query: Record<string, string> = {};
    const merged = { genre, decade: activeDecade, sort: activeSort, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== '') query[key] = String(value);
    }
    return query;
  };

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl">
          {activeGenre ? activeGenre.name : 'Films'}
          {activeDecade ? <span className="text-muted"> · {activeDecade}s</span> : null}
        </h1>
      </header>

      <div className="mb-6 space-y-3">
        <nav aria-label="Sort" className="flex flex-wrap gap-1 text-xs">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/films', query: queryFor({ sort: option.key, page: undefined }) }}
              aria-current={activeSort === option.key ? 'true' : undefined}
              className={cn(
                'rounded-md border px-2.5 py-1 transition-colors',
                activeSort === option.key
                  ? 'border-ember/40 bg-ember/10 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Decade" className="flex flex-wrap gap-1 text-xs">
          <Link
            href={{ pathname: '/films', query: queryFor({ decade: undefined, page: undefined }) }}
            className={cn(
              'rounded-md border px-2.5 py-1 transition-colors',
              !activeDecade ? 'border-line-strong text-text' : 'border-line text-muted hover:text-text',
            )}
          >
            Any era
          </Link>
          {DECADES.map((d) => (
            <Link
              key={d}
              href={{ pathname: '/films', query: queryFor({ decade: d, page: undefined }) }}
              className={cn(
                'rounded-md border px-2.5 py-1 tabular transition-colors',
                activeDecade === d
                  ? 'border-line-strong text-text'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {d}s
            </Link>
          ))}
        </nav>

        {rails.genres.length ? (
          <nav aria-label="Genre" className="flex flex-wrap gap-1 text-xs">
            <Link
              href={{ pathname: '/films', query: queryFor({ genre: undefined, page: undefined }) }}
              className={cn(
                'rounded-md border px-2.5 py-1 transition-colors',
                !genre ? 'border-line-strong text-text' : 'border-line text-muted hover:text-text',
              )}
            >
              All genres
            </Link>
            {rails.genres.map((g) => (
              <Link
                key={g.providerId}
                href={{ pathname: '/films', query: queryFor({ genre: g.providerId, page: undefined }) }}
                className={cn(
                  'rounded-md border px-2.5 py-1 transition-colors',
                  genre === g.providerId
                    ? 'border-line-strong text-text'
                    : 'border-line text-muted hover:text-text',
                )}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {result.degraded ? (
        <p className="mb-4 rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
          Browsing our local catalogue — the film database is unreachable right now.
        </p>
      ) : null}

      {result.films.length ? (
        <>
          <PosterGrid>
            {result.films.map((film) => (
              <PosterCard key={film.slug} film={film} />
            ))}
          </PosterGrid>

          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
            {pageNumber > 1 ? (
              <Link
                href={{ pathname: '/films', query: queryFor({ page: pageNumber - 1 }) }}
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
              >
                Previous
              </Link>
            ) : null}
            <span className="text-xs text-dim tabular">
              Page {result.page} of {result.totalPages}
            </span>
            {pageNumber < result.totalPages ? (
              <Link
                href={{ pathname: '/films', query: queryFor({ page: pageNumber + 1 }) }}
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
              >
                Next
              </Link>
            ) : null}
          </nav>
        </>
      ) : (
        <EmptyState title="Nothing here" description="Try a different decade or genre." />
      )}
    </Container>
  );
}
