import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { LibraryFilters, type LibraryFilterValues } from '@/components/film/library-filters';
import { LikeMark, Stars } from '@/components/film/stars';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { filmHref } from '@/lib/links';
import { formatDateOnly } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getDiary } from '@/server/services/profile';
import { getCurrentUser } from '@/server/auth/session';
import { getAvailabilityForMovies } from '@/server/movies/watch-providers';
import { resolveWatchRegion } from '@/server/services/region';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function DiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string; year?: string } & LibraryFilterValues>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const { page, year } = query;
  const { profile, viewer, access } = await loadProfileContext(username);

  const pageNumber = Math.max(1, Number(page) || 1);
  const entries = await getDiary(profile.id, viewer, {
    limit: PAGE_SIZE,
    offset: (pageNumber - 1) * PAGE_SIZE,
    year: year ? Number(year) : undefined,
    yearFrom: Number(query.yearFrom) || undefined, yearTo: Number(query.yearTo) || undefined,
    ratingMin: Number(query.ratingMin) || undefined, genreId: query.genre, tag: query.tag,
    director: query.director, rewatch: query.rewatch === '1', onlyLiked: query.liked === '1',
    clubId: query.club, viewingContext: query.context, runtimeMax: Number(query.runtimeMax) || undefined,
    owned: access.isSelf && query.owned === '1',
  });

  const current = await getCurrentUser();
  const region = query.available === '1' && current && access.isSelf ? await resolveWatchRegion(current.watchRegion) : null;
  const availability = region ? await getAvailabilityForMovies(entries.map(({ movie }) => movie), region, { limit: PAGE_SIZE }) : new Map();
  const visibleEntries = region ? entries.filter(({ movie }) => { const row = availability.get(movie.id); return row ? row.stream.length + row.free.length + row.rent.length + row.buy.length > 0 : false; }) : entries;

  if (!visibleEntries.length) {
    return (
      <EmptyState
        title={access.isSelf ? 'Your diary starts with one film' : 'No diary entries'}
        description={
          access.isSelf
            ? 'Every film you log with a date lands here, newest first — including every rewatch.'
            : `${profile.displayName} has not shared any dated viewings.`
        }
      />
    );
  }

  // Group by month so a long diary reads as a timeline, not a wall.
  const groups = new Map<string, typeof entries>();
  for (const entry of visibleEntries) {
    const key = entry.entry.watchedDate.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  return (
    <div className="space-y-8">
      <LibraryFilters action={`/@${profile.username}/diary`} values={query} diary />
      {Array.from(groups.entries()).map(([month, rows]) => (
        <section key={month}>
          <h2 className="eyebrow mb-3">
            {formatDateOnly(`${month}-01`, { month: 'long', year: 'numeric' })}
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {rows.map(({ entry, movie, tags }) => (
              <li key={entry.id} className="flex items-center gap-3 py-3">
                <div className="w-8 shrink-0 text-center">
                  <p className="font-display text-xl leading-none tabular">
                    {Number(entry.watchedDate.slice(8, 10))}
                  </p>
                </div>
                <div className="w-11 shrink-0">
                  <Poster
                    film={{
                      slug: movie.slug,
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                    }}
                    size="xs"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={filmHref(movie)} className="truncate font-medium hover:text-ember">
                      {movie.title}
                    </Link>
                    {movie.year ? <span className="text-xs text-dim tabular">{movie.year}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {entry.rating ? <Stars value={entry.rating} size="xs" /> : null}
                    {entry.liked ? <LikeMark className="text-xs text-rose" /> : null}
                    {entry.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
                    {entry.viewingContext ? <Badge>{entry.viewingContext.replaceAll('_', ' ')}</Badge> : null}
                    {entry.reviewText ? (
                      <Link
                        href={`/review/${entry.id}`}
                        className="text-[0.6875rem] uppercase tracking-wide text-muted hover:text-ember"
                      >
                        Review
                      </Link>
                    ) : null}
                    {entry.visibility !== 'public' ? (
                      <Badge>{entry.visibility === 'private' ? 'Private' : 'Followers'}</Badge>
                    ) : null}
                    {tags.map((tag) => (
                      <span key={tag} className="text-[0.6875rem] text-dim">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <nav className="flex items-center justify-center gap-3 text-sm">
        {pageNumber > 1 ? (
          <Link
            href={`/@${profile.username}/diary?page=${pageNumber - 1}`}
            className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
          >
            Newer
          </Link>
        ) : null}
        {entries.length === PAGE_SIZE ? (
          <Link
            href={`/@${profile.username}/diary?page=${pageNumber + 1}`}
            className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-text"
          >
            Older
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
