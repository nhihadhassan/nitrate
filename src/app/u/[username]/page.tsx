import type { Metadata } from 'next';
import Link from 'next/link';

import { FeedCard } from '@/components/feed/feed-card';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { EmptyState, SectionHeading } from '@/components/ui/primitives';
import { formatRuntime, pluralize } from '@/lib/utils';
import { getUserActivity } from '@/server/services/feed';
import { loadProfileContext } from '@/server/services/profile-context';
import { getProfileStats, getWatchedFilms } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function ProfileOverviewPage({ params }: Params) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);

  const [stats, recentFilms, activity] = await Promise.all([
    getProfileStats(profile.id),
    getWatchedFilms(profile.id, { limit: 12 }),
    getUserActivity(profile.id, viewer, 8),
  ]);

  const hours = Math.round(stats.totalRuntimeMinutes / 60);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-10">
        <section>
          <SectionHeading
            title="Recently watched"
            href={`/@${profile.username}/films`}
            linkLabel="All films"
          />
          {recentFilms.length ? (
            <PosterGrid>
              {recentFilms.map(({ movie, state }) => (
                <PosterCard
                  key={movie.id}
                  film={{
                    slug: movie.slug,
                    title: movie.title,
                    year: movie.year,
                    posterPath: movie.posterPath,
                  }}
                  footer={
                    state.rating ? (
                      <p className="mt-0.5 text-[0.6875rem] text-ember" aria-label={`${state.rating / 2} stars`}>
                        {'★'.repeat(Math.floor(state.rating / 2))}
                        {state.rating % 2 ? '½' : ''}
                      </p>
                    ) : null
                  }
                />
              ))}
            </PosterGrid>
          ) : (
            <EmptyState
              title={access.isSelf ? 'Nothing logged yet' : 'No films yet'}
              description={
                access.isSelf
                  ? 'Log something you watched recently and your profile starts filling in.'
                  : `${profile.displayName} has not logged any films yet.`
              }
            />
          )}
        </section>

        <section>
          <SectionHeading title="Recent activity" />
          {activity.length ? (
            <div className="divide-y divide-line">
              {activity.map((item) => (
                <FeedCard
                  key={item.id}
                  signedIn={Boolean(viewer)}
                  item={{
                    id: item.id,
                    type: item.type,
                    createdAt: item.createdAt.toISOString(),
                    actor: item.actor,
                    movie: item.movie
                      ? {
                          id: item.movie.id,
                          slug: item.movie.slug,
                          title: item.movie.title,
                          year: item.movie.year,
                          posterPath: item.movie.posterPath,
                        }
                      : null,
                    entry: item.entry,
                    list: null,
                    club: null,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-dim">No public activity yet.</p>
          )}
        </section>
      </div>

      <aside className="space-y-8">
        <section className="rounded-lg border border-line bg-surface/50 p-4">
          <p className="eyebrow">This is what taste looks like</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Metric label="Films" value={stats.filmCount.toLocaleString()} />
            <Metric label={`In ${new Date().getFullYear()}`} value={stats.thisYearCount.toLocaleString()} />
            <Metric
              label="Average"
              value={stats.averageRating ? `${(stats.averageRating / 2).toFixed(1)}★` : '—'}
            />
            <Metric label="Rewatches" value={stats.rewatchCount.toLocaleString()} />
            <Metric label="Diary entries" value={stats.diaryCount.toLocaleString()} />
            <Metric label="Hours watched" value={hours ? `${hours.toLocaleString()}h` : '—'} />
          </dl>

          {stats.averageRating ? (
            <div className="mt-5">
              <p className="eyebrow mb-2">Rating spread</p>
              <div className="flex h-12 items-end gap-[3px]">
                {stats.ratingHistogram.map((bucket) => (
                  <div
                    key={bucket.rating}
                    className="flex-1"
                    title={`${bucket.rating / 2}★ — ${pluralize(bucket.count, 'film')}`}
                  >
                    <div
                      className="w-full rounded-t-[1px] bg-ember/70"
                      style={{
                        height: `${Math.max(bucket.percent, bucket.count ? 6 : 2)}%`,
                        minHeight: '2px',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[0.625rem] text-dim">
                <span aria-hidden>★</span>
                <span aria-hidden>★★★★★</span>
              </div>
            </div>
          ) : null}
        </section>

        {stats.topGenres.length ? (
          <section>
            <p className="eyebrow mb-2.5">Most-watched genres</p>
            <ul className="space-y-1.5">
              {stats.topGenres.map((genre) => (
                <li key={genre.slug} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted">{genre.name}</span>
                  <span className="text-xs text-dim tabular">{genre.count}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {stats.topDirector ? (
          <section>
            <p className="eyebrow mb-2">Most-watched director</p>
            <Link
              href={`/person/${stats.topDirector.providerId}`}
              className="font-display text-lg hover:text-ember"
            >
              {stats.topDirector.name}
            </Link>
            <p className="text-xs text-dim">{pluralize(stats.topDirector.count, 'film')}</p>
          </section>
        ) : null}

        {stats.totalRuntimeMinutes > 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            That is {formatRuntime(stats.totalRuntimeMinutes)} of screen time, give or take the films
            we are missing a runtime for.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">{label}</dt>
      <dd className="font-display text-2xl leading-tight tabular">{value}</dd>
    </div>
  );
}
