import type { Metadata } from 'next';
import Link from 'next/link';

import { JoinClubForm } from '@/components/club/join-club-form';
import { Button } from '@/components/ui/button';
import { Badge, Container, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { formatDateTimeInZone, pluralize } from '@/lib/utils';
import { ROUND_STATUS_LABELS, type RoundStatus } from '@/lib/types';
import { getCurrentUser } from '@/server/auth/session';
import { discoverPublicClubs, getUserClubs } from '@/server/services/clubs';

export const metadata: Metadata = {
  title: 'Movie Clubs',
  description: 'Nominate, vote, schedule and discuss films with your friends.',
};
export const dynamic = 'force-dynamic';

export default async function ClubsPage() {
  const user = await getCurrentUser();
  const [mine, publicClubs] = await Promise.all([
    user ? getUserClubs(user.id) : Promise.resolve([]),
    discoverPublicClubs(12),
  ]);

  const mineIds = new Set(mine.map((m) => m.club.id));
  const discoverable = publicClubs.filter((club) => !mineIds.has(club.id));

  return (
    <Container size="wide" className="py-8 pb-20">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-4xl sm:text-5xl">Movie Clubs</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            A shared queue, nominations, blind voting, a scheduled night and a private discussion.
            Everything a group chat is bad at.
          </p>
        </div>
        {user ? (
          <Button asChild variant="iris" size="lg">
            <Link href="/clubs/new">Create a club</Link>
          </Button>
        ) : (
          <Button asChild variant="iris" size="lg">
            <Link href="/signup">Join to start one</Link>
          </Button>
        )}
      </header>

      {user ? (
        <section className="mb-14">
          <SectionHeading title="Your clubs" />
          {mine.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map(({ club, role, nextScreeningAt, activeRoundStatus }) => (
                <li key={club.id}>
                  <Link
                    href={`/club/${club.slug}`}
                    className="flex h-full flex-col rounded-lg border border-line p-4 transition-colors hover:border-iris/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-xl leading-tight">{club.name}</p>
                      {role !== 'member' ? <Badge tone="iris">{role}</Badge> : null}
                    </div>
                    {club.description ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {club.description}
                      </p>
                    ) : null}

                    <div className="mt-auto pt-4">
                      {activeRoundStatus ? (
                        <p className="text-xs font-medium text-iris">
                          {ROUND_STATUS_LABELS[activeRoundStatus as RoundStatus] ?? activeRoundStatus}
                        </p>
                      ) : nextScreeningAt ? (
                        <p className="text-xs text-muted">
                          Next: {formatDateTimeInZone(new Date(nextScreeningAt), club.timezone)}
                        </p>
                      ) : (
                        <p className="text-xs text-dim">Nothing scheduled</p>
                      )}
                      <p className="mt-1 text-xs text-dim">
                        {pluralize(club.memberCount, 'member')} ·{' '}
                        {pluralize(club.screeningCount, 'screening')}
                      </p>
                    </div>
                  </Link>
                </li>
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
        <section className="mb-14 max-w-md">
          <SectionHeading title="Have an invite code?" />
          <JoinClubForm />
        </section>
      ) : null}

      {discoverable.length ? (
        <section>
          <SectionHeading
            title="Public clubs"
            subtitle="Open groups anyone can join. Private clubs stay invisible."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverable.map((club) => (
              <li key={club.id}>
                <Link
                  href={`/club/${club.slug}`}
                  className="block rounded-lg border border-line p-4 transition-colors hover:border-iris/40"
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
      ) : null}
    </Container>
  );
}
