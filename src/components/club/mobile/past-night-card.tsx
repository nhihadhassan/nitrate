import Link from 'next/link';

import { Poster, type PosterFilm } from '@/components/film/poster';
import { Stars } from '@/components/film/stars';
import { CommentIcon } from '@/components/ui/icons';
import { AvatarStack, type AvatarUser } from '@/components/user/avatar';
import { backdropUrl } from '@/lib/images';

/**
 * The club's most recent night, given the room it deserves.
 *
 * The rest of the history stays as compact rows — this is the one people
 * actually came back for. Everything on it is recorded: who attended, what the
 * group scored it, whether there is a discussion. No awards, no "all-time
 * favourite", no invented pull-quotes; if the club has not rated it yet the
 * card says so rather than filling the space.
 */
export function FeaturedPastNight({
  href,
  film,
  backdropPath,
  dateLabel,
  attendees,
  attendeeCount,
  average,
  ratingsHidden,
  postCount,
}: {
  href: string;
  film: PosterFilm;
  backdropPath: string | null;
  dateLabel: string;
  attendees: AvatarUser[];
  attendeeCount: number;
  /** Half-star club average, or null while it is still blind or unrated. */
  average: number | null;
  ratingsHidden: boolean;
  postCount: number;
}) {
  const backdrop = backdropUrl(backdropPath, 'sm');

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-canvas-raised">
      {backdrop ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-canvas-raised via-canvas-raised/85 to-canvas-raised/45"
          />
        </>
      ) : null}

      <div className="relative p-4">
        <div className="flex gap-4">
          <div className="w-24 shrink-0">
            <Poster film={film} size="sm" linked={false} priority />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{dateLabel}</p>
            <h3 className="mt-1 font-display text-[1.5rem] leading-[1.1]">
              <Link href={href} className="hover:text-iris">
                {film.title}
              </Link>
            </h3>

            {attendees.length ? (
              <div className="mt-3 flex items-center gap-2">
                <AvatarStack users={attendees} max={5} size="xs" />
                <span className="text-xs text-dim">{attendeeCount} watched</span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-dim">{attendeeCount} watched</p>
            )}

            <div className="mt-2 flex items-center gap-2">
              {average != null ? (
                <>
                  <Stars value={average} size="xs" />
                  <span className="text-xs text-muted tabular">{(average / 2).toFixed(1)}</span>
                </>
              ) : (
                <span className="text-xs text-iris">
                  {ratingsHidden ? 'Rate to reveal' : 'Not rated'}
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          href={href}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line text-sm text-muted hover:border-iris/50 hover:text-text"
        >
          <CommentIcon className="h-4 w-4" />
          {postCount > 0 ? 'View discussion' : 'Open this night'}
        </Link>
      </div>
    </article>
  );
}
