import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Poster } from '@/components/film/poster';
import { RatingNumber } from '@/components/film/stars';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { filmHref, screeningHref } from '@/lib/links';
import { roundPeriodLabel } from '@/lib/club-cadence';
import { formatClubDateTime, formatRuntime, pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { FeaturedPastNight } from '@/components/club/mobile/past-night-card';
import {
  getClubBySlug,
  getClubHistory,
  getClubStats,
  getMembership,
  getScreeningAttendance,
} from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

/**
 * The club's permanent record. Every completed screening keeps everything that
 * made it a night: the film, when it happened, who was there, how the group
 * scored it, what was said and which round chose it.
 */
export default async function ClubHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';

  const [history, stats] = await Promise.all([
    getClubHistory(club.id, 50, user?.id ?? null),
    getClubStats(club.id, user?.id ?? null),
  ]);

  // Avatars only for the night that gets the large card; the compact rows
  // below do not show them, so there is no reason to pay for the rest.
  const featured = history[0] ?? null;
  const featuredAttendees =
    featured && isMember
      ? (await getScreeningAttendance(featured.screening.id)).filter((entry) => entry.attended)
      : [];

  if (!history.length) {
    return (
      <EmptyState
        title="No shared history yet"
        description="Once the club finishes its first film it lands here permanently — attendees, ratings, discussion and all."
      />
    );
  }

  return (
    /* On a phone the artwork comes first: a club's history is the nights it
       had, not its averages. Ordering rather than duplicate markup, so desktop
       keeps the summary-then-list reading order it already had. */
    <div className="flex max-w-3xl flex-col">
      <h1 className="order-1 mb-4 font-display text-[1.75rem] leading-none lg:hidden">Past nights</h1>

      <section className="order-3 mb-8 grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface/50 p-4 sm:grid-cols-4 lg:order-1">
        <Stat label="Films watched" value={String(stats.screeningCount)} />
        <Stat
          label="Group average"
          value={stats.averageRating ? (stats.averageRating / 2).toFixed(1) : '—'}
        />
        <Stat
          label="Time together"
          value={stats.totalRuntimeMinutes ? (formatRuntime(stats.totalRuntimeMinutes) ?? '—') : '—'}
        />
        <Stat label="Members" value={String(stats.memberCount)} />
      </section>

      {stats.topGenres.length ? (
        <p className="order-4 mb-6 text-sm text-muted lg:order-2">
          This club mostly watches{' '}
          <span className="text-text">
            {stats.topGenres
              .slice(0, 3)
              .map((genre) => genre.name.toLowerCase())
              .join(', ')}
          </span>
          .
          {stats.topRated ? (
            <>
              {' '}
              Its highest-rated night so far is{' '}
              <Link href={filmHref(stats.topRated)} className="text-text hover:text-iris">
                {stats.topRated.title}
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {featured ? (
        <div className="order-2 mb-3 lg:order-3">
          <FeaturedPastNight
            href={isMember ? screeningHref(club, featured.screening) : filmHref(featured.movie)}
            film={{
              slug: featured.movie.slug,
              title: featured.movie.title,
              year: featured.movie.year,
              posterPath: featured.movie.posterPath,
            }}
            backdropPath={featured.movie.backdropPath}
            dateLabel={
              featured.screening.completedAt
                ? formatClubDateTime(featured.screening.completedAt)
                : featured.round
                  ? roundPeriodLabel(club.selectionCadence, featured.round.roundStartAt)
                  : 'Watched together'
            }
            attendees={featuredAttendees}
            attendeeCount={featured.screening.attendeeCount}
            average={featured.average}
            ratingsHidden={featured.ratingsHidden}
            postCount={featured.screening.postCount}
          />
        </div>
      ) : null}

      <ol className="order-2 mb-8 space-y-3 lg:order-3 lg:mb-0">
        {history.slice(1).map(({ screening, movie, round, average, ratingsHidden }) => (
          <li key={screening.id}>
            <Link
              href={isMember ? screeningHref(club, screening) : filmHref(movie)}
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
                {round ? (
                  <p className="mb-0.5 text-[0.6875rem] uppercase tracking-wide text-iris">
                    {roundPeriodLabel(club.selectionCadence, round.roundStartAt)}
                  </p>
                ) : null}
                <p className="truncate font-medium">
                  {movie.title}
                  {movie.year ? (
                    <span className="ml-1.5 text-xs text-dim tabular">{movie.year}</span>
                  ) : null}
                </p>
                <p className="text-xs text-dim tabular">
                  {screening.completedAt
                    ? formatClubDateTime(screening.completedAt)
                    : ''}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
                  <span>{pluralize(screening.attendeeCount, 'attendee')}</span>
                  {screening.postCount > 0 ? (
                    <span>· {pluralize(screening.postCount, 'message')}</span>
                  ) : null}
                  {round ? (
                    <Badge tone="neutral">
                      {round.mode === 'wheel' ? 'Wheel' : 'Vote'}
                    </Badge>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {average != null ? (
                  <>
                    <RatingNumber average={average} className="block text-2xl" />
                    <p className="text-[0.625rem] text-dim">
                      {pluralize(screening.groupRatingCount, 'rating')}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-iris">{ratingsHidden ? 'Rate to reveal' : 'Not rated'}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
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
