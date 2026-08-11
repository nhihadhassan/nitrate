import type { Metadata } from 'next';
import Link from 'next/link';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { LikeMark, Stars } from '@/components/film/stars';
import { ListCard } from '@/components/list/list-card';
import { ReviewBody } from '@/components/review/review-body';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getPopularLists } from '@/server/services/lists';
import {
  getEditorialRails,
  getPopularAmongFollowing,
  getPopularReviews,
} from '@/server/services/explore';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Trending films, new releases, the decades and what the people you follow are watching.',
};
export const dynamic = 'force-dynamic';

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;

  const [rails, amongFollowing, reviews, lists] = await Promise.all([
    getEditorialRails(),
    user ? getPopularAmongFollowing(user.id, 12) : Promise.resolve([]),
    getPopularReviews(viewer, 4),
    getPopularLists(viewer, 6),
  ]);

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">Explore</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          What&apos;s moving right now, what the people you follow are actually watching, and a few
          decades worth digging through.
        </p>
      </header>

      <div className="space-y-14">
        {amongFollowing.length ? (
          <Rail
            title="Popular with people you follow"
            subtitle="The most-logged films across your circle in the last month."
            films={amongFollowing.map((row) => ({
              slug: row.movie.slug,
              title: row.movie.title,
              year: row.movie.year,
              posterPath: row.movie.posterPath,
              caption: pluralize(row.count, 'friend'),
            }))}
          />
        ) : null}

        {rails.degraded ? (
          <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
            Showing our local catalogue — the film database is unreachable right now.
          </p>
        ) : null}

        <Rail
          title="Trending this week"
          subtitle="What the wider film world is turning over."
          films={rails.trending}
        />

        <Rail title="In cinemas now" films={rails.nowPlaying} />

        <Rail
          title="The canon"
          subtitle="Highest rated, with enough votes to mean something."
          films={rails.topRated}
        />

        <Rail title="Coming soon" subtitle="Worth putting on the watchlist early." films={rails.upcoming} />

        <section>
          <SectionHeading title="By decade" subtitle="Pick an era and dig." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {DECADES.map((decade) => (
              <Link
                key={decade}
                href={`/films?decade=${decade}`}
                className="group relative overflow-hidden rounded-md border border-line px-3 py-6 text-center transition-colors hover:border-ember/40"
              >
                <span className="font-display text-2xl transition-colors group-hover:text-ember tabular">
                  {decade}s
                </span>
              </Link>
            ))}
          </div>
        </section>

        {rails.genres.length ? (
          <section>
            <SectionHeading title="By genre" />
            <div className="flex flex-wrap gap-2">
              {rails.genres.map((genre) => (
                <Link
                  key={genre.providerId}
                  href={`/films?genre=${genre.providerId}`}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {reviews.length ? (
          <section>
            <SectionHeading title="Reviews worth reading" />
            <div className="grid gap-6 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <UserChip user={review.author} size="sm" />
                    <div className="flex items-center gap-2">
                      {review.rating ? <Stars value={review.rating} size="sm" /> : null}
                      {review.liked ? <LikeMark className="text-sm text-rose" /> : null}
                    </div>
                  </div>
                  <Link
                    href={`/film/${review.movieSlug}`}
                    className="mt-2.5 inline-block font-medium hover:text-ember"
                  >
                    {review.movieTitle}
                    {review.movieYear ? (
                      <span className="ml-1.5 text-xs text-dim tabular">{review.movieYear}</span>
                    ) : null}
                  </Link>
                  <Link href={`/review/${review.id}`} className="mt-2 block">
                    <ReviewBody
                      text={review.reviewText}
                      containsSpoilers={review.containsSpoilers}
                      clamp={3}
                    />
                  </Link>
                  {review.likeCount > 0 ? (
                    <p className="mt-2 text-xs text-dim">{pluralize(review.likeCount, 'like')}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {lists.length ? (
          <section>
            <SectionHeading title="Lists people are making" />
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
                  author={list.owner}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!user ? (
          <EmptyState
            title="It gets better with people in it"
            description="Create an account to follow people, keep a diary and start a movie club."
            action={
              <Link
                href="/signup"
                className="inline-block rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-soft"
              >
                Join us
              </Link>
            }
          />
        ) : null}
      </div>
    </Container>
  );
}

function Rail({
  title,
  subtitle,
  films,
}: {
  title: string;
  subtitle?: string;
  films: {
    slug: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    caption?: string;
  }[];
}) {
  if (!films.length) return null;
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle} />
      <PosterGrid>
        {films.slice(0, 16).map((film) => (
          <PosterCard
            key={`${film.slug}-${film.title}`}
            film={film}
            footer={
              film.caption ? (
                <p className="mt-0.5 text-[0.6875rem] text-ember">{film.caption}</p>
              ) : null
            }
          />
        ))}
      </PosterGrid>
    </section>
  );
}
