import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatDateOnly } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getDiary } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function DiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string; year?: string }>;
}) {
  const { username } = await params;
  const { page, year } = await searchParams;
  const { profile, viewer, access } = await loadProfileContext(username);

  const pageNumber = Math.max(1, Number(page) || 1);
  const entries = await getDiary(profile.id, viewer, {
    limit: PAGE_SIZE,
    offset: (pageNumber - 1) * PAGE_SIZE,
    year: year ? Number(year) : undefined,
  });

  if (!entries.length) {
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
  for (const entry of entries) {
    const key = entry.entry.watchedDate.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  return (
    <div className="space-y-8">
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
                    <Link href={`/film/${movie.slug}`} className="truncate font-medium hover:text-ember">
                      {movie.title}
                    </Link>
                    {movie.year ? <span className="text-xs text-dim tabular">{movie.year}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {entry.rating ? <Stars value={entry.rating} size="xs" /> : null}
                    {entry.liked ? <LikeMark className="text-xs text-rose" /> : null}
                    {entry.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
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
