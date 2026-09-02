import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ScreeningPoll } from '@/components/club/screening-poll';
import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading } from '@/components/ui/primitives';
import { formatDateTimeInZone } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getActiveRound, getClubBySlug, getMembership, getScreeningPoll, getUpcomingScreening } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  if (!user || membership?.status !== 'active') {
    return <EmptyState title="Members only" description="Join this club to see its calendar." />;
  }

  const [round, upcoming] = await Promise.all([getActiveRound(club.id), getUpcomingScreening(club.id)]);
  const poll = round ? await getScreeningPoll(round.id, user.id) : null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <SectionHeading title="Club Calendar" subtitle="Movie nights and dates the group is considering." />
        <div className="overflow-hidden rounded-xl border border-line bg-canvas-raised">
          <div className="border-b border-line px-4 py-4 text-center font-display text-xl">
            {first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}
          </div>
          <div className="grid grid-cols-7 border-b border-line text-center text-[0.6875rem] uppercase tracking-wide text-dim">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7" role="grid" aria-label={first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}>
            {cells.map((day, index) => {
              const isToday = day === now.getDate();
              const isScreening = Boolean(day && upcoming && upcoming.screening.scheduledAt.getFullYear() === year && upcoming.screening.scheduledAt.getMonth() === month && upcoming.screening.scheduledAt.getDate() === day);
              return (
                <div key={index} role="gridcell" className="relative aspect-square border-b border-r border-line/70 p-1.5 text-sm last:border-r-0">
                  {day ? <span className={isToday ? 'flex h-7 w-7 items-center justify-center rounded-full bg-iris text-white' : 'text-muted'}>{day}</span> : null}
                  {isScreening ? <span className="absolute inset-x-1 bottom-1 truncate rounded-xs bg-ember/15 px-1 py-0.5 text-[0.6rem] text-ember">Movie night</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        {upcoming ? (
          <section className="overflow-hidden rounded-xl border border-iris/30 bg-iris/[0.05]">
            <div className="flex gap-3 p-3">
              <div className="w-20 shrink-0"><Poster film={upcoming.movie} size="sm" linked={false} /></div>
              <div className="min-w-0">
                <p className="eyebrow text-iris">Next movie night</p>
                <h2 className="mt-1 text-xl leading-tight">{upcoming.movie.title}</h2>
                <p className="mt-1 text-xs text-muted">{formatDateTimeInZone(upcoming.screening.scheduledAt, upcoming.screening.timezone)}</p>
                {upcoming.screening.location ? <p className="mt-1 text-xs text-dim">{upcoming.screening.location}</p> : null}
              </div>
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <Button asChild size="sm" variant="iris"><Link href={`/club/${slug}/screening/${upcoming.screening.id}`}>Open night</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href={`/club/${slug}/screening/${upcoming.screening.id}/calendar`}>Add to calendar</Link></Button>
            </div>
          </section>
        ) : (
          <EmptyState
            title="No date yet"
            description={round?.status === 'winner_selected' ? 'The winning film is ready to schedule.' : 'The next movie night will appear here.'}
            action={round?.status === 'winner_selected' && membership.role !== 'member' ? <Button asChild variant="iris"><Link href={`/club/${slug}`}>Choose a date</Link></Button> : undefined}
          />
        )}

        {round && poll ? (
          <ScreeningPoll
            clubId={club.id}
            clubSlug={club.slug}
            roundId={round.id}
            timezone={club.timezone}
            isAdmin={membership.role !== 'member'}
            poll={{ ...poll, options: poll.options.map((option) => ({ ...option, startsAt: option.startsAt.toISOString() })) }}
          />
        ) : null}
      </aside>
    </div>
  );
}
