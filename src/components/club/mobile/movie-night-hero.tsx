import Link from 'next/link';

import { Poster, type PosterFilm } from '@/components/film/poster';
import { RsvpSegmented } from '@/components/club/mobile/rsvp-segmented';
import { AvatarStack, type AvatarUser } from '@/components/user/avatar';
import { CalendarIcon, UsersIcon } from '@/components/ui/icons';
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
  backdropPath,
  dateLabel,
  location,
  watchLink,
  notes,
  attendees,
  goingCount,
  maybeCount,
  invitedCount,
  viewerRsvp,
  screeningId,
  clubSlug,
  showRsvp,
  awaitingConfirmation,
  inviteLink,
  calendarHref,
  googleCalendarHref,
}: {
  film: PosterFilm;
  backdropPath: string | null;
  dateLabel: string;
  location: string | null;
  watchLink: string | null;
  notes: string | null;
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
  inviteLink: string | null;
  calendarHref: string;
  googleCalendarHref: string;
}) {
  const backdrop = backdropUrl(backdropPath, 'md');

  return (
    <section className="relative -mx-4 overflow-hidden px-4 pb-6 pt-5">
      {backdrop ? (
        <>
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-72 bg-cover bg-center"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-canvas/50 via-canvas/75 to-canvas"
          />
        </>
      ) : null}

      <div className="relative">
        <div className="flex gap-4">
          <div className="w-24 shrink-0">
            <Poster film={film} size="sm" linked={false} priority />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Movie night</p>
            <h1 className="mt-1 font-display text-[1.75rem] leading-[1.1]">{film.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium tabular text-text">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-ember" />
              {dateLabel}
            </p>
            {location ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                {location}
              </p>
            ) : null}
            {inviteLink || watchLink ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {inviteLink ? (
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-iris underline underline-offset-2"
                  >
                    Invite page
                  </a>
                ) : null}
                {watchLink ? (
                  <a
                    href={watchLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-iris underline underline-offset-2"
                  >
                    Watch link
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">{notes}</p>
        ) : null}

        {attendees.length ? (
          <div className="mt-5 flex items-center gap-3">
            <AvatarStack users={attendees} max={6} />
            <span className="text-xs text-dim">
              <span className="text-muted">
                {goingCount} going{maybeCount ? ` · ${maybeCount} maybe` : ''}
              </span>
              <span className="mt-0.5 flex items-center gap-1">
                <UsersIcon className="h-3 w-3" />
                {invitedCount} invited
              </span>
            </span>
          </div>
        ) : null}

        {showRsvp ? (
          <div className="mt-5">
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
