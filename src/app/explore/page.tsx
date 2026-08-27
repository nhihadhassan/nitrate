import type { Metadata } from 'next';
import Link from 'next/link';

import { PosterRail } from '@/components/film/poster-rail';
import { LikeMark, Stars } from '@/components/film/stars';
import { ListCard } from '@/components/list/list-card';
import { ReviewBody } from '@/components/review/review-body';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { filmHref, reviewHref } from '@/lib/links';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getPopularLists } from '@/server/services/lists';
import { getSuppressedRecommendationIds } from '@/server/services/discovery';
import {
  getBecauseYouLoved,
  getCommunityTopFilms,
  getEditorialRails,
  getFriendsAreWatching,
  getFriendsLoved,
  getFriendsWantToWatch,
  getPopularWithClubs,
  getFromYourFavouriteGenre,
  getPopularReviews,
  getWatchlistRail,
  type RailFilm,
} from '@/server/services/explore';

export const metadata: Metadata = {
  title: 'Explore',
  description:
    'What the people you follow are watching, what the wider film world is turning over, and a few decades worth digging through.',
};
export const dynamic = 'force-dynamic';

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;

  const [
    rails,
    friendsWatching,
    friendsLoved,
    clubPopular,
    friendsWant,
    watchlist,
    becauseYouLoved,
    favouriteGenre,
    communityTop,
    reviews,
    lists,
    suppressedMovieIds,
  ] = await Promise.all([
    getEditorialRails(),
    user ? getFriendsAreWatching(user.id, 12) : Promise.resolve([]),
    user ? getFriendsLoved(user.id, 12) : Promise.resolve([]),
    user ? getPopularWithClubs(user.id, 12) : Promise.resolve([]),
    user ? getFriendsWantToWatch(user.id, 12) : Promise.resolve([]),
    user ? getWatchlistRail(user.id, 12) : Promise.resolve([]),
    user ? getBecauseYouLoved(user.id, 12) : Promise.resolve(null),
    user ? getFromYourFavouriteGenre(user.id, 12) : Promise.resolve(null),
    getCommunityTopFilms(12),
    getPopularReviews(viewer, 4),
    getPopularLists(viewer, 6),
    user ? getSuppressedRecommendationIds(user.id, 'movie') : Promise.resolve(new Set<string>()),
  ]);

  const visible = (films: RailFilm[]) => films.filter((film) => !suppressedMovieIds.has(film.id));
  const visibleBecause = becauseYouLoved
    ? { ...becauseYouLoved, films: visible(becauseYouLoved.films) }
    : null;
  const visibleFavouriteGenre = favouriteGenre
    ? { ...favouriteGenre, films: visible(favouriteGenre.films) }
    : null;

  const hasSocial = friendsWatching.length > 0 || friendsLoved.length > 0;

  // Whichever rail lands first owns the largest contentful paint, and which one
  // that is depends on who is looking.
  const firstRail = friendsWatching.length
    ? 'friends-watching'
    : friendsLoved.length
      ? 'friends-loved'
      : visibleBecause?.films.length
        ? 'because-you-loved'
        : watchlist.length
          ? 'watchlist'
          : 'trending';

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-10 max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl sm:text-5xl">Explore</h1>
          {user ? <Link href="/tonight" className="flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium hover:border-ember/40">Choose for tonight</Link> : null}
        </div>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          {user
            ? 'What your circle is watching, what the wider film world is turning over, and a few decades worth digging through.'
            : 'What the film world is turning over right now, the films worth the reputation, and a few decades worth digging through.'}
        </p>
      </header>

      <div className="space-y-14">
        {rails.degraded ? (
          <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
            Showing our local catalogue — the film database is unreachable right now.
          </p>
        ) : null}

        {/* Your people: the social layer leads, because it is the reason to be here. */}
        {hasSocial || (visibleBecause?.films.length ?? 0) > 0 || watchlist.length ? (
          <div className="space-y-8">
            <p className="eyebrow">Your people</p>

            <Rail
              title="Friends are watching"
              subtitle="The most-logged films across the people you follow, this month."
              films={visible(friendsWatching)}
              eager={firstRail === 'friends-watching'}
            />

            <Rail
              title="Popular with your clubs"
              subtitle="Movie Ideas your groups are already circling."
              films={visible(clubPopular)}
            />

            <Rail
              title="Friends want to watch"
              subtitle="Watchlist overlap from people who share it publicly."
              films={visible(friendsWant)}
            />

            <Rail
              title="Friends loved"
              subtitle="Films the people you follow gave a heart to, that you have not seen."
              films={visible(friendsLoved)}
              eager={firstRail === 'friends-loved'}
            />

            {visibleBecause?.films.length ? (
              <Rail
                title={`Because you loved ${visibleBecause.seed.title}`}
                subtitle="Neighbours of one of your five-star films."
                films={visibleBecause.films}
                eager={firstRail === 'because-you-loved'}
              />
            ) : null}

            <Rail
              title="On your watchlist"
              subtitle="You already said you would."
              films={visible(watchlist)}
              href="/watchlist"
              linkLabel="Full watchlist"
              eager={firstRail === 'watchlist'}
            />
          </div>
        ) : null}

        {user && !hasSocial ? (
          <EmptyState
            title="Discovery gets much better with people in it"
            description="Follow a few members and this page fills with what they are watching, what they loved and what they are arguing about."
            action={
              <Link
                href="/explore/people"
                className="inline-block rounded-md border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
              >
                Find people to follow
              </Link>
            }
          />
        ) : null}

        {/* The wider film world: generic catalogue browsing, after the social layer. */}
        <div className="space-y-8">
          <p className="eyebrow">The wider film world</p>

          <Rail
            title="Trending this week"
            subtitle="What the wider film world is turning over."
            films={rails.trending}
            eager={firstRail === 'trending'}
          />

          <Rail title="In cinemas now" films={rails.nowPlaying} />

          <Rail
            title="Rated highest here"
            subtitle="By members, weighted so one glowing rating cannot outrank a hundred."
            films={visible(communityTop)}
          />

          <Rail
            title="The canon"
            subtitle="Highly rated by a lot of people — weighted by how many, not just how high."
            films={rails.canon}
          />

          {visibleFavouriteGenre ? (
            <Rail
              title={`More ${visibleFavouriteGenre.genre.toLowerCase()}`}
              subtitle="Your most-watched genre, minus everything you have already seen."
              films={visibleFavouriteGenre.films}
            />
          ) : null}

          <Rail
            title="Coming soon"
            subtitle="Worth putting on the watchlist early."
            films={rails.upcoming}
          />
        </div>

        <div className="space-y-8">
          <p className="eyebrow">Browse</p>

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
        </div>

        {reviews.length || lists.length ? (
          <div className="space-y-8">
            <p className="eyebrow">Worth reading</p>

            {reviews.length ? (
              <section>
                <SectionHeading title="Reviews worth reading" />
                <div className="grid gap-6 md:grid-cols-2">
                  {reviews.map((review) => (
                    <article key={review.id} className="rounded-lg border border-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <UserChip user={review.author} size="sm" />
                        <div className="flex items-center gap-2">
                          <Stars value={review.rating} size="sm" />
                          {review.liked ? (
                            <LikeMark className="text-sm text-rose" label="Liked this film" />
                          ) : null}
                        </div>
                      </div>
                      <Link
                        href={filmHref(review.film)}
                        className="mt-2.5 inline-block font-medium hover:text-ember"
                      >
                        {review.film.title}
                        {review.film.year ? (
                          <span className="ml-1.5 text-xs text-dim tabular">{review.film.year}</span>
                        ) : null}
                      </Link>
                      <Link href={reviewHref(review)} className="mt-2 block">
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
          </div>
        ) : null}

        {!user ? (
          <EmptyState
            title="It gets better with people in it"
            description="Create an account to follow people, keep a diary and start a Movie Club."
            action={
              <Link
                href="/signup"
                className="inline-block rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-soft"
              >
                Join Nitrate
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
  href,
  linkLabel,
  eager,
}: {
  title: string;
  subtitle?: string;
  films: RailFilm[];
  href?: string;
  linkLabel?: string;
  /** The first rail on the page owns the largest contentful paint. */
  eager?: boolean;
}) {
  if (!films.length) return null;
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      <PosterRail label={title} films={films.slice(0, 12)} eager={eager} />
    </section>
  );
}
