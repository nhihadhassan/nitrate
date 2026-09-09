import Link from 'next/link';
import { notFound } from 'next/navigation';

import { env } from '@/env';

import { BlindRatings } from '@/components/club/blind-ratings';
import { ClubPulseWatcher } from '@/components/club/club-pulse';
import { DiscussionThread } from '@/components/club/discussion-thread';
import { PostScreeningPanel } from '@/components/club/post-screening-panel';
import { RsvpControls } from '@/components/club/rsvp-controls';
import { MovieNightHero } from '@/components/club/mobile/movie-night-hero';
import { MovieNightDateTrigger, MovieNightPlanner } from '@/components/club/movie-night-planner';
import { ScreeningAdminControls } from '@/components/club/screening-admin-controls';
import { Poster } from '@/components/film/poster';
import { RatingNumber } from '@/components/film/stars';
import { Badge, Divider, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { Avatar } from '@/components/user/avatar';
import { googleCalendarUrl } from '@/lib/calendar';
import { filmHref, userHref } from '@/lib/links';
import { formatClubDateTime, formatRuntime, pluralize, relativeTime } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getMovieById } from '@/server/movies/catalog';
import {
  getClubBySlug,
  getClubPermissions,
  getClubRatings,
  getDiscussion,
  getMembership,
  getScreeningAttendance,
  getScreeningById,
  getScreeningProvenance,
  getViewerScreeningContext,
  getWheelRevealState,
  viewerHasSeenScreeningFilm,
} from '@/server/services/clubs';
import { getUserMovieState } from '@/server/services/films';

export const dynamic = 'force-dynamic';

