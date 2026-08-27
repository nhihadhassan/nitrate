import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubInvitePanel } from '@/components/club/invite-panel';
import { ClubLoopPreview } from '@/components/club/club-loop-preview';
import { ClubPulseWatcher } from '@/components/club/club-pulse';
import { ClubShortlist } from '@/components/club/club-shortlist';
import { LifecycleStrip } from '@/components/club/lifecycle-strip';
import { NominatePanel } from '@/components/club/nominate-panel';
import { RoundControls } from '@/components/club/round-controls';
import { ScheduleScreeningForm } from '@/components/club/schedule-screening-form';
import { ScreeningPoll } from '@/components/club/screening-poll';
import { VotingPanel } from '@/components/club/voting-panel';
import { WheelPanel } from '@/components/club/wheel-panel';
import { Poster, PosterCard, PosterGrid } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { AvatarStack } from '@/components/user/avatar';
import { filmHref, screeningHref } from '@/lib/links';
import { resolveClubState } from '@/lib/club';
import { ROUND_STATUS_LABELS } from '@/lib/types';
import { cn, formatDateTimeInZone, formatRuntime, pluralize, relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getWatchlistPreview } from '@/server/services/profile';
import {
  getActiveRound,
  getClubBySlug,
  getClubActivity,
  getClubIntelligence,
  getClubMembers,
  getClubQueue,
  getClubStats,
  getMembership,
  getRecentlyCompleted,
  getRoundNominations,
  getScreeningAttendance,
  getScreeningPoll,
  getUpcomingScreening,
} from '@/server/services/clubs';
import { getOwnershipMap } from '@/server/services/ownership';

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

  const [round, upcoming, members, queue, stats, completed, intelligence, activity, watchlist] = await Promise.all([
    getActiveRound(club.id),
    getUpcomingScreening(club.id),
    getClubMembers(club.id),
    isMember ? getClubQueue(club.id, 8) : Promise.resolve([]),
    getClubStats(club.id, user?.id ?? null),
    getRecentlyCompleted(club.id, 3, user?.id ?? null),
    isMember ? getClubIntelligence(club.id) : Promise.resolve(null),
    isMember ? getClubActivity(club.id) : Promise.resolve([]),
    isMember && user ? getWatchlistPreview(user.id, 12) : Promise.resolve([]),
  ]);

  const nominations = round ? await getRoundNominations(round.id, user?.id ?? null) : null;
  const poll = round && isMember && user ? await getScreeningPoll(round.id, user.id) : null;
  const pickCounts = new Map<string, number>();
  Object.entries(nominations?.memberPickCounts ?? {}).forEach(([memberId, count]) => pickCounts.set(memberId, count));
  const allMembersPicked = Boolean(
    round && members.length && members.every((member) => (pickCounts.get(member.id) ?? 0) >= round.nominationLimitPerMember),
  );
  const picksExpired = Boolean(
    round?.status === 'nominations_open' &&
      round.nominationsCloseAt &&
      round.nominationsCloseAt.getTime() <= Date.now(),
  );
  const picksClosed = Boolean(round?.picksClosedAt);
  const canAdvanceFromPicks = allMembersPicked || picksClosed;
  const currentUserPickCount = nominations?.nominations.filter((nomination) => nomination.nominatedBy.id === user?.id).length ?? 0;
  const attendance = upcoming ? await getScreeningAttendance(upcoming.screening.id) : [];
  const going = attendance.filter((a) => a.rsvp === 'going');
  const myAttendance = attendance.find((a) => a.userId === user?.id);
  const shortlistOwnership = user && intelligence
    ? await getOwnershipMap(user.id, intelligence.shortlist.map((item) => item.movie.id))
    : new Map();

  const state = resolveClubState({
    roundStatus: round?.status ?? null,
    roundMode: round?.mode ?? null,
    msUntilScreening: upcoming
      ? upcoming.screening.scheduledAt.getTime() - Date.now()
      : null,
    awaitingViewerRating: isMember && completed.some((entry) => entry.ratingsHidden),
    hasCompletedScreening: completed.length > 0,
    isAdmin,
    pickingOpen: !picksExpired && !picksClosed,
    picksReady: canAdvanceFromPicks,
    hasPicked: Boolean(round && currentUserPickCount >= round.nominationLimitPerMember),
    hasVoted: Boolean(nominations?.viewerVoted),
    hasRsvpd: Boolean(myAttendance?.rsvp),
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {isMember ? <ClubPulseWatcher clubId={club.id} /> : null}
      <div className="min-w-0 space-y-10">
        {/* Where the club is, and whose move it is — before anything else. */}
        {isMember ? (
          <LifecycleStrip stage={state.stage} headline={state.headline} youNeedTo={state.youNeedTo} />
        ) : (
          <section className="rounded-lg border border-line bg-surface/40 p-4">
            <p className="eyebrow mb-1">How this club works</p>
            <p className="mb-3 text-sm text-muted">
              Members save ideas, everyone picks a movie for the round, the wheel or a vote settles it, and the
              club watches, rates and remembers it together.
            </p>
            <ClubLoopPreview compact />
          </section>
        )}

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
            <div className="mb-3 rounded-lg border border-iris/30 bg-iris/[0.045] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-iris">
                  Round {round.roundNumber} ·{' '}
                  {round.status === 'nominations_open'
                    ? picksExpired || picksClosed
                      ? 'Picks closed'
                      : 'Picks open'
                    : ROUND_STATUS_LABELS[round.status]}
                </p>
                <h2 className="mt-1 text-2xl">{round.title || 'Next movie night'}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {round.status === 'nominations_open'
                    ? round.mode === 'wheel'
                      ? 'Everyone picks a movie, then the wheel decides.'
                      : 'Everyone picks a movie, then the group votes.'
                    : round.status === 'voting_open'
                      ? 'The picks are in. Cast your vote.'
                      : round.status === 'winner_selected'
                        ? 'The next movie has been chosen.'
                        : 'The next movie night is taking shape.'}
                  {round.status === 'nominations_open' && round.nominationsCloseAt
                    ? picksExpired || picksClosed
                      ? ` Pick deadline was ${relativeTime(round.nominationsCloseAt)}.`
                      : ` Picks close ${relativeTime(round.nominationsCloseAt)}.`
                    : ''}
                  {round.status === 'voting_open' && round.votingCloseAt
                    ? ` Voting ends ${relativeTime(round.votingCloseAt)}.`
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
                  nominationCount={nominations.nominationCount}
                  allMembersPicked={allMembersPicked}
                  picksExpired={picksExpired}
                  picksClosed={picksClosed}
                />
              ) : null}
              </div>
              {round.status === 'nominations_open' ? (
                <p className="mt-3 text-xs text-muted">
                  {canAdvanceFromPicks
                    ? round.mode === 'wheel'
                      ? 'The wheel is ready. Any club member can spin it.'
                      : 'The picks are ready. An admin can open voting.'
                    : picksExpired
                      ? 'The pick deadline has passed. Waiting for an admin to continue or extend it.'
                      : `${nominations.nominationCount} picks in · ${members.filter((member) => (pickCounts.get(member.id) ?? 0) >= round.nominationLimitPerMember).length} of ${members.length} members ready.`}
                </p>
              ) : round.status === 'voting_open' || round.status === 'winner_selected' ? (
                <p className="mt-3 text-xs text-muted">{state.next}</p>
              ) : null}
            </div>

            {round.status === 'nominations_open' && isMember ? (
              <NominatePanel
                clubId={club.id}
                clubSlug={club.slug}
                roundId={round.id}
                mode={round.mode}
                justJoined={welcome === 'joined'}
                limit={round.nominationLimitPerMember}
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
                members={members.map((member) => ({
                  id: member.id,
                  username: member.username,
                  displayName: member.displayName,
                  avatarAssetId: member.avatarAssetId,
                  pickCount: pickCounts.get(member.id) ?? 0,
                }))}
                queue={queue.map((item) => ({
                  movieId: item.movie.id,
                  title: item.movie.title,
                  year: item.movie.year,
                  posterPath: item.movie.posterPath,
                }))}
                watchlist={watchlist.map((movie) => ({
                  movieId: movie.id,
                  title: movie.title,
                  year: movie.year,
                  posterPath: movie.posterPath,
                }))}
                suggestions={(intelligence?.shortlist ?? []).map((item) => ({
                  movieId: item.movie.id,
                  title: item.movie.title,
                  year: item.movie.year,
                  posterPath: item.movie.posterPath,
                  reasons: item.reasons,
                }))}
                pickingOpen={!picksExpired && !picksClosed}
                showContenders={nominations.contendersVisible}
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
                  canSpin={isMember && round.status === 'nominations_open' && canAdvanceFromPicks}
                  allMembersPicked={canAdvanceFromPicks}
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
              <div className="mt-6 space-y-4">
                <ScreeningPoll
                  clubId={club.id}
                  clubSlug={club.slug}
                  roundId={round.id}
                  timezone={club.timezone}
                  isAdmin={isAdmin}
                  poll={poll ? {
                    ...poll,
                    options: poll.options.map((option) => ({ ...option, startsAt: option.startsAt.toISOString() })),
                  } : null}
                />
                {!poll ? (
                  <div className="rounded-lg border border-line p-4">
                    <p className="eyebrow mb-3">Schedule directly</p>
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
              </div>
            ) : null}
            {round.status === 'winner_selected' && isMember && !isAdmin && poll ? (
              <div className="mt-6">
                <ScreeningPoll
                  clubId={club.id}
                  clubSlug={club.slug}
                  roundId={round.id}
                  timezone={club.timezone}
                  isAdmin={false}
                  poll={{
                    ...poll,
                    options: poll.options.map((option) => ({ ...option, startsAt: option.startsAt.toISOString() })),
                  }}
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
                allMembersPicked={false}
              />
            ) : (
              <EmptyState
                title="No round in progress"
                description="An admin can start choosing whenever the group is ready for its next movie."
              />
            )}
          </section>
        ) : null}

        {/* Recently watched */}
        {completed.length ? (
          <section>
            <SectionHeading title="Recently watched together" href={`/club/${club.slug}/history`} />
            <p className="-mt-3 mb-4 text-xs text-dim">
              <Link href={`/club/${club.slug}/yearbook?year=${new Date().getFullYear()}`} className="underline underline-offset-2 hover:text-iris">
                Open this year&apos;s Club Yearbook
              </Link>
            </p>
            <ul className="space-y-3">
              {completed.map(({ screening, movie, average, ratingsHidden }) => (
                <li key={screening.id}>
                  <Link
                    href={screeningHref(club, screening)}
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
                      {average != null ? (
                        <>
                          <p className="font-display text-xl tabular">{(average / 2).toFixed(1)}</p>
                          <p className="text-[0.625rem] text-dim">
                            {pluralize(screening.groupRatingCount, 'rating')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-iris">
                          {ratingsHidden ? 'Rate to reveal' : 'Rate it'}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Future ideas stay useful without competing with the current round. */}
        {isMember ? (
          <section>
            <SectionHeading
              title="Movie Ideas"
              subtitle="Save movies your group might want to watch in a future round."
              href={`/club/${club.slug}/queue`}
              linkLabel="See all ideas"
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
                title="No movie ideas yet"
                description="Save something the group might want to watch another time."
                action={
                  <Button asChild variant="outline">
                    <Link href={`/club/${club.slug}/queue`}>Save an idea</Link>
                  </Button>
                }
              />
            )}
          </section>
        ) : null}
      </div>

      <aside className="space-y-8">
        {/* A brand-new club used to get a full-width "Your club is live" banner
            above the fold, repeating the invite panel that already lives here.
            The welcome now just adds a line of guidance to the real panel. */}
        {isMember ? (
          <div
            className={cn(
              welcome && isAdmin && 'rounded-lg border border-iris/30 bg-iris/[0.07] p-3.5',
            )}
          >
            {welcome === '1' && isAdmin ? (
              <p className="mb-2.5 text-sm leading-relaxed text-muted">
                <span className="text-text">Your club is live.</span> Send this link to your group,
                then choose the next movie.
              </p>
            ) : null}
            <ClubInvitePanel
              clubId={club.id}
              clubName={club.name}
              inviteCode={club.inviteCode}
              compact
            />
          </div>
        ) : null}

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
          {stats.topGenres.length ? (
            <p className="mt-3.5 border-t border-line pt-3 text-xs text-muted">
              <span className="text-dim">Mostly </span>
              {stats.topGenres
                .slice(0, 3)
                .map((genre) => genre.name.toLowerCase())
                .join(', ')}
            </p>
          ) : null}

          {stats.topRated || stats.mostDivisive ? (
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
              {stats.topRated ? (
                <div>
                  <dt className="text-dim">Best so far</dt>
                  <dd>
                    <Link href={filmHref(stats.topRated)} className="text-text hover:text-iris">
                      {stats.topRated.title}
                    </Link>{' '}
                    <span className="text-muted tabular">
                      ({(stats.topRated.rating / 2).toFixed(1)})
                    </span>
                  </dd>
                </div>
              ) : null}
              {stats.mostDivisive ? (
                <div>
                  <dt className="text-dim">Most divisive</dt>
                  <dd>
                    <Link href={filmHref(stats.mostDivisive)} className="text-text hover:text-iris">
                      {stats.mostDivisive.title}
                    </Link>{' '}
                    <span className="text-muted tabular">
                      ({(stats.mostDivisive.rating / 2).toFixed(1)} avg, ±
                      {((stats.mostDivisive.spread ?? 0) / 2).toFixed(1)})
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>

        {intelligence ? (
          <ClubShortlist
            items={intelligence.shortlist.map((item) => ({
              ...item,
              ownedFormats: (shortlistOwnership.get(item.movie.id) ?? []).map((copy: { format: string }) => copy.format.replaceAll('_', ' ')),
            }))}
            clubId={club.id}
            roundId={round?.status === 'nominations_open' ? round.id : null}
            canPick={Boolean(
              isMember && round?.status === 'nominations_open' && !picksExpired && !picksClosed && currentUserPickCount < (round?.nominationLimitPerMember ?? 0),
            )}
          />
        ) : null}

        {activity.length ? <ClubActivity activity={activity} clubSlug={club.slug} /> : null}

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

function ClubActivity({
  activity,
  clubSlug,
}: {
  clubSlug: string;
  activity: Awaited<ReturnType<typeof getClubActivity>>;
}) {
  const verb: Record<(typeof activity)[number]['type'], string> = {
    club_member_joined: 'joined the club',
    club_movie_picked: 'made their pick',
    club_movie_selected: 'selected',
    club_screening_scheduled: 'scheduled movie night for',
    club_screening_rsvp: 'is going to',
    club_screening_completed: 'finished watching',
    club_rating_submitted: 'rated',
    club_ratings_revealed: 'completed the club average for',
  };
  return (
    <section>
      <SectionHeading title={<span className="text-lg">Club activity</span>} className="mb-2.5" />
      <ul className="space-y-2.5">
        {activity.slice(0, 6).map((item) => (
          <li key={item.id} className="text-xs leading-relaxed text-muted">
            <Link href={`/@${item.actor.username}`} className="font-medium text-text hover:text-iris">
              {item.actor.displayName}
            </Link>{' '}
            {verb[item.type]}
            {!item.hideMovie && item.movie ? (
              <>
                {' '}
                <Link href={filmHref(item.movie)} className="text-text hover:text-iris">{item.movie.title}</Link>
              </>
            ) : null}
            <span className="text-dim"> · {relativeTime(item.createdAt)}</span>
            {item.finalAverage !== null ? (
              <span className="text-dim"> · {(item.finalAverage / 2).toFixed(1)}/5</span>
            ) : null}
          </li>
        ))}
      </ul>
      <Link href={`/club/${clubSlug}/history`} className="mt-3 inline-block text-xs text-muted hover:text-iris">
        See club history
      </Link>
    </section>
  );
}
