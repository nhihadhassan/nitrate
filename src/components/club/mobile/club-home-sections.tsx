import Link from 'next/link';

import { Poster, type PosterFilm } from '@/components/film/poster';
import { CalendarIcon, FilmIcon, PlusIcon, SparkIcon } from '@/components/ui/icons';
import { backdropUrl } from '@/lib/images';

/**
 * What sits under the stage card on a phone.
 *
 * The stage card answers "what is happening now"; these answer "what else is
 * worth a tap" — the booked night, the ideas shelf, the club's own history.
 * They are deliberately small and always present for a member, because a club
 * home that collapses to a single card and a stretch of empty page reads as
 * broken rather than calm. Empty states say what the thing is and offer the
 * action that fills it; they never invent content.
 */

export function NextMovieNightCard({
  href,
  film,
  dateLabel,
  location,
  goingCount,
}: {
  href: string;
  film: PosterFilm & { backdropPath?: string | null };
  dateLabel: string;
  location?: string | null;
  goingCount: number;
}) {
  const backdrop = backdropUrl(film.backdropPath, 'sm');
  return (
    <Link
      href={href}
      className="interactive-card relative block overflow-hidden rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
    >
      {backdrop ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-canvas-raised via-canvas-raised/80 to-transparent" />
        </>
      ) : null}
      <div className="relative flex items-center gap-3 p-4">
        <div className="w-12 shrink-0">
          <Poster film={film} size="xs" linked={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-ember" />
            Next movie night
          </p>
          <p className="mt-1 truncate font-display text-xl leading-tight">{dateLabel}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {[location, goingCount ? `${goingCount} going` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** The two shelves, side by side the way a phone can actually fit them. */
export function ClubShelves({
  clubSlug,
  ideas,
  pastNights,
}: {
  clubSlug: string;
  ideas: PosterFilm[];
  pastNights: PosterFilm[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Shelf
        title="Movie Ideas"
        icon={<SparkIcon className="h-3.5 w-3.5 text-ember" />}
        href={`/club/${clubSlug}/queue`}
        films={ideas}
        emptyLabel="Save one for later"
        addLabel="Suggest a movie"
      />
      <Shelf
        title="Past nights"
        icon={<FilmIcon className="h-3.5 w-3.5 text-ember" />}
        href={`/club/${clubSlug}/history`}
        films={pastNights}
        emptyLabel="Nothing watched yet"
      />
    </div>
  );
}

function Shelf({
  title,
  icon,
  href,
  films,
  emptyLabel,
  addLabel,
}: {
  title: string;
  icon?: React.ReactNode;
  href: string;
  films: PosterFilm[];
  emptyLabel: string;
  addLabel?: string;
}) {
  return (
    <section className="rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="eyebrow flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {films.length ? (
          <Link href={href} className="text-[0.6875rem] text-muted hover:text-ember">
            All
          </Link>
        ) : null}
      </div>

      {films.length ? (
        <ul className="mt-2.5 grid grid-cols-3 gap-1.5">
          {films.slice(0, 3).map((film, index) => (
            <li key={`${film.slug}-${index}`}>
              <Poster film={film} size="xs" linked={false} />
            </li>
          ))}
        </ul>
      ) : (
        <Link
          href={href}
          className="mt-2.5 flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-center text-[0.6875rem] text-dim hover:border-ember/50 hover:text-muted"
        >
          {addLabel ? <PlusIcon className="h-4 w-4" /> : null}
          <span className="px-2 leading-tight">{addLabel ?? emptyLabel}</span>
        </Link>
      )}
    </section>
  );
}
