import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubInvitePanel } from '@/components/club/invite-panel';
import { NominatePanel } from '@/components/club/nominate-panel';
import { RoundControls } from '@/components/club/round-controls';
import { ScheduleScreeningForm } from '@/components/club/schedule-screening-form';
import { VotingPanel } from '@/components/club/voting-panel';
import { WheelPanel } from '@/components/club/wheel-panel';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { AvatarStack } from '@/components/user/avatar';
import { ROUND_STATUS_LABELS } from '@/lib/types';
import { formatDateTimeInZone, formatRuntime, pluralize, relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
  getClubIntelligence,
  getClubMembers,
  getClubQueue,
  getClubStats,
  getMembership,
  getRecentlyCompleted,
  getRoundNominations,
  getScreeningAttendance,
  getUpcomingScreening,
} from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';
  const isAdmin = isMember && membership.role !== 'member';

  const [round, upcoming, members, queue, stats, completed, intelligence] = await Promise.all([
    getActiveRound(club.id),
    getUpcomingScreening(club.id),
    getClubMembers(club.id),
    isMember ? getClubQueue(club.id, 8) : Promise.resolve([]),
    getClubStats(club.id),
    getRecentlyCompleted(club.id, 3),
    isMember ? getClubIntelligence(club.id) : Promise.resolve(null),
  ]);

  const nominations = round ? await getRoundNominations(round.id, user?.id ?? null) : null;
  const attendance = upcoming ? await getScreeningAttendance(upcoming.screening.id) : [];
  const going = attendance.filter((a) => a.rsvp === 'going');

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-10">
        {welcome && isAdmin ? (
          <section className="rounded-lg border border-iris/30 bg-iris/[0.07] p-4">
            <p className="font-display text-xl">Your club is live</p>
            <p className="mt-1.5 text-sm text-muted">
              Send the invite link to your group. Once a couple of people are in, open a nomination
              round and let them fight it out.
            </p>
            <div className="mt-3.5">
              <ClubInvitePanel clubId={club.id} inviteCode={club.inviteCode} />
            </div>
          </section>
        ) : null}

        {/* Next up: the single most important thing on this page. */}
        {upcoming ? (
          <section className="overflow-hidden rounded-lg border border-iris/30 bg-iris/[0.05]">
            <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
              <div className="w-24 shrink-0 sm:w-28">
                <Poster
                  film={{
                    slug: upcoming.movie.slug,
                    title: upcoming.movie.title,
                    year: upcoming.movie.year,
                    posterPath: upcoming.movie.posterPath,
                  }}
                  size="md"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-iris">Next movie night</p>
                <h2 className="mt-1 text-2xl leading-tight sm:text-3xl">{upcoming.movie.title}</h2>
                <p className="mt-1 text-sm text-muted tabular">
                  {formatDateTimeInZone(upcoming.screening.scheduledAt, upcoming.screening.timezone)}
                </p>
                {upcoming.screening.location ? (
                  <p className="mt-0.5 text-sm text-muted">{upcoming.screening.location}</p>
                ) : null}
                {upcoming.movie.runtime ? (
                  <p className="mt-0.5 text-xs text-dim">{formatRuntime(upcoming.movie.runtime)}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {going.length ? (
                    <>
                      <AvatarStack users={going} max={6} />
                      <span className="text-xs text-dim">{going.length} going</span>
                    </>
                  ) : (
                    <span className="text-xs text-dim">Nobody has RSVP&apos;d yet</span>
                  )}
                </div>

                <Button asChild variant="iris" size="sm" className="mt-4">
                  <Link href={`/club/${club.slug}/screening/${upcoming.screening.id}`}>
                    Open movie night
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Current decision */}
        {round && nominations ? (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl">
                  {round.title || `Round ${round.roundNumber}`}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {round.mode === 'wheel' && round.status === 'nominations_open'
                    ? 'Submissions open — the wheel decides'
                    : ROUND_STATUS_LABELS[round.status]}
                  {round.status === 'nominations_open' && round.nominationsCloseAt
                    ? ` · closes ${relativeTime(round.nominationsCloseAt)}`
                    : ''}
                  {round.status === 'voting_open' && round.votingCloseAt
                    ? ` · voting ends ${relativeTime(round.votingCloseAt)}`
                    : ''}
                </p>
              </div>
              {isAdmin ? (
                <RoundControls
                  clubId={club.id}
                  clubSlug={club.slug}
                  roundId={round.id}
                  status={round.status}
                  mode={round.mode}
                  nominationCount={nominations.nominations.length}
                />
              ) : null}
            </div>

            {round.status === 'nominations_open' && isMember ? (
              <NominatePanel
                clubId={club.id}
                clubSlug={club.slug}
                roundId={round.id}
                limit={round.nominationLimitPerMember}
                myNominations={
                  nominations.nominations.filter((n) => n.nominatedBy.id === user?.id).length
                }
                nominations={nominations.nominations.map((n) => ({
                  id: n.id,
                  pitch: n.pitch,
                  nominatedBy: n.nominatedBy,
                  movie: {
                    slug: n.movie.slug,
                    title: n.movie.title,
                    year: n.movie.year,
                    posterPath: n.movie.posterPath,
                    runtime: n.movie.runtime,
                  },
                  isMine: n.nominatedBy.id === user?.id,
                }))}
                queue={queue.map((item) => ({
                  movieId: item.movie.id,
                  title: item.movie.title,
                  year: item.movie.year,
                  posterPath: item.movie.posterPath,
                }))}
              />
            ) : null}

            {/* Wheel rounds replace voting entirely: submit, then spin. */}
            {round.mode === 'wheel' &&
            isMember &&
            (round.status === 'nominations_open' ||
              round.status === 'winner_selected' ||
              round.status === 'screening_scheduled') ? (
              <div className="mt-6">
                <WheelPanel
                  clubId={club.id}
                  roundId={round.id}
                  canSpin={round.status === 'nominations_open'}
                  alreadySpunWinnerId={round.winnerNominationId}
                  contenders={nominations.nominations.map((n) => ({
                    nominationId: n.id,
                    pitch: n.pitch,
                    nominatedBy: n.nominatedBy,
                    movie: {
                      slug: n.movie.slug,
                      title: n.movie.title,
                      year: n.movie.year,
                      posterPath: n.movie.posterPath,
                      runtime: n.movie.runtime,
                    },
                  }))}
                />
              </div>
            ) : null}

            {round.mode === 'vote' &&
            (round.status === 'voting_open' ||
              round.status === 'winner_selected' ||
              round.status === 'screening_scheduled') &&
            isMember ? (
              <VotingPanel
                clubId={club.id}
                roundId={round.id}
                status={round.status}
                totalsVisible={nominations.totalsVisible}
                viewerVoted={nominations.viewerVoted}
                memberCount={club.memberCount}
                winnerNominationId={round.winnerNominationId}
                nominations={nominations.nominations.map((n) => ({
                  id: n.id,
                  voteCount: n.voteCount,
                  votedByViewer: n.votedByViewer,
                  pitch: n.pitch,
                  nominatedBy: n.nominatedBy,
                  movie: {
                    slug: n.movie.slug,
                    title: n.movie.title,
                    year: n.movie.year,
                    posterPath: n.movie.posterPath,
                    runtime: n.movie.runtime,
                  },
                }))}
              />
            ) : null}

            {round.status === 'winner_selected' && isAdmin && nominations.nominations.length ? (
              <div className="mt-6 rounded-lg border border-line p-4">
                <p className="eyebrow mb-3">Schedule the night</p>
                <ScheduleScreeningForm
                  clubId={club.id}
                  clubSlug={club.slug}
                  roundId={round.id}
                  timezone={club.timezone}
                  movie={(() => {
                    const winner =
                      nominations.nominations.find((n) => n.id === round.winnerNominationId) ??
                      nominations.nominations[0];
                    return {
                      movieId: winner.movie.id,
                      title: winner.movie.title,
                      year: winner.movie.year,
                      posterPath: winner.movie.posterPath,
                    };
                  })()}
                />
              </div>
            ) : null}
          </section>
        ) : isMember ? (
          <section>
            <SectionHeading title="What are we watching next?" />
            {isAdmin ? (
              <RoundControls
                clubId={club.id}
                clubSlug={club.slug}
                roundId={null}
                status={null}
                nominationCount={0}
              />
            ) : (
              <EmptyState
                title="No round in progress"
                description="An admin can open nominations whenever the group is ready to pick something."
              />
            )}
          </section>
        ) : null}

        {/* Recently watched */}
        {completed.length ? (
          <section>
            <SectionHeading title="Recently watched together" href={`/club/${club.slug}/history`} />
            <ul className="space-y-3">
              {completed.map(({ screening, movie }) => (
                <li key={screening.id}>
                  <Link
                    href={`/club/${club.slug}/screening/${screening.id}`}
                    className="flex items-center gap-3 rounded-md border border-line p-2.5 transition-colors hover:border-line-strong"
                  >
                    <div className="w-11 shrink-0">
                      <Poster
                        film={{
                          slug: movie.slug,
                          title: movie.title,
                          year: movie.year,
                          posterPath: movie.posterPath,
                        }}
                        size="xs"
                        linked={false}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{movie.title}</p>
                      <p className="text-xs text-dim">
                        {screening.completedAt
                          ? formatDateTimeInZone(screening.completedAt, club.timezone)
                          : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {screening.groupRatingCount > 0 ? (
                        <>
                          <p className="font-display text-xl tabular">
                            {(screening.groupRatingSum / screening.groupRatingCount / 2).toFixed(1)}
                          </p>
                          <p className="text-[0.625rem] text-dim">
                            {pluralize(screening.groupRatingCount, 'rating')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-iris">Rate it</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Shared queue preview */}
        {isMember ? (
          <section>
            <SectionHeading
              title="Shared queue"
              subtitle="Anyone can add. The numbers show who already wants it."
              href={`/club/${club.slug}/queue`}
              linkLabel="Manage queue"
            />
            {queue.length ? (
              <PosterGrid density="roomy">
                {queue.slice(0, 5).map((item) => (
                  <PosterCard
                    key={item.id}
                    film={{
                      slug: item.movie.slug,
                      title: item.movie.title,
                      year: item.movie.year,
                      posterPath: item.movie.posterPath,
                    }}
                    footer={
                      <p className="mt-1 text-[0.6875rem] leading-snug text-dim">
                        {item.onWatchlistCount > 0
                          ? `${item.onWatchlistCount} want to see it`
                          : `Added by ${item.addedBy.displayName}`}
                        {item.watchedByCount > 0 ? ` · ${item.watchedByCount} seen` : ''}
                      </p>
                    }
                  />
                ))}
              </PosterGrid>
            ) : (
              <EmptyState
                title="The queue is empty"
                description="Add anything you would happily watch with this group."
                action={
                  <Button asChild variant="outline">
                    <Link href={`/club/${club.slug}/queue`}>Add a film</Link>
                  </Button>
                }
              />
            )}
          </section>
        ) : null}
      </div>

      <aside className="space-y-8">
        {isMember ? <ClubInvitePanel clubId={club.id} inviteCode={club.inviteCode} compact /> : null}

        <section className="rounded-lg border border-line bg-surface/50 p-4">
          <p className="eyebrow">Club record</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">Watched</dt>
              <dd className="font-display text-2xl tabular">{stats.screeningCount}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">Group avg</dt>
              <dd className="font-display text-2xl tabular">
                {stats.averageRating ? (stats.averageRating / 2).toFixed(1) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">Members</dt>
              <dd className="font-display text-2xl tabular">{stats.memberCount}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-dim">Hours</dt>
              <dd className="font-display text-2xl tabular">
                {Math.round(stats.totalRuntimeMinutes / 60) || '—'}
              </dd>
            </div>
          </dl>
          {stats.topRated ? (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Best so far:{' '}
              <Link href={`/film/${stats.topRated.slug}`} className="text-text hover:text-iris">
                {stats.topRated.title}
              </Link>{' '}
              <span className="tabular">({(stats.topRated.rating / 2).toFixed(1)})</span>
            </p>
          ) : null}
        </section>

        {intelligence ? <IntelligencePanel intelligence={intelligence} /> : null}

        <section>
          <SectionHeading
            title={<span className="text-lg">Members</span>}
            href={`/club/${club.slug}/members`}
            className="mb-2.5"
          />
          <ul className="space-y-1.5">
            {members.slice(0, 8).map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/@${member.username}`}
                  className="min-w-0 truncate text-sm text-muted hover:text-iris"
                >
                  {member.displayName}
                </Link>
                {member.role !== 'member' ? (
                  <Badge tone="iris">{member.role}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function IntelligencePanel({
  intelligence,
}: {
  intelligence: {
    onEveryonesRadar: { movie: { id: string; slug: string; title: string }; reason: string }[];
    nobodyHasSeen: { movie: { id: string; slug: string; title: string }; reason: string }[];
    fromTheQueue: { movie: { id: string; slug: string; title: string }; reason: string }[];
  };
}) {
  const sections = [
    { title: 'On everyone’s radar', items: intelligence.onEveryonesRadar },
    { title: 'Nobody has seen', items: intelligence.nobodyHasSeen },
    { title: 'From your queue', items: intelligence.fromTheQueue },
  ].filter((section) => section.items.length);

  if (!sections.length) return null;

  return (
    <section>
      <p className="eyebrow mb-2.5">Ideas for next time</p>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-medium text-muted">{section.title}</p>
            <ul className="mt-1.5 space-y-1">
              {section.items.slice(0, 3).map((item) => (
                <li key={item.movie.id} className="text-sm">
                  <Link href={`/film/${item.movie.slug}`} className="hover:text-iris">
                    {item.movie.title}
                  </Link>
                  <span className="block text-[0.6875rem] text-dim">{item.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
