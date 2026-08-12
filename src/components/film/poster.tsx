import Link from 'next/link';

import { PosterMedia } from '@/components/film/poster-media';
import { posterUrl, type PosterSize } from '@/lib/images';
import { filmHref } from '@/lib/links';
import { cn } from '@/lib/utils';

/**
 * Structurally a `FilmRef` minus the id: some surfaces (club queue rows, list
 * items) legitimately have only the display fields. `slug` is always canonical
 * — see `src/lib/links.ts`.
 */
export type PosterFilm = {
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

const SIZE_HINTS: Record<PosterSize, string> = {
  xs: '46px',
  sm: '80px',
  md: '(max-width: 640px) 30vw, 160px',
  lg: '(max-width: 640px) 44vw, 230px',
  xl: '(max-width: 768px) 60vw, 320px',
};

/**
 * The atom the entire product is built from. Renders a real poster when we have
 * one and a typeset fallback when we do not — never a broken image, never a grey
 * box with no information in it.
 */
export function Poster({
  film,
  size = 'md',
  className,
  priority,
  linked = true,
  overlay,
  ariaHidden,
}: {
  film: PosterFilm;
  size?: PosterSize;
  className?: string;
  priority?: boolean;
  linked?: boolean;
  overlay?: React.ReactNode;
  ariaHidden?: boolean;
}) {
  const url = posterUrl(film.posterPath, size);

  const inner = (
    <span
      className={cn('poster-frame premium-poster group block', className)}
      data-poster-depth
      data-pointer-light
    >
      {url ? (
        <PosterMedia src={url} sizes={SIZE_HINTS[size]} priority={priority} />
      ) : (
        <span className="flex h-full w-full flex-col justify-end gap-1 p-2">
          <span className="font-display text-[0.9375rem] leading-tight text-text/90 line-clamp-4">
            {film.title}
          </span>
          {film.year ? <span className="text-[0.6875rem] text-dim tabular">{film.year}</span> : null}
        </span>
      )}
      {overlay}
    </span>
  );

  if (!linked) return inner;

  return (
    <Link
      href={filmHref(film)}
      aria-hidden={ariaHidden}
      tabIndex={ariaHidden ? -1 : undefined}
      aria-label={`${film.title}${film.year ? ` (${film.year})` : ''}`}
      className="block rounded-sm focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
    >
      {inner}
    </Link>
  );
}

/** Poster plus title/year caption, for grids where text genuinely helps. */
export function PosterCard({
  film,
  size = 'md',
  footer,
  className,
  priority,
}: {
  film: PosterFilm;
  size?: PosterSize;
  footer?: React.ReactNode;
  className?: string;
  /** Set on the handful of cards above the fold so the LCP image is not lazy. */
  priority?: boolean;
}) {
  return (
    <div className={cn('poster-card min-w-0', className)}>
      <Poster film={film} size={size} priority={priority} />
      <div className="mt-1.5 min-w-0">
        <Link
          href={filmHref(film)}
          className="block truncate text-[0.8125rem] font-medium leading-snug hover:text-ember"
        >
          {film.title}
        </Link>
        {film.year ? <p className="text-[0.6875rem] text-dim tabular">{film.year}</p> : null}
        {footer}
      </div>
    </div>
  );
}

export function PosterGrid({
  children,
  className,
  density = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  density?: 'default' | 'compact' | 'roomy';
}) {
  return (
    <div
      className={cn(
        'poster-grid grid gap-2.5',
        density === 'compact' && 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10',
        density === 'default' && 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
        density === 'roomy' && 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        className,
      )}
      data-reveal="grid"
    >
      {children}
    </div>
  );
}
