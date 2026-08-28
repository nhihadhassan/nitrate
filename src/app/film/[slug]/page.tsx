import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';

import { FilmActions } from '@/components/film/film-actions';
import { ClubFilmAction } from '@/components/club/club-film-action';
import { RecommendationOptionsMenu } from '@/components/discovery/recommendation-options-menu';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { WhereToWatch } from '@/components/film/where-to-watch';
import { OwnershipLibrary } from '@/components/film/ownership-library';
import { AverageRating, LikeMark, RatingHistogram, RatingNumber, Stars } from '@/components/film/stars';
import { ReviewBody } from '@/components/review/review-body';
import { Badge, Container, Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { Avatar, UserChip } from '@/components/user/avatar';
import { backdropUrl, profileUrl } from '@/lib/images';
import { filmHref, personHref, reviewHref, screeningHref, userHref } from '@/lib/links';
import { formatCount, formatDateOnly, formatRuntime, pluralize, relativeTime, truncate } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { ensureMovieDetails, isProviderIdParam, resolveMovie } from '@/server/movies/catalog';
import {
  buildHistogram,
  getFilmCredits,
  getFilmGenres,
  getFilmReviews,
  getFriendContext,
  getListsContaining,
  getRelatedFilms,
  getViewerClubRatings,
  getViewerClubInterest,
} from '@/server/services/film-page';
import { getUserMovieState } from '@/server/services/films';
import { resolveWatchRegion } from '@/server/services/region';
import { getWatchAvailability } from '@/server/movies/watch-providers';
import { getSuppressedRecommendationIds } from '@/server/services/discovery';
import { getOwnershipForMovie } from '@/server/services/ownership';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/**
 * Resolution runs once per request even though both `generateMetadata` and the
 * page need it. Before this was cached and shared, a provider-id URL rendered
 * its document with the title "Film not found" and only then redirected — which
 * is what every shared link and every crawler saw.
 */
const resolve = cache(async (param: string) => resolveMovie(param));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const movie = await resolve(slug);
  if (!movie) return { title: 'Film not found' };

  const title = `${movie.title}${movie.year ? ` (${movie.year})` : ''}`;
  return {
    title,
    description: movie.overview ? truncate(movie.overview, 200) : undefined,
    alternates: { canonical: filmHref(movie) },
    openGraph: {
      title,
      description: movie.overview ?? undefined,
      images: movie.backdropPath ? [backdropUrl(movie.backdropPath, 'md')!] : undefined,
    },
  };
}