const SCREENING_STATUS_LABELS: Record<'scheduled' | 'completed' | 'cancelled', string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default async function ScreeningPage({
  params,
}: {
  params: Promise<{ slug: string; screeningId: string }>;
}) {
  const { slug, screeningId } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const screening = await getScreeningById(screeningId).catch(() => null);
  if (!screening || screening.clubId !== club.id) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';
  const isAdmin = isMember && membership.role !== 'member';

  // Screenings are club-private, full stop.
  if (!isMember) {
    return (
      <EmptyState
        title="Members only"
        description="Movie nights and their discussions stay inside the club."
      />
    );
  }

  const provenance = await getScreeningProvenance(screening);
  const wheelReveal = provenance?.mode === 'wheel' && screening.roundId
    ? await getWheelRevealState(screening.roundId, user!.id)
    : null;
  if (provenance?.mode === 'wheel' && wheelReveal && !wheelReveal.revealed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <ClubPulseWatcher clubId={club.id} screeningId={screening.id} />
        <EmptyState
          title="Movie night details are waiting for your reveal"
          description={`The night is planned for ${formatClubDateTime(screening.scheduledAt)}. Reveal the club pick when you’re ready.`}
          action={screening.roundId ? <Link className="text-iris underline underline-offset-2" href={`/club/${club.slug}/reveal/${screening.roundId}`}>Reveal the movie →</Link> : undefined}
        />
      </div>
    );
  }

  const [movie, attendance, ratings, discussion, context, hasSeen, filmState, permissions] =
    await Promise.all([
      getMovieById(screening.movieId),
      getScreeningAttendance(screening.id),
      getClubRatings(screening.id, user!.id),
      getDiscussion(screening.id),
      getViewerScreeningContext(screening, user!.id),
      viewerHasSeenScreeningFilm(screening, user!.id),
      getUserMovieState(user!.id, screening.movieId),
      getClubPermissions(club.id, user!.id),
    ]);

  const going = attendance.filter((a) => a.rsvp === 'going');
  const maybe = attendance.filter((a) => a.rsvp === 'maybe');
  const cant = attendance.filter((a) => a.rsvp === 'cant');
  const attended = attendance.filter((a) => a.attended);
  const isCompleted = screening.status === 'completed';
  const isPast = screening.scheduledAt.getTime() < Date.now();
  const canEditNight = permissions.has('edit_movie_night');
  // "Are you coming?" is a question about a night that has not started. Once
  // the clock passes it the honest question is whether it happened, so the
  // RSVP comes down rather than sitting there collecting answers about an
  // evening that is already over.
  const rsvpOpen = screening.status === 'scheduled' && !isPast;
  const awaitingConfirmation = screening.status === 'scheduled' && isPast;
  const calendarHref = `/club/${club.slug}/screening/${screening.id}/calendar`;
  const googleHref = googleCalendarUrl({
    uid: `screening-${screening.id}@nitrate`,
    title: `${movie.title} — ${club.name}`,
    start: screening.scheduledAt,
    end: new Date(
      screening.scheduledAt.getTime() + (movie.runtime && movie.runtime > 0 ? movie.runtime : 120) * 60_000,
    ),
    description: `${club.name} on Nitrate.\n${env.siteUrl}/club/${club.slug}/screening/${screening.id}`,
    location: screening.location ?? undefined,
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ClubPulseWatcher clubId={club.id} screeningId={screening.id} />
      <div className="min-w-0 space-y-9">
        {/* Phone: the film's artwork carries the event, and the RSVP is the
            first thing in reach. Desktop keeps the existing header below. */}
        <div className="lg:hidden">
          <MovieNightHero
            film={{ slug: movie.slug, title: movie.title, year: movie.year, posterPath: movie.posterPath }}
            clubName={club.name}
            backdropPath={movie.backdropPath}
            dateLabel={formatClubDateTime(screening.scheduledAt)}
            location={screening.location}
            watchLink={screening.watchLink}
            notes={screening.notes}
            attendees={going}
            goingCount={going.length}
            maybeCount={maybe.length}
            invitedCount={attendance.length || going.length}
            viewerRsvp={context.attendance?.rsvp ?? null}
            screeningId={screening.id}
            clubSlug={club.slug}
            showRsvp={rsvpOpen}
            awaitingConfirmation={awaitingConfirmation}
            inviteLink={screening.inviteLink}
            calendarHref={calendarHref}
            googleCalendarHref={googleHref}
            canEditDate={canEditNight && screening.status === 'scheduled'}
          />
        </div>

        <header className="hidden gap-4 sm:gap-5 lg:flex">
          <div className="w-24 shrink-0 sm:w-32">
            <Poster
              film={{
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                posterPath: movie.posterPath,
              }}
              size="md"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isCompleted ? 'jade' : screening.status === 'cancelled' ? 'rose' : 'iris'}>
                {SCREENING_STATUS_LABELS[screening.status]}
              </Badge>
              {provenance ? (
                <Badge>
                  {provenance.mode === 'wheel' ? 'Wheel pick' : 'Voted in'} · round{' '}
                  {provenance.roundNumber}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{movie.title}</h1>
            {canEditNight && screening.status === 'scheduled' ? (
              <MovieNightDateTrigger
                dateLabel={formatClubDateTime(screening.scheduledAt)}
                className="mt-1 flex min-h-10 items-center gap-1.5 rounded-md text-sm text-muted tabular hover:text-ember focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
              />
            ) : (
              <p className="mt-1 text-sm text-muted tabular">
                {formatClubDateTime(screening.scheduledAt)}
              </p>
            )}
            {movie.runtime ? (
              <p className="text-xs text-dim">{formatRuntime(movie.runtime)}</p>
            ) : null}
            {screening.location ? (
              <p className="mt-2 text-sm text-muted">{screening.location}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {screening.inviteLink ? (
                <a
                  href={screening.inviteLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-iris underline underline-offset-2"
                >
                  Invite page
                </a>
              ) : null}
              {screening.watchLink ? (
                <a
                  href={screening.watchLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-iris underline underline-offset-2"
                >
                  Watch link
                </a>
              ) : null}
            </div>
            {screening.notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {screening.notes}
              </p>
            ) : null}
            {provenance ? (
              <p className="mt-3 text-sm text-muted">
                {provenance.nominatedBy ? (
                  <>
                    Picked by{' '}
                    <Link href={userHref(provenance.nominatedBy)} className="text-text hover:text-iris">
                      {provenance.nominatedBy.displayName}
                    </Link>
                  </>
                ) : (
                  'Chosen'
                )}
                {provenance.mode === 'wheel'
                  ? ` — the wheel picked it from ${pluralize(provenance.contenderCount, 'pick')}.`
                  : ` — won with ${pluralize(provenance.voteCount, 'vote')} from ${pluralize(
                      provenance.contenderCount,
                      'pick',
                    )}.`}
              </p>
            ) : null}
            {provenance?.pitch ? (
              <p className="mt-1.5 text-sm italic leading-relaxed text-muted">
                &ldquo;{provenance.pitch}&rdquo;
              </p>
            ) : null}
            <p className="mt-3 text-xs text-dim">
              <Link href={filmHref(movie)} className="hover:text-iris">
                Open the film page →
              </Link>
            </p>
          </div>
        </header>

        {rsvpOpen ? (
          <section className="hidden lg:block">
            <SectionHeading title="Are you coming?" />
            <RsvpControls
              screeningId={screening.id}
              clubSlug={club.slug}
              current={context.attendance?.rsvp ?? null}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <a
                href={googleHref}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-iris"
              >
                Google Calendar
              </a>
              <a href={calendarHref} className="underline underline-offset-2 hover:text-iris">
                Download .ics
              </a>
            </div>
          </section>
        ) : null}

        {/* The night can still move, gain a location, or get an invite page
            after it is booked — the scheduling form used to be a one-way door. */}
        {canEditNight && screening.status === 'scheduled' ? (
          <section>
            <MovieNightPlanner
              screeningId={screening.id}
              clubSlug={club.slug}
              scheduledAt={screening.scheduledAt.toISOString()}
              location={screening.location}
              watchLink={screening.watchLink}
              inviteLink={screening.inviteLink}
              notes={screening.notes}
              isPast={isPast}
            />
          </section>
        ) : null}

        {isCompleted ? (
          <section>
            <SectionHeading title="After the film" />
            <PostScreeningPanel
              screeningId={screening.id}
              clubSlug={club.slug}
              attended={context.attendance?.attended ?? null}
              hasLogged={context.hasLogged}
              film={{
                movieId: movie.id,
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                posterPath: movie.posterPath,
              }}
              personalState={{
                rating: filmState?.rating ?? null,
                liked: filmState?.liked ?? false,
                watched: filmState?.watched ?? false,
              }}
              screeningDate={screening.scheduledAt.toISOString().slice(0, 10)}
            />
          </section>
        ) : awaitingConfirmation && isAdmin ? (
          <section className="rounded-lg border border-iris/30 bg-iris/[0.06] p-4">
            <p className="font-display text-lg">Did this happen?</p>
            <p className="mt-1 text-sm text-muted">
              Marking it complete opens ratings and the discussion, and writes it into club history.
            </p>
            <div className="mt-3">
              <ScreeningAdminControls
                screeningId={screening.id}
                clubSlug={club.slug}
                status={screening.status}
                isPast={isPast}
              />
            </div>
          </section>
        ) : awaitingConfirmation ? (
          <section className="rounded-lg border border-line p-4">
            <p className="font-display text-lg">This night has passed</p>
            <p className="mt-1 text-sm text-muted">
              Ratings and the discussion open once an admin marks it watched.
            </p>
          </section>
        ) : null}

        {isCompleted ? (
          <section>
            <SectionHeading title="Club rating" />
            <BlindRatings
              screeningId={screening.id}
              clubSlug={club.slug}
              revealed={ratings.revealed}
              viewerRating={ratings.viewerRating}
              average={ratings.average}
              count={ratings.count}
              pendingMembers={ratings.pendingMembers}
              spread={ratings.spread}
            />
          </section>
        ) : null}

        <Divider />

        <section>
          <SectionHeading
            title="Discussion"
            subtitle={`Private to ${club.name}.`}
          />
          <DiscussionThread
            clubId={club.id}
            clubSlug={club.slug}
            screeningId={screening.id}
            viewerId={user!.id}
            isAdmin={isAdmin}
            hasSeenFilm={hasSeen}
            movieTitle={movie.title}
            posts={discussion.map((post) => ({
              id: post.id,
              body: post.body,
              containsSpoilers: post.containsSpoilers,
              createdAt: post.createdAt.toISOString(),
              editedAt: post.editedAt?.toISOString() ?? null,
              deletedAt: post.deletedAt?.toISOString() ?? null,
              parentId: post.parentId,
              replyCount: post.replyCount,
              author: post.author,
            }))}
          />
        </section>
      </div>

      <aside className="space-y-8">
        {isAdmin && screening.status !== 'completed' ? (
          <section>
            <p className="eyebrow mb-2.5">Admin</p>
            <ScreeningAdminControls
              screeningId={screening.id}
              clubSlug={club.slug}
              status={screening.status}
              isPast={isPast}
            />
          </section>
        ) : null}

        <section>
          <p className="eyebrow mb-2.5">
            {isCompleted ? 'Who was there' : awaitingConfirmation ? 'Who was coming' : 'Who is coming'}
          </p>
          {isCompleted ? (
            attended.length ? (
              <ul className="space-y-1.5">
                {attended.map((person) => (
                  <li key={person.userId} className="flex items-center gap-2">
                    <Avatar user={person} size="xs" />
                    <Link href={userHref(person)} className="truncate text-sm hover:text-iris">
                      {person.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-dim">Nobody has confirmed attendance yet.</p>
            )
          ) : (
            <div className="space-y-3">
              <RsvpGroup label="Going" people={going} tone="text-jade" />
              <RsvpGroup label="Maybe" people={maybe} tone="text-amber" />
              <RsvpGroup label="Can't make it" people={cant} tone="text-dim" />
              {!going.length && !maybe.length && !cant.length ? (
                <p className="text-sm text-dim">No replies yet.</p>
              ) : null}
            </div>
          )}
        </section>

        {/* Mirrors the blind-rating rule exactly: no score here before you have
            given yours, or the sidebar quietly undoes the whole mechanic. */}
        {isCompleted && ratings.revealed && ratings.average != null ? (
          <section className="rounded-lg border border-line bg-surface/50 p-4 text-center">
            <p className="eyebrow">Group rating</p>
            <RatingNumber average={ratings.average} className="mt-1 block text-4xl" />
            <p className="text-xs text-dim">from {pluralize(ratings.count, 'member')}</p>
          </section>
        ) : null}

        <p className="text-xs text-dim">
          Scheduled {relativeTime(screening.createdAt)} · times shown in Toronto time (ET)
        </p>
      </aside>
    </div>
  );
}

function RsvpGroup({
  label,
  people,
  tone,
}: {
  label: string;
  people: { userId: string; username: string; displayName: string; avatarAssetId: string | null }[];
  tone: string;
}) {
  if (!people.length) return null;
  return (
    <div>
      <p className={`text-[0.6875rem] font-medium uppercase tracking-wide ${tone}`}>
        {label} · {people.length}
      </p>
      <ul className="mt-1 space-y-1">
        {people.map((person) => (
          <li key={person.userId} className="flex items-center gap-2">
            <Avatar user={person} size="xs" />
            <Link href={userHref(person)} className="truncate text-sm hover:text-iris">
              {person.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
