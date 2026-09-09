import Link from 'next/link';

import { Poster, type PosterFilm } from '@/components/film/poster';
import { RsvpSegmented } from '@/components/club/mobile/rsvp-segmented';
import { MovieNightDateTrigger } from '@/components/club/movie-night-planner';
import { AvatarStack, type AvatarUser } from '@/components/user/avatar';
import { CalendarIcon } from '@/components/ui/icons';
import { backdropUrl } from '@/lib/images';
import type { RsvpStatus } from '@/lib/types';

/**
 * Movie night as an event page rather than a record.
 *
 * The film's own artwork is the hero, the facts people actually need — when,
 * where, who is coming — sit directly under it, and the RSVP is the first
 * thing your thumb reaches. Everything else about the screening (discussion,
 * ratings, admin) still lives below in the existing page.
 */
export function MovieNightHero({
  film,
  clubName,
  backdropPath,
  dateLabel,
  scheduledAt,
  location,
  attendees,
  goingCount,
  maybeCount,
  invitedCount,
  viewerRsvp,
  screeningId,
  clubSlug,
  showRsvp,
  awaitingConfirmation,
  calendarHref,
  googleCalendarHref,
  canEditDate,
}: {
  film: PosterFilm;
  clubName: string;
  backdropPath: string | null;
  dateLabel: string;
  scheduledAt: string;
  location: string | null;
  attendees: AvatarUser[];
  goingCount: number;
  maybeCount: number;
  invitedCount: number;
  viewerRsvp: RsvpStatus | null;
  screeningId: string;
  clubSlug: string;
  showRsvp: boolean;
  /** The start time has gone by and nobody has marked it watched yet. */
  awaitingConfirmation: boolean;
  calendarHref: string;
  googleCalendarHref: string;
  canEditDate: boolean;
}) {
  const backdrop = backdropUrl(backdropPath, 'md');

  return (
    <section className="relative -mx-4 overflow-hidden px-4 pb-5 pt-4">
      {backdrop ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-canvas/30 via-canvas/65 to-canvas"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-canvas/45 via-transparent to-canvas/20" />
        </>
      ) : null}

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/club/${clubSlug}`}
            className="flex min-h-11 min-w-0 items-center gap-2 rounded-full text-white/90 hover:text-white focus-visible:outline-2 focus-visible:outline-ember"
          >
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-canvas/45 text-2xl backdrop-blur-sm">‹</span>
            <span className="truncate font-display text-xl">{clubName}</span>
          </Link>
        </div>

        <div className="pt-20 sm:pt-28">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-canvas/45 px-3 py-2 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-white/80 backdrop-blur-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-ember" /> Movie night
          </p>
          <h1 className="mt-4 max-w-[20rem] font-display text-[2.65rem] leading-[0.98] text-white drop-shadow-[0_4px_22px_rgb(0_0_0/0.8)]">
            {film.title}
          </h1>
        </div>

        <div className="mt-5 grid grid-cols-[7.25rem_minmax(0,1fr)] items-start gap-5">
          <div className="w-[7.25rem] shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-[0_16px_35px_rgb(0_0_0/0.4)]">
            <Poster film={film} size="md" linked={false} priority />
          </div>
          <div className="min-w-0 pt-2">
            {canEditDate ? (
              <MovieNightDateTrigger
                dateLabel={dateLabel}
                scheduledAt={scheduledAt}
                screeningId={screeningId}
                clubSlug={clubSlug}
                className="flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-md pr-1 text-left text-base font-medium tabular text-white hover:text-ember focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
              />
            ) : (
              <p className="flex items-center gap-2 text-base font-medium tabular text-white">
                <CalendarIcon className="h-4 w-4 shrink-0 text-ember" />
                {dateLabel}
              </p>
            )}
            {location ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-white/75">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-ember" />
                {location}
              </p>
            ) : null}
            {attendees.length ? (
              <div className="mt-4">
                <AvatarStack users={attendees} max={5} />
                <p className="mt-2 text-xs text-white/60">
                  <span className="text-white/85">{goingCount} going{maybeCount ? ` · ${maybeCount} maybe` : ''}</span>
                  {' · '}{invitedCount} invited
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {showRsvp ? (
          <div className="mt-4">
            <RsvpSegmented
              screeningId={screeningId}
              clubSlug={clubSlug}
              current={viewerRsvp}
              goingCount={goingCount}
              maybeCount={maybeCount}
            />
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted">
              <a
                href={googleCalendarHref}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-text"
              >
                Google Calendar
              </a>
              <Link href={calendarHref} className="underline underline-offset-2 hover:text-text">
                Download .ics
              </Link>
            </div>
          </div>
        ) : awaitingConfirmation ? (
          // Not an RSVP and not silence: the night happened, and the page says
          // so where the buttons used to be.
          <p className="mt-5 rounded-full border border-line py-2.5 text-center text-sm text-muted">
            This night has passed
          </p>
        ) : null}
      </div>
    </section>
  );
}
