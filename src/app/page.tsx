import type { Metadata } from 'next';
import Link from 'next/link';

import { FeedCard } from '@/components/feed/feed-card';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { PosterRail } from '@/components/film/poster-rail';
import { LandingPage } from '@/components/marketing/landing';
import { RightNow } from '@/components/club/right-now';
import { ClubSummaryCard } from '@/components/club/club-summary-card';
import { TonightFeature } from '@/components/discovery/tonight-feature';
import { Button } from '@/components/ui/button';
import { Container, Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { BRAND } from '@/lib/brand';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getHomeFeed } from '@/server/services/feed';
import { getClubSummaries } from '@/server/services/clubs';
import { getTonightRecommendations } from '@/server/services/discovery';
import { getWatchlistPreview } from '@/server/services/profile';
import { resolveWatchRegion } from '@/server/services/region';
import { getDiaryAnniversaries, getPersonalStats } from '@/server/services/stats';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: BRAND.name },
  description: BRAND.description,
  alternates: { canonical: '/' },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <LandingPage />;

  const { scope } = await searchParams;
  const feedScope = scope === 'everyone' ? 'everyone' : 'following';
  const viewer = { id: user.id, role: user.role };

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const region = await resolveWatchRegion(user.watchRegion);

  const [feed, clubs, watchlist, anniversaries, tonight, monthStats] = await Promise.all([
    getHomeFeed(viewer, { scope: feedScope, limit: 30 }),
    getClubSummaries(user.id),
    getWatchlistPreview(user.id, 6),
    getDiaryAnniversaries(user.id),
    getTonightRecommendations(user.id, region),
    getPersonalStats(user.id, { kind: 'month', year, month }),
  ]);
  const attention = clubs.flatMap((summary) => summary.attention ? [summary.attention] : []);

  const monthLink = `/u/${encodeURIComponent(user.username)}/stats?scope=month&year=${year}&month=${month}`;

  return (
    <Container className="py-6 sm:py-8" size="wide">
      {/* Right now: what needs a decision, when there is one. Nothing here
          when nothing is due — this never renders an empty dashboard. */}
      <RightNow items={attention} />

      {/* Tonight: a real film, not a link explaining a feature exists. */}
      <TonightFeature suggestions={tonight.items} />

      {clubs.length ? (
        <section className="mb-9 border-b border-line pb-8 lg:hidden">
          <SectionHeading title="Your Clubs" href="/clubs" linkLabel="All clubs" />
          <ul className="scroll-rail -mx-4 px-4 pr-10" aria-label="Your Movie Clubs">
            {clubs.slice(0, 4).map((summary) => (
              <li key={summary.club.id} className="scroll-rail-item w-[17rem]">
                <ClubSummaryCard summary={summary} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Your month: a small, honest snapshot — only when there is one. */}
      {monthStats.viewingCount ? (
        <section className="mb-9 border-b border-line pb-8">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="eyebrow">Your month</p>
              <p className="mt-1 text-lg">
                {pluralize(monthStats.viewingCount, 'film')} · {Math.round(monthStats.runtimeMinutes / 60)}h
                {monthStats.averageRating != null
                  ? ` · ${(monthStats.averageRating / 2).toFixed(1)}★ average`
                  : ''}
              </p>
            </div>
            <Link href={monthLink} className="text-xs text-dim transition-colors hover:text-ember">
              View stats →
            </Link>
          </div>
          {monthStats.latestViewings.length ? (
            <div className="mt-3 flex gap-2">
              {monthStats.latestViewings.slice(0, 8).map((film) => (
                <div key={`${film.movieId}-${film.watchedDate ?? ''}`} className="w-11 shrink-0">
                  <Poster film={film} size="xs" />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {anniversaries.length ? (
        <section className="mb-9 border-b border-line pb-8">
          <SectionHeading title="On this day" subtitle="A quiet look back from your diary. Only you see this." />
          <PosterRail
            label="Diary anniversaries"
            films={anniversaries.map((film) => ({ ...film, caption: `${film.yearsAgo} ${film.yearsAgo === 1 ? 'year' : 'years'} ago` }))}
            size="sm"
          />
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="sticky top-14 z-10 -mx-4 mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 bg-canvas/92 px-4 py-2 backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            <h1 className="text-2xl sm:text-3xl">
              {feedScope === 'following' ? 'From people you follow' : `Across ${BRAND.short}`}
            </h1>
            <div className="flex w-full rounded-md border border-line p-0.5 text-xs min-[390px]:w-auto min-[390px]:shrink-0">
              <ScopeTab href="/" active={feedScope === 'following'}>
                Following
              </ScopeTab>
              <ScopeTab href="/?scope=everyone" active={feedScope === 'everyone'}>
                Everyone
              </ScopeTab>
            </div>
          </div>

          {feed.length ? (
            <div className="divide-y divide-line">
              {feed.map((item) => (
                <FeedCard
                  key={item.id}
                  signedIn
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
                    list: item.list,
                    club: item.club,
                    metadata: item.metadata,
                  }}
                />
              ))}
            </div>
          ) : feedScope === 'following' ? (
            <EmptyState
              title="Your feed is waiting on people"
              description="Follow a few people whose taste you trust and their films, reviews and lists will land here."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="primary">
                    <Link href="/explore/people">Find people</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/?scope=everyone">See everyone</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              title="Nothing logged yet"
              description="Be the first — log a film and it will show up right here."
            />
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-20 lg:self-start">
          <section>
            <SectionHeading
              title={<span className="text-lg">Your watchlist</span>}
              href="/watchlist"
              className="mb-2.5"
            />
            {watchlist.length ? (
              <PosterGrid density="sidebar">
                {watchlist.map((movie) => (
                  <PosterCard
                    key={movie.id}
                    film={{
                      slug: movie.slug,
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                    }}
                    size="sm"
                  />
                ))}
              </PosterGrid>
            ) : (
              <p className="text-sm text-dim">
                Nothing saved yet.{' '}
                <Link href="/explore" className="underline underline-offset-2 hover:text-ember">
                  Find something
                </Link>
                .
              </p>
            )}
          </section>

          <Divider />

          <section>
            <p className="eyebrow mb-2.5">Your clubs</p>
            {clubs.length ? (
              <ul className="space-y-2.5">
                {clubs.slice(0, 6).map((summary) => (
                  <li key={summary.club.id}>
                    <Link href={summary.attention?.href ?? `/club/${summary.club.slug}`} className="group block min-w-0">
                      <span className="block truncate text-sm text-muted transition-colors group-hover:text-ember">
                        {summary.club.name}
                      </span>
                      <span className="block text-xs text-dim">{summary.stateLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <p className="text-sm text-dim">
                  Movie night is easier when it runs itself.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2.5">
                  <Link href="/clubs/new">Start a club</Link>
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </Container>
  );
}

function ScopeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'flex min-h-10 flex-1 items-center justify-center rounded-xs bg-surface-strong px-2.5 py-1 font-medium text-text min-[390px]:min-h-0 min-[390px]:flex-none'
          : 'flex min-h-10 flex-1 items-center justify-center rounded-xs px-2.5 py-1 text-muted transition-colors hover:text-text min-[390px]:min-h-0 min-[390px]:flex-none'
      }
    >
      {children}
    </Link>
  );
}
