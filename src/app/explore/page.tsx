import type { Metadata } from 'next';
import Link from 'next/link';

import { RecommendationOptionsMenu } from '@/components/discovery/recommendation-options-menu';
import { Poster } from '@/components/film/poster';
import { PosterRail } from '@/components/film/poster-rail';
import { LikeMark, Stars } from '@/components/film/stars';
import { ListCard } from '@/components/list/list-card';
import { ReviewBody } from '@/components/review/review-body';
import { JsonLd } from '@/components/seo/json-ld';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { env } from '@/env';
import { organisePersonalDiscovery, type DiscoveryRow } from '@/lib/explore-rails';
import { filmHref, reviewHref } from '@/lib/links';
import { recommendationReasonLabel } from '@/lib/recommendations';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getPopularLists } from '@/server/services/lists';
import { getSuppressedRecommendationIds } from '@/server/services/discovery';
import { getOwnershipMap } from '@/server/services/ownership';
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
  alternates: { canonical: '/explore' },
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
    user ? getFriendsAreWatching(user.id, 20) : Promise.resolve([]),
    user ? getFriendsLoved(user.id, 20) : Promise.resolve([]),
    user ? getPopularWithClubs(user.id, 20) : Promise.resolve([]),
    user ? getFriendsWantToWatch(user.id, 20) : Promise.resolve([]),
    user ? getWatchlistRail(user.id, 20) : Promise.resolve([]),
    user ? getBecauseYouLoved(user.id, 20) : Promise.resolve(null),
    user ? getFromYourFavouriteGenre(user.id, 20) : Promise.resolve(null),
    getCommunityTopFilms(20),
    getPopularReviews(viewer, 4),
    getPopularLists(viewer, 6),
    user ? getSuppressedRecommendationIds(user.id, 'movie') : Promise.resolve(new Set<string>()),
  ]);

  const allRailFilms = [
    ...rails.trending, ...rails.nowPlaying, ...rails.canon, ...rails.upcoming,
    ...friendsWatching, ...friendsLoved, ...clubPopular, ...friendsWant, ...watchlist,
    ...communityTop, ...(becauseYouLoved?.films ?? []), ...(favouriteGenre?.films ?? []),
  ];
  const ownership = user ? await getOwnershipMap(user.id, Array.from(new Set(allRailFilms.map((film) => film.id)))) : new Map();
  for (const film of allRailFilms) if (ownership.has(film.id)) (film as RailFilm & { owned?: boolean }).owned = true;

  const visible = (films: RailFilm[]) => films.filter((film) => !suppressedMovieIds.has(film.id));
  const visibleBecause = becauseYouLoved
    ? { ...becauseYouLoved, films: visible(becauseYouLoved.films) }
    : null;
  const visibleFavouriteGenre = favouriteGenre
    ? { ...favouriteGenre, films: visible(favouriteGenre.films) }
    : null;

  const hasSocial = friendsWatching.length > 0 || friendsLoved.length > 0;
  const personalRows = organisePersonalDiscovery<RailFilm>([
    {
      id: 'friends-watching',
      title: 'Friends are watching',
      subtitle: 'The films turning up across your circle lately.',
      films: visible(friendsWatching),
      priority: 100,
      kind: 'social',
    },
    {
      id: 'because-you-loved',
      title: visibleBecause ? `Because you loved ${visibleBecause.seed.title}` : 'Because you loved it',
      subtitle: 'A way outward from one of your five-star films.',
      films: visibleBecause?.films ?? [],
      priority: 92,
      kind: 'personal',
      showReason: false,
    },
    {
      id: 'friends-loved',
      title: 'Friends loved',
      subtitle: 'Films your friends kept thinking about.',
      films: visible(friendsLoved),
      priority: 84,
      kind: 'social',
    },
    {
      id: 'favourite-genre',
      title: visibleFavouriteGenre ? `More ${visibleFavouriteGenre.genre.toLowerCase()}` : 'More in your favourite genre',
      subtitle: 'Your most-watched genre, minus everything you have already seen.',
      films: visibleFavouriteGenre?.films ?? [],
      priority: 76,
      kind: 'personal',
      showReason: false,
    },
    {
      id: 'club-popular',
      title: 'Around your clubs',
      subtitle: 'Movie Ideas your groups are already circling.',
      films: visible(clubPopular),
      priority: 70,
      kind: 'social',
    },
    {
      id: 'friends-want',
      title: 'Friends want to watch',
      subtitle: 'Watchlist overlap from friends who share it.',
      films: visible(friendsWant),
      priority: 64,
      kind: 'social',
    },
    {
      id: 'watchlist',
      title: 'On your watchlist',
      subtitle: 'You already said you would.',
      films: visible(watchlist),
      priority: 46,
      kind: 'personal',
      href: '/watchlist',
      linkLabel: 'Full watchlist',
      showReason: false,
      showFeedback: false,
    },
  ]);
  const leadingPersonal = personalRows.find((row) => !row.compact && row.films.length >= 6) ?? null;
  const laterPersonal = personalRows.filter((row) => row !== leadingPersonal);
  const firstRail = leadingPersonal?.id ?? 'trending';

  return (
    <Container size="wide" className="py-8 pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Trending films on Nitrate',
          url: new URL('/explore', env.siteUrl).toString(),
          itemListElement: rails.trending.slice(0, 12).map((film, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: film.title,
            url: new URL(filmHref(film), env.siteUrl).toString(),
          })),
        }}
      />
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

      <div className="space-y-12 sm:space-y-14">
        {rails.degraded ? (
          <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
            Showing our local catalogue — the film database is unreachable right now.
          </p>
        ) : null}

        {leadingPersonal ? (
          <PersonalDiscovery row={leadingPersonal} eager={firstRail === leadingPersonal.id} />
        ) : null}

        <Rail
          title="Trending this week"
          subtitle="What the film world is turning over right now."
          films={rails.trending}
          eager={firstRail === 'trending'}
        />

        {user && !hasSocial && personalRows.length === 0 ? (
          <EmptyState
            title="Bring a few trusted people into Explore"
            description="Follow some members and their watches, favourites and public watchlists will start appearing between these shelves."
            action={
              <Link
                href="/explore/people"
                className="inline-block rounded-md border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
              >
                Find people
              </Link>
            }
          />
        ) : null}

        <Rail title="In cinemas now" films={rails.nowPlaying} />

        {reviews[0] ? <ReviewSpotlight review={reviews[0]} /> : null}

        {laterPersonal.map((row) => (
          <PersonalDiscovery key={row.id} row={row} />
        ))}

        <Rail
          title="Rated highest here"
          subtitle="Member ratings, weighted so one glowing score cannot outrank a crowd."
          films={visible(communityTop)}
        />

        <Rail
          title="The canon"
          subtitle="Highly rated by a lot of people, not just a perfect score from a handful."
          films={rails.canon}
        />

        {lists[0] ? (
          <section className="max-w-2xl border-y border-line py-7">
            <SectionHeading title="A list worth opening" />
            <ListCard
              list={{
                id: lists[0].id,
                title: lists[0].title,
                description: lists[0].description,
                itemCount: lists[0].itemCount,
                likeCount: lists[0].likeCount,
                isRanked: lists[0].isRanked,
                visibility: lists[0].visibility,
                covers: lists[0].covers,
              }}
              author={lists[0].owner}
            />
          </section>
        ) : null}

        <Rail
          title="Coming soon"
          subtitle="Worth putting on the watchlist early."
          films={rails.upcoming}
        />

        <div className="space-y-8 border-t border-line pt-10">

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

        {reviews.length > 1 || lists.length > 1 ? (
          <div className="space-y-8">
            {reviews.length > 1 ? (
              <section>
                <SectionHeading title="More reviews worth reading" />
                <div className="grid gap-6 md:grid-cols-2">
                  {reviews.slice(1).map((review) => (
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

            {lists.length > 1 ? (
              <section>
                <SectionHeading title="Lists people are making" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {lists.slice(1).map((list) => (
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

function PersonalDiscovery({
  row,
  eager,
}: {
  row: DiscoveryRow<RailFilm>;
  eager?: boolean;
}) {
  if (!row.compact) {
    return (
      <Rail
        title={row.title}
        subtitle={row.subtitle}
        films={row.films}
        href={row.href}
        linkLabel={row.linkLabel}
        eager={eager}
        showReason={row.showReason}
        showFeedback={row.showFeedback}
      />
    );
  }

  return (
    <section className="max-w-2xl">
      <SectionHeading title={row.title} subtitle={row.subtitle} />
      <ul role="list" className="flex flex-wrap gap-3">
        {row.films.map((film, index) => (
          <li key={film.id ?? film.slug} className="w-28 sm:w-32">
            <Poster
              film={film}
              priority={eager && index < 3}
              overlay={
                row.showFeedback !== false && film.reason && film.id ? (
                  <RecommendationOptionsMenu
                    targetType="movie"
                    targetId={film.id}
                    reasonKind={film.reason.kind}
                  />
                ) : undefined
              }
            />
            <p className="mt-1.5 truncate text-[0.8125rem] font-medium">{film.title}</p>
            <p className="truncate text-[0.6875rem] text-dim">
              {film.year ?? ''}
              {row.showReason !== false && film.reason ? (
                <span className="ml-1 text-ember">{recommendationReasonLabel(film.reason)}</span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewSpotlight({
  review,
}: {
  review: Awaited<ReturnType<typeof getPopularReviews>>[number];
}) {
  return (
    <article className="max-w-3xl border-y border-line py-7">
      <p className="eyebrow">A review gaining attention</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <UserChip user={review.author} size="sm" />
        <div className="flex items-center gap-2">
          <Stars value={review.rating} size="sm" />
          {review.liked ? <LikeMark className="text-sm text-rose" label="Liked this film" /> : null}
        </div>
      </div>
      <Link href={filmHref(review.film)} className="mt-4 inline-block text-xl hover:text-ember">
        {review.film.title}
        {review.film.year ? <span className="ml-2 text-sm text-dim tabular">{review.film.year}</span> : null}
      </Link>
      <Link href={reviewHref(review)} className="mt-2 block max-w-2xl">
        <ReviewBody text={review.reviewText} containsSpoilers={review.containsSpoilers} clamp={4} />
      </Link>
      {review.likeCount > 0 ? (
        <p className="mt-2 text-xs text-dim">{pluralize(review.likeCount, 'like')}</p>
      ) : null}
    </article>
  );
}

function Rail({
  title,
  subtitle,
  films,
  href,
  linkLabel,
  eager,
  showReason = true,
  showFeedback = true,
}: {
  title: string;
  subtitle?: string;
  films: RailFilm[];
  href?: string;
  linkLabel?: string;
  /** The first rail on the page owns the largest contentful paint. */
  eager?: boolean;
  /** False when the heading already says why — see `PosterRail`. */
  showReason?: boolean;
  showFeedback?: boolean;
}) {
  if (!films.length) return null;
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      <PosterRail
        label={title}
        films={films}
        eager={eager}
        showReason={showReason}
        showFeedback={showFeedback}
      />
    </section>
  );
}
