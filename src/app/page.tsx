import Link from 'next/link';

import { FeedCard } from '@/components/feed/feed-card';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { LandingPage } from '@/components/marketing/landing';
import { Button } from '@/components/ui/button';
import { Container, Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getHomeFeed } from '@/server/services/feed';
import { getUserClubs } from '@/server/services/clubs';
import { getWatchlistPreview } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

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

  const [feed, clubs, watchlist] = await Promise.all([
    getHomeFeed(viewer, { scope: feedScope, limit: 30 }),
    getUserClubs(user.id),
    getWatchlistPreview(user.id, 6),
  ]);

  const nextScreening = clubs
    .filter((c) => c.nextScreeningAt)
    .sort((a, b) => new Date(a.nextScreeningAt!).getTime() - new Date(b.nextScreeningAt!).getTime())[0];
  const needsAttention = clubs.filter((c) => c.activeRoundStatus);

  return (
    <Container className="py-6 sm:py-8" size="wide">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="mb-2 flex items-end justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl">
              {feedScope === 'following' ? 'From people you follow' : 'Across Nitrate'}
            </h1>
            <div className="flex shrink-0 rounded-md border border-line p-0.5 text-xs">
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
                    list: item.list,
                    club: item.club,
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
          {nextScreening ? (
            <section className="rounded-lg border border-iris/30 bg-iris/[0.06] p-4">
              <p className="eyebrow text-iris">Next movie night</p>
              <Link
                href={`/club/${nextScreening.club.slug}`}
                className="mt-1.5 block font-display text-lg leading-tight hover:text-iris"
              >
                {nextScreening.club.name}
              </Link>
              <p className="mt-1 text-xs text-muted">
                {new Intl.DateTimeFormat('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: nextScreening.club.timezone,
                }).format(new Date(nextScreening.nextScreeningAt!))}
              </p>
            </section>
          ) : null}

          {needsAttention.length ? (
            <section>
              <p className="eyebrow mb-2.5">Needs your vote</p>
              <ul className="space-y-2">
                {needsAttention.map((club) => (
                  <li key={club.club.id}>
                    <Link
                      href={`/club/${club.club.slug}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 transition-colors hover:border-line-strong"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{club.club.name}</span>
                      <span className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-iris">
                        {club.activeRoundStatus?.replace(/_/g, ' ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionHeading
              title={<span className="text-lg">Your watchlist</span>}
              href="/watchlist"
              className="mb-2.5"
            />
            {watchlist.length ? (
              <PosterGrid density="compact" className="grid-cols-3">
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
              <ul className="space-y-1.5">
                {clubs.slice(0, 6).map((club) => (
                  <li key={club.club.id}>
                    <Link
                      href={`/club/${club.club.slug}`}
                      className="block truncate text-sm text-muted transition-colors hover:text-ember"
                    >
                      {club.club.name}
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
          ? 'rounded-xs bg-surface-strong px-2.5 py-1 font-medium text-text'
          : 'rounded-xs px-2.5 py-1 text-muted transition-colors hover:text-text'
      }
    >
      {children}
    </Link>
  );
}
