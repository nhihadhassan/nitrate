import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubInvitePanel } from '@/components/club/invite-panel';
import { ClubCurrentHero } from '@/components/club/club-current-hero';
import { ClubPulseWatcher } from '@/components/club/club-pulse';
import { ClubShortlist } from '@/components/club/club-shortlist';
import { NominatePanel } from '@/components/club/nominate-panel';
import { RoundControls } from '@/components/club/round-controls';
import { ScheduleMovieNightSheet } from '@/components/club/schedule-movie-night-sheet';
import { ScreeningPoll } from '@/components/club/screening-poll';
import { VotingPanel } from '@/components/club/voting-panel';
import { WheelPanel } from '@/components/club/wheel-panel';
import { PosterRail } from '@/components/film/poster-rail';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { filmHref } from '@/lib/links';
import { deriveClubDashboardView, resolveClubState } from '@/lib/club';
import { nextSelectionAt, nextSelectionCopy, roundMovieLabel, roundSelectionLabel } from '@/lib/club-cadence';
import { cn, formatDateTimeInZone, relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getWatchlistPreview } from '@/server/services/profile';
import {
  getActiveRound,
  getClubBySlug,
  getClubActivity,
  getClubIntelligence,
  getClubMembers,
  getClubPermissions,
  getLatestRoundStart,
  getClubQueue,
  getClubStats,
  getMembership,
  getRecentlyCompleted,
  getRoundNominations,
  getRoundParticipants,
  getScreeningAttendance,
  getScreeningPoll,
  getUpcomingScreening,
  getWheelRevealState,
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

  const [round, upcoming, members, queue, stats, completed, intelligence, activity, watchlist, latestRoundStart] = await Promise.all([
    getActiveRound(club.id),
    getUpcomingScreening(club.id),
    getClubMembers(club.id),
    isMember ? getClubQueue(club.id, 8) : Promise.resolve([]),
    getClubStats(club.id, user?.id ?? null),
    getRecentlyCompleted(club.id, 3, user?.id ?? null),
    isMember ? getClubIntelligence(club.id) : Promise.resolve(null),
    isMember ? getClubActivity(club.id, 8, user?.id ?? null) : Promise.resolve([]),
    isMember && user ? getWatchlistPreview(user.id, 12) : Promise.resolve([]),
    getLatestRoundStart(club.id),
  ]);

  const nominations = round ? await getRoundNominations(round.id, user?.id ?? null) : null;
  const participants = round ? await getRoundParticipants(round.id) : [];
  const clubPermissions = isMember && user ? await getClubPermissions(club.id, user.id) : new Set();
  const wheelRevealState = round && isMember && user && round.mode === 'wheel' && round.winnerNominationId
    ? await getWheelRevealState(round.id, user.id)
    : null;
  const poll = round && isMember && user ? await getScreeningPoll(round.id, user.id) : null;
  const pickCounts = new Map<string, number>();
  Object.entries(nominations?.memberPickCounts ?? {}).forEach(([memberId, count]) => pickCounts.set(memberId, count));
  const allMembersPicked = Boolean(
    round && participants.some((participant) => participant.participating) && participants.filter((participant) => participant.participating).every((participant) => (pickCounts.get(participant.userId) ?? 0) >= round.nominationLimitPerMember),
  );
  const picksExpired = Boolean(
    round?.status === 'nominations_open' &&
      round.nominationsCloseAt &&
      round.nominationsCloseAt.getTime() <= Date.now(),
  );
  const picksClosed = Boolean(round?.picksClosedAt);
  const canAdvanceFromPicks = allMembersPicked || picksClosed || (picksExpired && (nominations?.nominationCount ?? 0) >= 2);
  const readyMembers = participants.filter((participant) => participant.participating && (pickCounts.get(participant.userId) ?? 0) >= (round?.nominationLimitPerMember ?? 1)).length;
  const currentUserPickCount = nominations?.nominations.filter((nomination) => nomination.nominatedBy.id === user?.id).length ?? 0;
  const attendance = upcoming ? await getScreeningAttendance(upcoming.screening.id) : [];
  const going = attendance.filter((a) => a.rsvp === 'going');
  const selectionMovieLabel = round
    ? roundMovieLabel(club.selectionCadence, round.roundStartAt, club.timezone)
    : null;
  const selectionLabel = round
    ? roundSelectionLabel(club.selectionCadence, round.roundStartAt, club.timezone)
    : null;
  const nextSelectionLabel = latestRoundStart
    ? nextSelectionCopy(nextSelectionAt(club.selectionCadence, latestRoundStart, club.customCadenceDays))
    : null;
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
    awaitingViewerRating: isMember && completed.some((entry) => !entry.viewerRated),
    hasCompletedScreening: completed.length > 0,
    isAdmin,
    pickingOpen: !picksExpired && !picksClosed,
    picksReady: canAdvanceFromPicks,
    hasPicked: Boolean(round && currentUserPickCount >= round.nominationLimitPerMember),
    hasVoted: Boolean(nominations?.viewerVoted),
    hasRsvpd: Boolean(myAttendance?.rsvp),
    pollStatus: poll?.status ?? null,
    hasRespondedToPoll: Boolean(poll?.options.some((option) => option.viewerResponse)),
    pollHasResponses: Boolean(
      poll?.options.some((option) => option.yes + option.maybe + option.no > 0),
    ),
    wheelSpun: Boolean(round?.mode === 'wheel' && round.winnerNominationId),
    wheelRevealed: Boolean(wheelRevealState?.revealed),
  });
  const viewerCanSeeWheelWinner = !round || round.mode !== 'wheel' || !round.winnerNominationId || Boolean(wheelRevealState?.revealed) || clubPermissions.has('edit_movie_night');
  const canEditMovieNight = isMember && clubPermissions.has('edit_movie_night');
  const winner = viewerCanSeeWheelWinner && round?.winnerNominationId
    ? nominations?.nominations.find((nomination) => nomination.id === round.winnerNominationId) ?? null
    : null;
  const dueRating = completed.find((entry) => !entry.viewerRated) ?? null;
  const dashboardView = deriveClubDashboardView({
    isMember,
    isAdmin,
    state,
    roundStatus: round?.status ?? null,
    roundMode: round?.mode ?? null,
    picksReady: canAdvanceFromPicks,
    picksRemaining: round ? Math.max(round.nominationLimitPerMember - currentUserPickCount, 0) : 0,
    readyMembers,
    memberCount: members.length,
    winnerTitle: winner?.movie.title,
    upcomingTitle: viewerCanSeeWheelWinner ? upcoming?.movie.title : null,
    wheelSpun: Boolean(round?.mode === 'wheel' && round.winnerNominationId),
    wheelRevealed: Boolean(wheelRevealState?.revealed),
    selectionMovieLabel: selectionMovieLabel ?? undefined,
    nextSelectionLabel: nextSelectionLabel ?? undefined,
  });
  const heroMovie = (viewerCanSeeWheelWinner ? upcoming?.movie : null) ?? winner?.movie ?? dueRating?.movie ?? null;
  const heroActionHref = dashboardView.kind === 'screening' && upcoming
    ? `/club/${club.slug}/screening/${upcoming.screening.id}`
    : dashboardView.kind === 'reveal' && round
      ? `/club/${club.slug}/reveal/${round.id}`
    : dashboardView.kind === 'rate' && dueRating
      ? `/club/${club.slug}/screening/${dueRating.screening.id}`
      : dashboardView.kind === 'join'
        ? `/join/${club.inviteCode}`
        : dashboardView.actionLabel
          ? '#club-decision'
          : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {isMember ? <ClubPulseWatcher clubId={club.id} /> : null}
      <div className="min-w-0 space-y-10">
        <ClubCurrentHero
          view={dashboardView}
          movie={heroMovie}
          actionHref={heroActionHref}
          dateLabel={viewerCanSeeWheelWinner && upcoming ? formatDateTimeInZone(upcoming.screening.scheduledAt, upcoming.screening.timezone) : null}
          location={viewerCanSeeWheelWinner ? upcoming?.screening.location : null}
          going={going}
        />

        {/* Current decision */}
        {round && nominations ? (
          <section id="club-decision" className="scroll-mt-24">
            {isAdmin || clubPermissions.has('extend_submission_deadline') || clubPermissions.has('start_wheel') ? (
              <div className="mb-4 flex justify-end">
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
                  isAdmin={isAdmin}
                  canExtendDeadline={clubPermissions.has('extend_submission_deadline')}
                  canStartWheel={clubPermissions.has('start_wheel')}
                />
              </div>
            ) : null}

            {round.status === 'nominations_open' && isMember ? (
              <NominatePanel
                clubId={club.id}
                clubSlug={club.slug}
                roundId={round.id}
                mode={round.mode}
                justJoined={welcome === 'joined'}
                viewerId={user?.id ?? null}
                canSubmitForOthers={clubPermissions.has('submit_picks_for_others')}
                participating={participants.find((participant) => participant.userId === user?.id)?.participating ?? true}
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
                  clubSlug={club.slug}
                  roundId={round.id}
                  canSpin={clubPermissions.has('start_wheel') && round.status === 'nominations_open' && canAdvanceFromPicks}
                  allMembersPicked={canAdvanceFromPicks}
                  spun={Boolean(round.winnerNominationId)}
                  selectionMovieLabel={selectionMovieLabel ?? selectionLabel ?? 'This selection’s movie'}
                  contenders={(!round.winnerNominationId || viewerCanSeeWheelWinner) ? nominations.nominations.map((n) => ({
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
                  })) : []}
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

            {round.status === 'winner_selected' && canEditMovieNight && viewerCanSeeWheelWinner && nominations.nominations.length ? (
              <div id="club-schedule" className="mt-6 scroll-mt-24">
                <ScheduleMovieNightSheet
                  clubId={club.id}
                  clubSlug={club.slug}
                  roundId={round.id}
                  timezone={club.timezone}
                  poll={poll ? {
                    ...poll,
                    options: poll.options.map((option) => ({ ...option, startsAt: option.startsAt.toISOString() })),
                  } : null}
                  movie={{
                    movieId: (winner ?? nominations.nominations[0]).movie.id,
                    title: (winner ?? nominations.nominations[0]).movie.title,
                    year: (winner ?? nominations.nominations[0]).movie.year,
                    posterPath: (winner ?? nominations.nominations[0]).movie.posterPath,
                  }}
                />
              </div>
            ) : null}
            {round.status === 'winner_selected' && isMember && !canEditMovieNight && poll ? (
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
            <PosterRail
              label="Recently watched together"
              films={completed.map(({ screening, movie, average, ratingsHidden }) => ({
                ...movie,
                caption: average != null
                  ? `${(average / 2).toFixed(1)} club average`
                  : ratingsHidden ? 'Rate to reveal' : 'Rate it',
                screeningId: screening.id,
              }))}
              showFeedback={false}
              showReason={false}
            />
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
              <PosterRail
                label="Movie Ideas"
                films={queue.slice(0, 12).map((item) => ({
                  ...item.movie,
                  caption: item.onWatchlistCount > 0 ? `${item.onWatchlistCount} want to see it` : `Added by ${item.addedBy.displayName}`,
                }))}
                showFeedback={false}
                showReason={false}
              />
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
              'hidden lg:block',
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
              canInvite={clubPermissions.has('invite_members')}
            />
          </div>
        ) : null}

        {stats.screeningCount >= 3 ? <section className="hidden rounded-lg border border-line bg-surface/50 p-4 lg:block">
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
        </section> : null}

        {intelligence ? (
          <div className="hidden lg:block"><ClubShortlist
            items={intelligence.shortlist.map((item) => ({
              ...item,
              ownedFormats: (shortlistOwnership.get(item.movie.id) ?? []).map((copy: { format: string }) => copy.format.replaceAll('_', ' ')),
            }))}
            clubId={club.id}
            roundId={round?.status === 'nominations_open' ? round.id : null}
            canPick={Boolean(
              isMember && round?.status === 'nominations_open' && !picksExpired && !picksClosed && currentUserPickCount < (round?.nominationLimitPerMember ?? 0),
            )}
          /></div>
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
    club_pick_deadline_extended: 'extended the pick deadline',
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
