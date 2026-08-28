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
  /**
   * Rendered as a sibling of the film link, not nested inside it — so an
   * interactive overlay (a menu trigger, say) never ends up as a `<button>`
   * inside an `<a>`. Position it yourself (e.g. `absolute right-1.5 top-1.5`);
   * the wrapping frame is already `relative`.
   */
  overlay?: React.ReactNode;
  ariaHidden?: boolean;
}) {
  const url = posterUrl(film.posterPath, size);

  const frame = (
    <span
      className={cn('poster-frame premium-poster block', className)}
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
    </span>
  );

  // `group` wraps both the link and the overlay sibling, so an overlay
  // control (e.g. a menu trigger) can reveal itself on hover/focus of the
  // whole card via `group-hover:`/`group-focus-within:`, even though it is
  // not nested inside the link.
  if (!linked) {
    return (
      <span className="group relative block">
        {frame}
        {overlay}
      </span>
    );
  }

  return (
    <span className="group relative block">
      <Link
        href={filmHref(film)}
        aria-hidden={ariaHidden}
        tabIndex={ariaHidden ? -1 : undefined}
        aria-label={`${film.title}${film.year ? ` (${film.year})` : ''}`}
        className="block rounded-sm focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
      >
        {frame}
      </Link>
      {overlay}
    </span>
  );
}

/** Poster plus title/year caption, for grids where text genuinely helps. */
export function PosterCard({
  film,
  size = 'md',
  footer,
  className,
  priority,
  overlay,
}: {
  film: PosterFilm;
  size?: PosterSize;
  footer?: React.ReactNode;
  className?: string;
  /** Set on the handful of cards above the fold so the LCP image is not lazy. */
  priority?: boolean;
  /** Forwarded to `Poster` — see its own doc comment. */
  overlay?: React.ReactNode;
}) {
  return (
    <div className={cn('poster-card min-w-0', className)}>
      <Poster film={film} size={size} priority={priority} overlay={overlay} />
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
  density?: 'default' | 'compact' | 'roomy' | 'sidebar' | 'shortlist';
}) {
  return (
    <div
      className={cn(
        'poster-grid grid gap-2.5',
        density === 'compact' && 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10',
        density === 'default' && 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
        density === 'roomy' && 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        // Fixed 3 columns at every breakpoint — for narrow, fixed-width
        // sidebars where the container query never changes.
        density === 'sidebar' && 'grid-cols-3',
        // A small, deliberate handful of results (Tonight) — one column on a
        // phone, exactly three from `sm` up, never a dense grid.
        density === 'shortlist' && 'grid-cols-1 gap-4 sm:grid-cols-3',
        className,
      )}
      data-reveal="grid"
    >
      {children}
    </div>
  );
}
