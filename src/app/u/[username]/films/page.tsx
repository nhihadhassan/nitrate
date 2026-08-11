import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { EmptyState } from '@/components/ui/primitives';
import { cn, pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { countWatchedFilms, getWatchedFilms, type FilmsSort } from '@/server/services/profile';

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
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { username } = await params;
  const { sort, page } = await searchParams;
  const { profile } = await loadProfileContext(username);

  const activeSort = (SORTS.find((s) => s.key === sort)?.key ?? 'recent') as FilmsSort;
  const pageNumber = Math.max(1, Number(page) || 1);

  const [films, total] = await Promise.all([
    getWatchedFilms(profile.id, {
      sort: activeSort,
      limit: PAGE_SIZE,
      offset: (pageNumber - 1) * PAGE_SIZE,
    }),
    countWatchedFilms(profile.id),
  ]);

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

      {films.length ? (
        <>
          <PosterGrid>
            {films.map(({ movie, state }) => (
              <PosterCard
                key={movie.id}
                film={{
                  slug: movie.slug,
                  title: movie.title,
                  year: movie.year,
                  posterPath: movie.posterPath,
                }}
                footer={
                  <div className="mt-0.5 flex items-center gap-1 text-[0.6875rem]">
                    {state.rating ? (
                      <span className="text-ember" aria-label={`${state.rating / 2} out of 5 stars`}>
                        {'★'.repeat(Math.floor(state.rating / 2))}
                        {state.rating % 2 ? '½' : ''}
                      </span>
                    ) : null}
                    {state.liked ? (
                      <span className="text-rose" aria-label="Liked">
                        ♥
                      </span>
                    ) : null}
                  </div>
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
