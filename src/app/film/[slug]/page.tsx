import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FilmActions } from '@/components/film/film-actions';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { AverageRating, LikeMark, Stars } from '@/components/film/stars';
import { ReviewBody } from '@/components/review/review-body';
import { Badge, Container, Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { Avatar, UserChip } from '@/components/user/avatar';
import { backdropUrl, profileUrl } from '@/lib/images';
import { formatCount, formatDateOnly, formatRuntime, pluralize, relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { ensureMovieDetails, findMovieBySlug } from '@/server/movies/catalog';
import {
  buildHistogram,
  getFilmCredits,
  getFilmGenres,
  getFilmReviews,
  getFriendActivity,
  getListsContaining,
  getRelatedFilms,
} from '@/server/services/film-page';
import { getUserMovieState } from '@/server/services/films';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const movie = await findMovieBySlug(slug);
  if (!movie) return { title: 'Film not found' };
  return {
    title: `${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
    description: movie.overview ?? undefined,
    openGraph: {
      title: movie.title,
      description: movie.overview ?? undefined,
      images: movie.backdropPath ? [backdropUrl(movie.backdropPath, 'md')!] : undefined,
    },
  };
}

export default async function FilmPage({ params }: Params) {
  const { slug } = await params;
  const existing = await findMovieBySlug(slug);
  if (!existing && !/^\d+$/.test(slug)) notFound();

  // Hydrate credits on first view; a warm film short-circuits immediately.
  const { movie, degraded } = existing
    ? await ensureMovieDetails(existing.providerId).catch(() => ({ movie: existing, degraded: true }))
    : await ensureMovieDetails(slug);

  if (!movie) notFound();

  // Provider-id URLs (search results, discovery rails) settle on the canonical
  // slug once the film has been ingested.
  if (!existing && movie.slug !== slug) redirect(`/film/${movie.slug}`);

  const viewer = await getCurrentUser();
  const viewerRef = viewer ? { id: viewer.id, role: viewer.role } : null;

  const [credits, genres, friends, reviews, containingLists, related, viewerState] = await Promise.all([
    getFilmCredits(movie.id),
    getFilmGenres(movie.id),
    getFriendActivity(viewer?.id ?? null, movie.id),
    getFilmReviews(movie.id, viewerRef, { limit: 5 }),
    getListsContaining(movie.id, viewerRef, 4),
    getRelatedFilms(movie, 12),
    viewer ? getUserMovieState(viewer.id, movie.id) : Promise.resolve(null),
  ]);

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

  return (
    <article>
      {/* Backdrop: tall enough to set a mood, faded so text never fights it. */}
      <div className="relative">
        {backdrop ? (
          <div className="absolute inset-x-0 top-0 h-[26rem] overflow-hidden sm:h-[32rem]">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/45 via-canvas/85 to-canvas" />
          </div>
        ) : null}

        <Container className="relative pt-6 sm:pt-12">
          <div className="grid gap-6 md:grid-cols-[15rem_1fr] lg:gap-10">
            <div className="mx-auto w-40 shrink-0 sm:w-48 md:mx-0 md:w-full">
              <Poster film={filmRef} size="lg" linked={false} priority />
              <div className="mt-4 hidden md:block">
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
              </div>
            </div>

            <div className="min-w-0">
              <header>
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
                            href={`/person/${director.providerId}`}
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

              <div className="mt-6 md:hidden">
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
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,17rem)_1fr]">
                <RatingPanel
                  average={average}
                  count={movie.ratingCount}
                  histogram={histogram}
                  watchCount={movie.watchCount}
                  likeCount={movie.likeCount}
                />
                {friends.length ? (
                  <div>
                    <p className="eyebrow mb-2.5">People you follow</p>
                    <ul className="space-y-2">
                      {friends.map((friend) => (
                        <li key={friend.id} className="flex items-center gap-2.5">
                          <Avatar user={friend} size="sm" />
                          <Link
                            href={`/@${friend.username}`}
                            className="min-w-0 flex-1 truncate text-sm hover:text-ember"
                          >
                            {friend.displayName}
                          </Link>
                          {friend.rating ? <Stars value={friend.rating} size="xs" /> : null}
                          {friend.liked ? <LikeMark className="text-sm text-rose" /> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : viewer ? (
                  <div>
                    <p className="eyebrow mb-2.5">People you follow</p>
                    <p className="text-sm text-dim">
                      Nobody you follow has logged this yet.{' '}
                      <Link href="/explore/people" className="text-muted underline underline-offset-2 hover:text-ember">
                        Find people to follow
                      </Link>
                      .
                    </p>
                  </div>
                ) : null}
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
                  <Link href={`/person/${member.providerId}`} className="group block">
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
              href={`/film/${movie.slug}/reviews`}
              linkLabel={movie.logCount ? `All ${formatCount(movie.logCount)}` : undefined}
            />
            {reviews.length ? (
              <ul className="space-y-5">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <div className="flex items-center justify-between gap-3">
                      <UserChip user={review.author} size="sm" />
                      <div className="flex items-center gap-2">
                        {review.rating ? <Stars value={review.rating} size="sm" /> : null}
                        {review.liked ? <LikeMark className="text-sm text-rose" /> : null}
                      </div>
                    </div>
                    <Link href={`/review/${review.id}`} className="mt-2 block">
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

        {related.length ? (
          <section>
            <SectionHeading title="More like this" />
            <PosterGrid>
              {related.map((item) => (
                <PosterCard
                  key={item.id}
                  film={{
                    slug: item.slug,
                    title: item.title,
                    year: item.year,
                    posterPath: item.posterPath,
                  }}
                />
              ))}
            </PosterGrid>
          </section>
        ) : null}
      </Container>
    </article>
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

function RatingPanel({
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
          <p className="eyebrow">Club rating</p>
          <p className="mt-1 font-display text-4xl leading-none tabular">
            {average ? (average / 2).toFixed(1) : '—'}
          </p>
        </div>
        <div className="text-right text-xs text-dim">
          <p>{count ? pluralize(count, 'rating') : 'No ratings'}</p>
          <p>{pluralize(watchCount, 'watch', 'watches')}</p>
          <p>{pluralize(likeCount, 'like')}</p>
        </div>
      </div>

      {count > 0 ? (
        <div className="mt-3.5">
          {/* Distribution reads left-to-right, half star to five. */}
          <div className="flex h-14 items-end gap-[3px]" role="img" aria-label="Rating distribution">
            {histogram.map((bucket) => (
              <div
                key={bucket.rating}
                className="group relative flex h-full flex-1 items-end"
                title={`${bucket.rating / 2} stars — ${bucket.count}`}
              >
                <div
                  className="w-full rounded-t-[1px] bg-ember/70 transition-colors group-hover:bg-ember"
                  style={{ height: `${Math.max(bucket.percent, bucket.count ? 6 : 2)}%`, minHeight: '2px' }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.625rem] text-dim">
            <span aria-hidden>★</span>
            <span aria-hidden>★★★★★</span>
          </div>
        </div>
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
