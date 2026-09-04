import type { Metadata } from 'next';
import Link from 'next/link';

import { JoinClubForm } from '@/components/club/join-club-form';
import { ClubLoopPreview } from '@/components/club/club-loop-preview';
import { ClubSummaryCard } from '@/components/club/club-summary-card';
import { Button } from '@/components/ui/button';
import { Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { discoverPublicClubs, getClubSummaries } from '@/server/services/clubs';

export const metadata: Metadata = {
  title: 'Movie Clubs',
  description: 'Pick, vote, schedule and discuss movies with your friends.',
  alternates: { canonical: '/clubs' },
};
export const dynamic = 'force-dynamic';

export default async function ClubsPage() {
  const user = await getCurrentUser();
  const [mine, publicClubs] = await Promise.all([
    user ? getClubSummaries(user.id) : Promise.resolve([]),
    discoverPublicClubs(12),
  ]);

  const mineIds = new Set(mine.map((m) => m.club.id));
  const discoverable = publicClubs.filter((club) => !mineIds.has(club.id));

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="eyebrow text-iris">Movie Clubs</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">{user ? 'Your Clubs' : 'Movie night, together.'}</h1>
          {!user ? <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">Pick, plan and remember films with friends.</p> : null}
        </div>
        {user ? (
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="#join-club">Enter invite</Link></Button>
            <Button asChild variant="iris"><Link href="/clubs/new">New club</Link></Button>
          </div>
        ) : (
          <Button asChild variant="iris" size="lg">
            <Link href="/signup">Join to start one</Link>
          </Button>
        )}
      </header>

      {!user ? <section className="mb-14"><p className="eyebrow mb-3 text-iris">How it works</p><ClubLoopPreview /></section> : null}

      {user ? (
        <section className="mb-14">
          {mine.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((summary) => (
                <li key={summary.club.id}><ClubSummaryCard summary={summary} /></li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No clubs yet"
              description="Start one and send the invite link to the group chat. It takes about thirty seconds."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="iris">
                    <Link href="/clubs/new">Create a club</Link>
                  </Button>
                </div>
              }
            />
          )}
        </section>
      ) : null}

      {user ? (
        <section id="join-club" className="mb-14 max-w-md scroll-mt-24">
          <SectionHeading title="Enter an invite" />
          <JoinClubForm />
        </section>
      ) : null}

      {discoverable.length ? (
        <section className="mb-14">
          <SectionHeading
            title="Public clubs"
            subtitle="Open groups anyone can join. Private clubs stay invisible."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverable.map((club) => (
              <li key={club.id}>
                <Link
                  href={`/club/${club.slug}`}
                  className="interactive-card club-card block rounded-lg border border-line p-4 hover:border-iris/40"
                  data-pointer-light
                  data-reveal="card"
                >
                  <p className="font-display text-xl leading-tight">{club.name}</p>
                  {club.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                      {club.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-dim">
                    {pluralize(club.memberCount, 'member')} ·{' '}
                    {pluralize(club.screeningCount, 'screening')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : !user ? (
        <EmptyState
          title="Most clubs run privately"
          description="Public clubs are the exception — most groups keep theirs invisible to outsiders by design. Create an account and start one with your own friends instead."
          action={
            <Button asChild variant="iris">
              <Link href="/signup">Join to start one</Link>
            </Button>
          }
        />
      ) : null}

      {user ? (
        <section className="border-t border-line pt-5" aria-labelledby="club-loop-heading">
          <h2 id="club-loop-heading" className="text-sm text-muted">How Movie Clubs work</h2>
          <div className="mt-4"><ClubLoopPreview /></div>
        </section>
      ) : null}
    </Container>
  );
}