export default async function FilmPage({ params }: Params) {
  const { slug } = await params;
  const resolved = await resolve(slug);
  if (!resolved) notFound();

  // Legacy links (and anything pasted from TMDB) settle on the canonical URL.
  // The product itself only ever emits slugs — see `src/lib/links.ts`.
  if (isProviderIdParam(slug) && resolved.slug !== slug) redirect(filmHref(resolved));

  // Hydrate credits on first view; a warm film short-circuits immediately.
  const { movie, degraded } = await ensureMovieDetails(resolved.providerId).catch(() => ({
    movie: resolved,
    degraded: true,
  }));

  const viewer = await getCurrentUser();
  const viewerRef = viewer ? { id: viewer.id, role: viewer.role } : null;
  const region = await resolveWatchRegion(viewer?.watchRegion);

  const [
    credits,
    genres,
    friendContext,
    clubRatings,
    clubInterest,
    reviews,
    containingLists,
    related,
    viewerState,
    availability,
    suppressedMovieIds,
    ownedCopies,
  ] = await Promise.all([
    getFilmCredits(movie.id),
    getFilmGenres(movie.id),
    getFriendContext(viewer?.id ?? null, movie.id),
    getViewerClubRatings(viewer?.id ?? null, movie.id),
    getViewerClubInterest(viewer?.id ?? null, movie.id),
    getFilmReviews(movie.id, viewerRef, { limit: 5 }),
    getListsContaining(movie.id, viewerRef, 4),
    getRelatedFilms(movie, 12),
    viewer ? getUserMovieState(viewer.id, movie.id) : Promise.resolve(null),
    getWatchAvailability(movie.providerId, region).then((r) => r.data),
    viewer ? getSuppressedRecommendationIds(viewer.id, 'movie') : Promise.resolve(new Set<string>()),
    viewer ? getOwnershipForMovie(viewer.id, movie.id) : Promise.resolve([]),
  ]);
  const visibleRelated = related.filter((item) => !suppressedMovieIds.has(item.id));

  const average = movie.ratingCount ? movie.ratingSum / movie.ratingCount : null;
  const histogram = buildHistogram(movie.ratingHistogram, movie.ratingCount);
  const backdrop = backdropUrl(movie.backdropPath, 'md');
  const runtime = formatRuntime(movie.runtime);

  const filmRef = {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
  };

  const actions = (
    <FilmActions
      film={filmRef}
      signedIn={Boolean(viewer)}
      state={
        viewerState
          ? {
              watched: viewerState.watched,
              liked: viewerState.liked,
              rating: viewerState.rating,
              inWatchlist: viewerState.inWatchlist,
              logCount: viewerState.logCount,
            }
          : null
      }
    />
  );

  return (
    <article>
      {/* Backdrop: tall enough to set a mood, faded so text never fights it. */}
      <div className="relative">
        {backdrop ? (
          <div className="cinematic-backdrop absolute inset-x-0 top-0 h-[26rem] overflow-hidden sm:h-[32rem]">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="cinematic-backdrop-media object-cover object-top opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/45 via-canvas/85 to-canvas" />
          </div>
        ) : null}

        <Container className="relative pt-6 sm:pt-12">
          <div className="grid gap-6 md:grid-cols-[15rem_1fr] lg:gap-10">
            <div className="cinematic-hero-poster mx-auto w-40 shrink-0 sm:w-48 md:mx-0 md:w-full">
              <Poster film={filmRef} size="lg" linked={false} priority className="hero-poster" />
              <div className="mt-4 hidden md:block">{actions}</div>
            </div>

            <div className="min-w-0">
              <header data-reveal="hero">
                <h1 className="text-balance text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                  {movie.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
                  {movie.year ? <span className="tabular">{movie.year}</span> : null}
                  {credits.directors.length ? (
                    <span>
                      Directed by{' '}
                      {credits.directors.map((director, index) => (
                        <span key={director.id}>
                          {index > 0 ? ', ' : ''}
                          <Link
                            href={personHref(director)}
                            className="text-text underline-offset-2 hover:text-ember hover:underline"
                          >
                            {director.name}
                          </Link>
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {runtime ? <span className="tabular">{runtime}</span> : null}
                </div>
                {movie.originalTitle && movie.originalTitle !== movie.title ? (
                  <p className="mt-1 text-sm italic text-dim">{movie.originalTitle}</p>
                ) : null}
              </header>

              {/* Your own history with this film, before anyone else's opinion. */}
              {viewerState && (viewerState.watched || viewerState.rating || viewerState.liked || viewerState.inWatchlist) ? (
                <YourStanding
                  watched={viewerState.watched}
                  rating={viewerState.rating}
                  liked={viewerState.liked}
                  inWatchlist={viewerState.inWatchlist}
                  lastWatched={viewerState.lastWatchedDate}
                  logCount={viewerState.logCount}
                />
              ) : null}

              {viewer ? <OwnershipLibrary movieId={movie.id} copies={ownedCopies} /> : null}

              <div className="mt-6 md:hidden">{actions}</div>

              {movie.tagline ? (
                <p className="mt-5 font-display text-lg italic text-muted">“{movie.tagline}”</p>
              ) : null}

              {movie.overview ? (
                <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
                  {movie.overview}
                </p>
              ) : (
                <p className="mt-4 text-sm text-dim">No synopsis available for this film yet.</p>
              )}

              {genres.length ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <Link
                      key={genre.id}
                      href={`/films?genre=${genre.providerId}`}
                      className="rounded-xs border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
                    >
                      {genre.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,17rem)_1fr]">
                <CommunityRating
                  average={average}
                  count={movie.ratingCount}
                  histogram={histogram}
                  watchCount={movie.watchCount}
                  likeCount={movie.likeCount}
                />

                <div className="space-y-6">
                  <WhereToWatch availability={availability} />
                  {clubRatings.length ? <ClubRatings ratings={clubRatings} /> : null}
                  {clubInterest.length ? <ClubInterest interest={clubInterest} movieId={movie.id} /> : null}
                  <FriendsPanel context={friendContext} signedIn={Boolean(viewer)} />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Container className="mt-14 space-y-14 pb-16">
        {degraded ? (
          <p className="rounded-md border border-amber/30 bg-amber/[0.07] px-3 py-2 text-xs text-amber">
            Showing the details we already had — the film database is unreachable right now.
          </p>
        ) : null}

        {credits.cast.length ? (
          <section>
            <SectionHeading title="Cast" />
            <ul className="scroll-rail -mx-4 px-4 sm:mx-0 sm:px-0">
              {credits.cast.map((member) => (
                <li key={member.id} className="scroll-rail-item w-24">
                  <Link href={personHref(member)} className="group block">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-surface">
                      {member.profilePath ? (
                        <Image
                          src={profileUrl(member.profilePath)!}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-dim">
                          —
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium group-hover:text-ember">
                      {member.name}
                    </p>
                    {member.character ? (
                      <p className="truncate text-[0.6875rem] text-dim">{member.character}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            <SectionHeading
              title="Reviews"
              meta={movie.logCount ? `${formatCount(movie.logCount)} logged` : undefined}
            />
            {reviews.length ? (
              <ul className="space-y-5">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <div className="flex items-center justify-between gap-3">
                      <UserChip user={review.author} size="sm" />
                      <div className="flex items-center gap-2">
                        <Stars value={review.rating} size="sm" />
                        {review.liked ? (
                          <LikeMark className="text-sm text-rose" label="Liked this film" />
                        ) : null}
                      </div>
                    </div>
                    <Link href={reviewHref(review)} className="mt-2 block">
                      <ReviewBody
                        text={review.reviewText}
                        containsSpoilers={review.containsSpoilers}
                        clamp={5}
                      />
                    </Link>
                    <div className="mt-2 flex items-center gap-3 text-xs text-dim">
                      <span>{relativeTime(review.createdAt)}</span>
                      {review.isRewatch ? <Badge tone="iris">Rewatch</Badge> : null}
                      {review.likeCount > 0 ? <span>{pluralize(review.likeCount, 'like')}</span> : null}
                      {review.commentCount > 0 ? (
                        <span>{pluralize(review.commentCount, 'comment')}</span>
                      ) : null}
                    </div>
                    <Divider className="mt-5" />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No reviews yet"
                description="Be the first person here to write something about this film."
              />
            )}
          </div>

          <aside className="space-y-8">
            {credits.crew.length ? (
              <div>
                <p className="eyebrow mb-2.5">Crew</p>
                <dl className="space-y-1.5 text-sm">
                  {Object.entries(
                    credits.crew.reduce<Record<string, string[]>>((acc, member) => {
                      const job = member.job ?? 'Crew';
                      (acc[job] ??= []).push(member.name);
                      return acc;
                    }, {}),
                  )
                    .slice(0, 8)
                    .map(([job, names]) => (
                      <div key={job} className="flex gap-2">
                        <dt className="w-28 shrink-0 text-xs text-dim">{job}</dt>
                        <dd className="min-w-0 flex-1 text-[0.8125rem] text-muted">
                          {names.slice(0, 3).join(', ')}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            ) : null}

            {containingLists.length ? (
              <div>
                <p className="eyebrow mb-2.5">Appears in lists</p>
                <ul className="space-y-2.5">
                  {containingLists.map((list) => (
                    <li key={list.id}>
                      <Link
                        href={`/@${list.username}/list/${list.slug}`}
                        className="block text-sm font-medium hover:text-ember"
                      >
                        {list.title}
                      </Link>
                      <p className="text-xs text-dim">
                        {list.displayName} · {pluralize(list.itemCount, 'film')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="eyebrow mb-2.5">Details</p>
              <dl className="space-y-1.5 text-[0.8125rem]">
                {movie.releaseDate ? (
                  <Detail label="Released" value={formatDateOnly(movie.releaseDate)} />
                ) : null}
                {runtime ? <Detail label="Runtime" value={runtime} /> : null}
                {movie.originalLanguage ? (
                  <Detail label="Language" value={movie.originalLanguage.toUpperCase()} />
                ) : null}
                {movie.imdbId ? (
                  <Detail
                    label="IMDb"
                    value={
                      <a
                        href={`https://www.imdb.com/title/${movie.imdbId}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-2 hover:text-ember"
                      >
                        {movie.imdbId}
                      </a>
                    }
                  />
                ) : null}
              </dl>
            </div>
          </aside>
        </section>

        {visibleRelated.length ? (
          <section>
            <SectionHeading title="More like this" />
            <PosterGrid>
              {visibleRelated.map((item) => (
                <PosterCard
                  key={item.id}
                  film={item}
                  overlay={
                    viewer ? (
                      <RecommendationOptionsMenu
                        targetType="movie"
                        targetId={item.id}
                        reasonKind="similar_to_film"
                      />
                    ) : undefined
                  }
                />
              ))}
            </PosterGrid>
          </section>
        ) : null}
      </Container>
    </article>
  );
}

function ClubInterest({
  interest,
  movieId,
}: {
  interest: Awaited<ReturnType<typeof getViewerClubInterest>>;
  movieId: string;
}) {
  return (
    <section className="rounded-lg border border-iris/25 bg-iris/[0.045] p-3.5">
      <p className="eyebrow text-iris">Your clubs</p>
      <ul className="mt-2.5 space-y-2">
        {interest.slice(0, 3).map((club) => (
          <li key={club.clubId} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link href={`/club/${club.slug}`} className="font-medium hover:text-iris">{club.name}</Link>
              <p className="text-xs text-muted">
                {club.wantCount ? `${club.wantCount} want to watch` : 'No one has it saved'}
                {club.seenCount ? ` · ${club.seenCount} seen` : ' · nobody has seen it'}
              </p>
            </div>
            <ClubFilmAction clubId={club.clubId} movieId={movieId} activeRoundId={club.activeRoundId} inIdeas={club.inIdeas} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs text-dim">{label}</dt>
      <dd className="min-w-0 flex-1 text-muted">{value}</dd>
    </div>
  );
}

/**
 * Where the viewer stands with this film, stated plainly at the top. The
 * controls below can toggle it; this line is what you read.
 */
function YourStanding({
  watched,
  rating,
  liked,
  inWatchlist,
  lastWatched,
  logCount,
}: {
  watched: boolean;
  rating: number | null;
  liked: boolean;
  inWatchlist: boolean;
  lastWatched: string | null;
  logCount: number;
}) {
  return (
    <div className="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-surface/70 px-3 py-2 text-sm">
      <span className="eyebrow">You</span>
      {watched ? (
        <span className="text-jade">
          Watched
          {lastWatched ? (
            <span className="ml-1 text-dim">
              {formatDateOnly(lastWatched, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          ) : null}
        </span>
      ) : inWatchlist ? (
        <span className="text-ember">On your watchlist</span>
      ) : null}
      {rating ? <Stars value={rating} size="sm" labelPrefix="You rated this" /> : null}
      {liked ? <LikeMark className="text-sm text-rose" label="You liked this film" /> : null}
      {logCount > 1 ? <span className="text-xs text-dim">Logged {logCount} times</span> : null}
      {watched && inWatchlist ? <span className="text-xs text-dim">Still on your watchlist</span> : null}
    </div>
  );
}

/**
 * Everyone on Nitrate, not any one club. The distinction matters enough to be
 * in the label: a club's own rating lives in its own panel.
 */
function CommunityRating({
  average,
  count,
  histogram,
  watchCount,
  likeCount,
}: {
  average: number | null;
  count: number;
  histogram: { rating: number; count: number; percent: number }[];
  watchCount: number;
  likeCount: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Community rating</p>
          <RatingNumber average={average} className="mt-1 block text-4xl" />
        </div>
        <div className="text-right text-xs text-dim">
          <p>{count ? pluralize(count, 'rating') : 'No ratings'}</p>
          <p>{pluralize(watchCount, 'watch', 'watches')}</p>
          <p>{pluralize(likeCount, 'like')}</p>
        </div>
      </div>

      {count > 0 ? (
        <RatingHistogram buckets={histogram} total={count} className="mt-3.5" />
      ) : (
        <p className="mt-3 text-xs text-dim">
          Ratings from members will appear here as people log this film.
        </p>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <AverageRating average={average} count={count} className="text-sm" />
      </div>
    </div>
  );
}

/** How a club the viewer belongs to rated this on the night they watched it. */
function ClubRatings({
  ratings,
}: {
  ratings: {
    clubId: string;
    name: string;
    slug: string;
    screeningId: string;
    average: number | null;
    count: number;
    watchedOn: Date | null;
    awaitingViewerRating: boolean;
  }[];
}) {
  return (
    <div>
      <p className="eyebrow mb-2.5">Club rating</p>
      <ul className="space-y-2">
        {ratings.map((club) => (
          <li
            key={club.screeningId}
            className="flex items-center justify-between gap-3 rounded-md border border-iris/25 bg-iris/[0.05] px-3 py-2"
          >
            <div className="min-w-0">
              <Link
                href={screeningHref(club, { id: club.screeningId })}
                className="block truncate text-sm font-medium hover:text-iris"
              >
                {club.name}
              </Link>
              <p className="text-[0.6875rem] text-dim">
                {club.watchedOn ? `Watched ${relativeTime(club.watchedOn)}` : 'Watched together'}
                {club.count ? ` · ${pluralize(club.count, 'rating')}` : ''}
              </p>
            </div>
            {club.average != null ? (
              <RatingNumber average={club.average} className="shrink-0 text-xl text-iris" />
            ) : (
              <Link
                href={screeningHref(club, { id: club.screeningId })}
                className="shrink-0 text-right text-xs text-iris"
              >
                {club.awaitingViewerRating ? 'Rate to reveal' : 'Not rated yet'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The people you chose to follow, and what they made of it. Ratings and hearts
 * sit on the row; a review turns the row into something worth clicking.
 */
function FriendsPanel({
  context,
  signedIn,
}: {
  context: {
    friends: {
      id: string;
      username: string;
      displayName: string;
      avatarAssetId: string | null;
      rating: number | null;
      liked: boolean;
      reviewId: string | null;
      reviewExcerpt: string | null;
      reviewHasSpoilers: boolean;
    }[];
    watchedCount: number;
    likedCount: number;
    averageRating: number | null;
  };
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <div>
        <p className="eyebrow mb-2.5">Friends</p>
        <p className="text-sm text-dim">
          <Link href="/signup" className="text-muted underline underline-offset-2 hover:text-ember">
            Create an account
          </Link>{' '}
          to see what the people you follow made of this.
        </p>
      </div>
    );
  }

  if (!context.friends.length) {
    return (
      <div>
        <p className="eyebrow mb-2.5">Friends</p>
        <p className="text-sm text-dim">
          Nobody you follow has logged this yet.{' '}
          <Link
            href="/explore/people"
            className="text-muted underline underline-offset-2 hover:text-ember"
          >
            Find people to follow
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="eyebrow">Friends</p>
        <p className="text-xs text-dim">
          {pluralize(context.watchedCount, 'friend')} watched
          {context.likedCount ? ` · ${context.likedCount} loved it` : ''}
          {context.averageRating != null
            ? ` · averaging ${(context.averageRating / 2).toFixed(1)}`
            : ''}
        </p>
      </div>
      <ul className="space-y-2.5">
        {context.friends.map((friend) => (
          <li key={friend.id}>
            <div className="flex items-center gap-2.5">
              <Avatar user={friend} size="sm" />
              <Link href={userHref(friend)} className="min-w-0 flex-1 truncate text-sm hover:text-ember">
                {friend.displayName}
              </Link>
              <Stars value={friend.rating} size="xs" labelPrefix={`${friend.displayName} rated this`} />
              {friend.liked ? (
                <LikeMark className="text-sm text-rose" label={`${friend.displayName} liked this film`} />
              ) : null}
            </div>
            {friend.reviewId && friend.reviewExcerpt ? (
              <Link
                href={reviewHref({ id: friend.reviewId })}
                className="mt-1 ml-[2.125rem] block text-[0.8125rem] leading-snug text-muted hover:text-text"
              >
                {friend.reviewHasSpoilers
                  ? 'Wrote a review — contains spoilers'
                  : `“${truncate(friend.reviewExcerpt, 110)}”`}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
