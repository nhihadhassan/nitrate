import Image from 'next/image';
import Link from 'next/link';

import { RsvpSegmented } from '@/components/club/mobile/rsvp-segmented';
import { CalendarIcon } from '@/components/ui/icons';
import { Avatar, type AvatarUser } from '@/components/user/avatar';
import { backdropUrl, posterUrl } from '@/lib/images';
import type { RsvpStatus } from '@/lib/types';

/**
 * The booked night, given the whole card.
 *
 * Every other stage of the club loop is a fact and a button; this one is an
 * event, and an event earns its artwork. The film's own poster fills the card,
 * the facts sit on it, and the RSVP is answerable here rather than one tap
 * away on the screening page — the answer people came to give was always
 * "coming" or "can't", and making them navigate for it was the wrong trade.
 *
 * Once the night is behind the club there is nothing to answer, so the RSVP is
 * replaced by what is actually true. See `screeningHasPassed`.
 */
export function MovieNightCard({
  href,
  title,
  posterPath,
  backdropPath,
  dateLabel,
  location,
  attendees,
  goingCount,
  maybeCount,
  extraAttendees,
  viewerRsvp,
  screeningId,
  clubSlug,
  calendarHref,
  hasPassed,
  passedAction,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  dateLabel: string | null;
  location: string | null;
  attendees: AvatarUser[];
  goingCount: number;
  maybeCount: number;
  /** How many more are coming than the stack has room for. */
  extraAttendees: number;
  viewerRsvp: RsvpStatus | null;
  screeningId: string;
  clubSlug: string;
  calendarHref: string;
  hasPassed: boolean;
  /** What to do about a night nobody has confirmed yet, if anything. */
  passedAction: { label: string; href: string } | null;
}) {
  const art = posterUrl(posterPath, 'lg') ?? backdropUrl(backdropPath, 'md');

  return (
    <section
      aria-labelledby="movie-night-title"
      className="relative overflow-hidden rounded-2xl border border-ember/45 bg-canvas-raised"
      style={{ boxShadow: '0 18px 40px -24px color-mix(in srgb, var(--ember) 55%, transparent)' }}
    >
      {/* Artwork, cropped to a shape a phone can hold without scrolling past
          the answer. A 2:3 poster has to lose something at 3:4; it loses it
          from the edges rather than the top, because the subject is in the
          middle and the poster's own printed title is reprinted below anyway.
          The poster is the subject, so it is not blurred. */}
      <Link href={href} className="relative block aspect-[3/4] w-full">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover object-center"
          />
        ) : (
          <span aria-hidden className="absolute inset-0 bg-surface-strong" />
        )}

        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas-raised via-canvas-raised/85 to-transparent"
        />

        <p className="absolute left-4 top-4 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ember">
          Movie night
        </p>

        <span className="absolute inset-x-4 bottom-4">
          <span
            id="movie-night-title"
            className="block font-display text-[1.875rem] leading-[1.05] text-white"
          >
            {title}
          </span>
          {dateLabel ? (
            <span className="mt-1 block text-[0.9375rem] tabular text-white/85">{dateLabel}</span>
          ) : null}
          {location ? (
            <span className="mt-0.5 block truncate text-sm text-white/60">{location}</span>
          ) : null}

          {attendees.length ? (
            <span className="mt-3 flex items-center">
              <span className="flex -space-x-2">
                {attendees.map((person) => (
                  <Avatar
                    key={person.username}
                    user={person}
                    size="sm"
                    className="ring-2 ring-canvas-raised"
                  />
                ))}
              </span>
              {extraAttendees > 0 ? (
                <span className="ml-1.5 flex h-8 min-w-8 items-center justify-center rounded-full border border-line-strong bg-canvas-raised px-2 text-xs tabular text-muted">
                  +{extraAttendees}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </Link>

      {/* The calendar sits outside the poster link so it stays its own target. */}
      {!hasPassed && dateLabel ? (
        <Link
          href={calendarHref}
          aria-label="Add to calendar"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:border-ember/60 focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
        >
          <CalendarIcon className="h-4 w-4" />
        </Link>
      ) : null}

      <div className="p-4 pt-1">
        {hasPassed ? (
          // "Mark it watched" already says the night is behind us, so it does
          // not need a line above it saying the same thing. Only a member who
          // cannot close it needs to be told why there is nothing to press.
          passedAction ? (
            <Link
              href={passedAction.href}
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-white focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
            >
              {passedAction.label}
            </Link>
          ) : (
            <p className="flex min-h-11 items-center justify-center rounded-full border border-line text-sm text-muted">
              This night has passed
            </p>
          )
        ) : (
          <RsvpSegmented
            screeningId={screeningId}
            clubSlug={clubSlug}
            current={viewerRsvp}
            goingCount={goingCount}
            maybeCount={maybeCount}
            variant="overlay"
          />
        )}
      </div>
    </section>
  );
}
