import type { Metadata } from 'next';
import Link from 'next/link';

import { FeedCard } from '@/components/feed/feed-card';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { LikeMark, RatingHistogram, Stars } from '@/components/film/stars';
import { ListCard } from '@/components/list/list-card';
import { ReviewBody } from '@/components/review/review-body';
import { Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { filmHref, personHref, reviewHref, userSectionHref } from '@/lib/links';
import { formatRuntime, pluralize } from '@/lib/utils';
import { getUserActivity } from '@/server/services/feed';
import { getProfilePins } from '@/server/services/profile-pins';
import { loadProfileContext } from '@/server/services/profile-context';
import {
  getProfileStats,
  getUserLists,
  getUserReviews,
  getWatchedFilms,
} from '@/server/services/profile';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

/**
 * A profile reads top-to-bottom as a person, not a dashboard: who they are and
 * their four favourites (in the layout header), then what they have been
 * watching, then what they have written, and only then the numbers. Every stat
 * that used to sit in the sidebar is still here — it has just stopped being the
 * first thing you meet.
 */
export default async function ProfileOverviewPage({ params }: Params) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);

  const [stats, recentFilms, activity, reviews, lists, pins] = await Promise.all([
    getProfileStats(profile.id),
    getWatchedFilms(profile.id, { limit: 12 }),
    getUserActivity(profile.id, viewer, 6),
    getUserReviews(profile.id, viewer, { limit: 2 }),
    getUserLists(profile.id, viewer, 3),
    getProfilePins(profile.id, viewer),
  ]);

  const hours = Math.round(stats.totalRuntimeMinutes / 60);

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      {pins.length ? <section><SectionHeading title="Pinned"/><ul className="grid gap-3 sm:grid-cols-2">{pins.map((pin)=><li key={pin.id} className="rounded-lg border border-line p-4"><p className="eyebrow">{pin.type}</p><Link href={pin.href} className="mt-1 block text-lg font-medium hover:text-ember">{pin.title}</Link>{pin.subtitle?<p className="mt-2 line-clamp-2 text-sm text-muted">{pin.subtitle}</p>:null}</li>)}</ul></section>:null}
      <section>
        <SectionHeading
          title="Recently watched"
          href={userSectionHref(profile, 'films')}
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
                  state.rating || state.liked ? (
                    <span className="mt-0.5 flex items-center gap-1.5">
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
                    </span>
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

      {reviews.length ? (
        <section>
          <SectionHeading
            title="Recent writing"
            href={userSectionHref(profile, 'reviews')}
            linkLabel="All reviews"
          />
          <ul className="space-y-6">
            {reviews.map(({ entry, movie }) => (
              <li key={entry.id} className="flex gap-4">
                <div className="w-14 shrink-0 sm:w-16">
                  <Poster
                    film={{
                      slug: movie.slug,
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                    }}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={filmHref(movie)} className="font-medium hover:text-ember">
                      {movie.title}
                    </Link>
                    {movie.year ? (
                      <span className="text-xs text-dim tabular">{movie.year}</span>
                    ) : null}
                    <Stars
                      value={entry.rating}
                      size="sm"
                      labelPrefix={`${profile.displayName} rated this`}
                    />
                    {entry.liked ? (
                      <LikeMark
                        className="text-sm text-rose"
                        label={`${profile.displayName} liked this film`}
                      />
                    ) : null}
                  </div>
                  <Link href={reviewHref(entry)} className="mt-1.5 block">
                    <ReviewBody
                      text={entry.reviewText ?? ''}
                      containsSpoilers={entry.containsSpoilers}
                      clamp={3}
                    />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lists.length ? (
        <section>
          <SectionHeading
            title="Lists"
            href={userSectionHref(profile, 'lists')}
            linkLabel="All lists"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={{
                  id: list.id,
                  title: list.title,
                  description: list.description,
                  itemCount: list.itemCount,
                  likeCount: list.likeCount,
                  isRanked: list.isRanked,
                  visibility: list.visibility,
                  covers: list.covers,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

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
                  types: item.types,
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
                  metadata: item.metadata,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-dim">No public activity yet.</p>
        )}
      </section>

      <Divider />

      <section aria-labelledby="profile-stats">
        <h2 id="profile-stats" className="eyebrow mb-4">
          The numbers
        </h2>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Films" value={stats.filmCount.toLocaleString()} />
          <Metric
            label={`In ${new Date().getFullYear()}`}
            value={stats.thisYearCount.toLocaleString()}
          />
          <Metric
            label="Average rating"
            value={stats.averageRating ? (stats.averageRating / 2).toFixed(1) : '—'}
          />
          <Metric label="Rewatches" value={stats.rewatchCount.toLocaleString()} />
          <Metric label="Diary entries" value={stats.diaryCount.toLocaleString()} />
          <Metric label="Hours watched" value={hours ? hours.toLocaleString() : '—'} />
        </dl>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {stats.averageRating ? (
            <div>
              <p className="eyebrow mb-2">Rating spread</p>
              <RatingHistogram
                buckets={stats.ratingHistogram}
                total={stats.ratingHistogram.reduce((sum, bucket) => sum + bucket.count, 0)}
                height="h-12"
              />
            </div>
          ) : null}

          {stats.topGenres.length ? (
            <div>
              <p className="eyebrow mb-2">Most-watched genres</p>
              <ul className="space-y-1.5">
                {stats.topGenres.map((genre) => (
                  <li key={genre.slug} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted">{genre.name}</span>
                    <span className="text-xs text-dim tabular">{genre.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-6">
            {stats.topDirector ? (
              <div>
                <p className="eyebrow mb-2">Most-watched director</p>
                <Link
                  href={personHref(stats.topDirector)}
                  className="font-display text-lg hover:text-ember"
                >
                  {stats.topDirector.name}
                </Link>
                <p className="text-xs text-dim">{pluralize(stats.topDirector.count, 'film')}</p>
              </div>
            ) : null}

            {stats.totalRuntimeMinutes > 0 ? (
              <p className="text-xs leading-relaxed text-dim">
                That is {formatRuntime(stats.totalRuntimeMinutes)} of screen time, give or take the
                films we are missing a runtime for.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">{label}</dt>
      <dd className="font-display text-3xl leading-tight tabular">{value}</dd>
    </div>
  );
}
