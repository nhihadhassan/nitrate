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
  calendarHref,
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
  calendarHref: string;
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
            {watchLink ? (
              <a
                href={watchLink}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-block text-sm text-iris underline underline-offset-2"
              >
                Watch link
              </a>
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
            <Link
              href={calendarHref}
              className="mt-3 block text-center text-xs text-muted underline underline-offset-2 hover:text-text"
            >
              Add to calendar
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
