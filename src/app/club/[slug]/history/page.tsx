import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Poster } from '@/components/film/poster';
import { Stars } from '@/components/film/stars';
import { EmptyState } from '@/components/ui/primitives';
import { formatDateTimeInZone, formatRuntime, pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getClubHistory, getClubStats, getMembership } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';

  const [history, stats] = await Promise.all([getClubHistory(club.id), getClubStats(club.id)]);

  if (!history.length) {
    return (
      <EmptyState
        title="No shared history yet"
        description="Once the club finishes its first film, it lands here permanently — attendees, ratings, discussion and all."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <section className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface/50 p-4 sm:grid-cols-4">
        <Stat label="Films watched" value={String(stats.screeningCount)} />
        <Stat
          label="Group average"
          value={stats.averageRating ? (stats.averageRating / 2).toFixed(1) : '—'}
        />
        <Stat
          label="Time together"
          value={stats.totalRuntimeMinutes ? formatRuntime(stats.totalRuntimeMinutes) ?? '—' : '—'}
        />
        <Stat label="Members" value={String(stats.memberCount)} />
      </section>

      <ol className="space-y-3">
        {history.map(({ screening, movie, round }) => {
          const average =
            screening.groupRatingCount > 0
              ? screening.groupRatingSum / screening.groupRatingCount
              : null;
          return (
            <li key={screening.id}>
              <Link
                href={isMember ? `/club/${club.slug}/screening/${screening.id}` : `/film/${movie.slug}`}
                className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-iris/40"
              >
                <div className="w-14 shrink-0">
                  <Poster
                    film={{
                      slug: movie.slug,
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                    }}
                    size="xs"
                    linked={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{movie.title}</p>
                  <p className="text-xs text-dim tabular">
                    {screening.completedAt
                      ? formatDateTimeInZone(screening.completedAt, club.timezone)
                      : ''}
                  </p>
                  <p className="mt-1 text-xs text-dim">
                    {pluralize(screening.attendeeCount, 'attendee')}
                    {round ? ` · round ${round.roundNumber}` : ''}
                    {screening.postCount > 0 ? ` · ${pluralize(screening.postCount, 'message')}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {average ? (
                    <>
                      <p className="font-display text-2xl leading-none tabular">
                        {(average / 2).toFixed(1)}
                      </p>
                      <Stars value={Math.round(average)} size="xs" />
                    </>
                  ) : (
                    <p className="text-xs text-dim">Not rated</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] uppercase tracking-wide text-dim">{label}</p>
      <p className="font-display text-2xl tabular">{value}</p>
    </div>
  );
}
