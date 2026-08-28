import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { LibraryFilters, type LibraryFilterValues } from '@/components/film/library-filters';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/primitives';
import { cn, pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { countWatchedFilms, getWatchedFilms, type FilmsSort } from '@/server/services/profile';
import { getCurrentUser } from '@/server/auth/session';
import { getAvailabilityForMovies } from '@/server/movies/watch-providers';
import { getOwnershipMap } from '@/server/services/ownership';
import { resolveWatchRegion } from '@/server/services/region';

export const dynamic = 'force-dynamic';

const SORTS: { key: FilmsSort; label: string }[] = [
  { key: 'recent', label: 'Recently watched' },
  { key: 'rating', label: 'Your rating' },
  { key: 'release', label: 'Release date' },
  { key: 'title', label: 'Title' },
];

const PAGE_SIZE = 60;

export default async function ProfileFilmsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ sort?: string; page?: string } & LibraryFilterValues>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const { sort, page } = query;
  const { profile, access } = await loadProfileContext(username);
  const viewer = await getCurrentUser();

  const activeSort = (SORTS.find((s) => s.key === sort)?.key ?? 'recent') as FilmsSort;
  const pageNumber = Math.max(1, Number(page) || 1);

  const [films, total] = await Promise.all([
    getWatchedFilms(profile.id, {
      sort: activeSort,
      limit: PAGE_SIZE,
      offset: (pageNumber - 1) * PAGE_SIZE,
      yearFrom: Number(query.yearFrom) || undefined, yearTo: Number(query.yearTo) || undefined,
      ratingMin: Number(query.ratingMin) || undefined, genreId: query.genre, tag: query.tag,
      director: query.director, rewatch: query.rewatch === '1', onlyLiked: query.liked === '1',
      clubId: query.club, viewingContext: query.context, runtimeMax: Number(query.runtimeMax) || undefined,
      owned: access.isSelf && query.owned === '1',
    }),
    countWatchedFilms(profile.id),
  ]);

  const region = query.available === '1' && viewer && access.isSelf ? await resolveWatchRegion(viewer.watchRegion) : null;
  const availability = region ? await getAvailabilityForMovies(films.map(({ movie }) => movie), region, { limit: PAGE_SIZE }) : new Map();
  const visibleFilms = region ? films.filter(({ movie }) => { const row = availability.get(movie.id); return row ? row.stream.length + row.free.length + row.rent.length + row.buy.length > 0 : false; }) : films;
  const ownership = access.isSelf ? await getOwnershipMap(profile.id, visibleFilms.map(({ movie }) => movie.id)) : new Map();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{pluralize(total, 'film')}</h2>
        <nav aria-label="Sort films" className="flex flex-wrap gap-1 text-xs">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={`/@${profile.username}/films?sort=${option.key}`}
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
      </div>
      <LibraryFilters action={`/@${profile.username}/films`} values={query} />

      {visibleFilms.length ? (
        <>
          <PosterGrid>
            {visibleFilms.map(({ movie, state }) => (
              <PosterCard
                key={movie.id}
                film={{
                  slug: movie.slug,
                  title: movie.title,
                  year: movie.year,
                  posterPath: movie.posterPath,
                }}
                footer={
                  state.rating || state.liked || ownership.has(movie.id) ? (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Stars
                        value={state.rating}
                        size="xs"
                        labelPrefix={`${profile.displayName} rated this`}
                      />
                      {state.liked ? (
                        <LikeMark
                          className="text-[0.6875rem] text-rose"
                          label={`${profile.displayName} liked this film`}
                        />
                      ) : null}
                      {ownership.has(movie.id) ? <Badge tone="iris">Owned · {ownership.get(movie.id)!.length}</Badge> : null}
                    </div>
                  ) : null
                }
              />
            ))}
          </PosterGrid>

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
              {pageNumber > 1 ? (
                <Link
                  href={`/@${profile.username}/films?sort=${activeSort}&page=${pageNumber - 1}`}
                  className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
                >
                  Previous
                </Link>
              ) : null}
              <span className="text-xs text-dim tabular">
                Page {pageNumber} of {totalPages}
              </span>
              {pageNumber < totalPages ? (
                <Link
                  href={`/@${profile.username}/films?sort=${activeSort}&page=${pageNumber + 1}`}
                  className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No films yet"
          description="Films appear here once they are marked watched or logged."
        />
      )}
    </div>
  );
}
