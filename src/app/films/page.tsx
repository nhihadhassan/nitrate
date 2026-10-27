import type { Metadata } from 'next';
import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { BrowseFilters } from '@/components/film/browse-filters';
import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { browseFilms, getGenres } from '@/server/services/explore';

export const dynamic = 'force-dynamic';

type FilmSearchParams = { genre?: string; decade?: string; sort?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<FilmSearchParams>;
}): Promise<Metadata> {
  const filters = await searchParams;
  const filtered = Object.values(filters).some(Boolean);
  return {
    title: 'Browse films',
    description: 'Browse films by genre, decade, popularity, rating or release date on Nitrate.',
    alternates: { canonical: '/films' },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940];
const SORTS = [
  { key: 'popularity', label: 'Popular' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'release_date', label: 'Newest' },
] as const;

export default async function FilmsPage({
  searchParams,
}: {
  searchParams: Promise<FilmSearchParams>;
}) {
  const { genre, decade, sort, page } = await searchParams;
  const activeSort = (SORTS.find((s) => s.key === sort)?.key ?? 'popularity') as
    | 'popularity'
    | 'rating'
    | 'release_date';
  const activeDecade = decade ? Number(decade) : undefined;
  const pageNumber = Math.max(1, Number(page) || 1);

  const [result, genres] = await Promise.all([
    browseFilms({ genreId: genre, decade: activeDecade, sort: activeSort, page: pageNumber }),
    getGenres(),
  ]);

  const activeGenre = genres.find((g) => g.providerId === genre);

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
        <nav
          aria-label="Sort"
          className="mobile-tabs -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/films', query: queryFor({ sort: option.key, page: undefined }) }}
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

        <BrowseFilters pathname="/films" query={{ sort: activeSort, decade: activeDecade, genre }} decade={activeDecade} genre={genre}
          decades={[{ value: '', label: 'Any era' }, ...DECADES.map((value) => ({ value: String(value), label: `${value}s` }))]}
          genres={[{ value: '', label: 'All genres' }, ...genres.map((value) => ({ value: value.providerId, label: value.name }))]} />
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
              <PosterCard key={film.id} film={film} />
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
        <EmptyState
          title={result.degraded ? 'Films could not load' : 'No films match these filters'}
          description={
            result.degraded
              ? 'The film database is unavailable and the local catalogue has no results to show.'
              : 'Clear the filters to return to the popular catalogue.'
          }
          action={
            <Button asChild variant="outline">
              <Link href="/films">{result.degraded ? 'Try again' : 'Clear filters'}</Link>
            </Button>
          }
        />
      )}
    </Container>
  );
}
