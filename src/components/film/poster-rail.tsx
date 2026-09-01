'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Poster, type PosterFilm } from '@/components/film/poster';
import { RecommendationOptionsMenu } from '@/components/discovery/recommendation-options-menu';
import { ChevronRightIcon } from '@/components/ui/icons';
import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';
import { cn } from '@/lib/utils';

/**
 * A horizontal, snap-scrolling poster rail — the mobile-friendly alternative
 * to `PosterGrid` for sections that would otherwise stack many rows deep.
 * Built on the `scroll-rail` / `scroll-rail-item` utilities already defined
 * in globals.css and already proven on the film page's cast rail.
 */
export function PosterRail({
  films,
  label,
  size = 'md',
  eager,
  itemClassName,
  className,
  showReason = true,
  showFeedback = true,
}: {
  films: (PosterFilm & { id?: string; caption?: string; reason?: RecommendationReason; owned?: boolean })[];
  /** Accessible name for the rail's implicit list landmark. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  /** Set on the first rail on the page so its LCP images are not lazy. */
  eager?: boolean;
  itemClassName?: string;
  className?: string;
  /**
   * Set false when the section heading already says why every film here is
   * showing (e.g. "Because you loved X", "On your watchlist") — repeating
   * that under each poster adds nothing. `caption` always renders regardless.
   */
  showReason?: boolean;
  /**
   * Set false where a film's presence isn't an algorithmic guess to begin
   * with — a user's own watchlist, for instance — so there is nothing to
   * "tune".
   */
  showFeedback?: boolean;
}) {
  if (!films.length) return null;

  return (
    <ProgressivePosterRail
      films={films}
      label={label}
      size={size}
      eager={eager}
      itemClassName={itemClassName}
      className={className}
      showReason={showReason}
      showFeedback={showFeedback}
    />
  );
}

function ProgressivePosterRail({
  films,
  label,
  size,
  eager,
  itemClassName,
  className,
  showReason,
  showFeedback,
}: Required<Pick<Parameters<typeof PosterRail>[0], 'films' | 'label' | 'size' | 'showReason' | 'showFeedback'>> &
  Pick<Parameters<typeof PosterRail>[0], 'eager' | 'itemClassName' | 'className'>) {
  const railRef = useRef<HTMLUListElement>(null);
  const railId = useId();
  const hintId = `${railId}-hint`;
  const [visibleCount, setVisibleCount] = useState(() => Math.min(12, films.length));
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(films.length > 12);

  const updatePosition = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const remaining = rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
    setCanScrollBack(rail.scrollLeft > 8);
    setCanScrollForward(remaining > 8 || visibleCount < films.length);

    // Add another finite batch as the reader approaches the end. This extends
    // discovery without cloning cards or turning the rail into a focus trap.
    if (remaining < rail.clientWidth * 0.65 && visibleCount < films.length) {
      setVisibleCount((count) => Math.min(films.length, count + 6));
    }
  }, [films.length, visibleCount]);

  useEffect(() => {
    setVisibleCount((count) => Math.min(Math.max(count, 12), films.length));
  }, [films.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updatePosition();
    rail.addEventListener('scroll', updatePosition, { passive: true });
    const observer = new ResizeObserver(updatePosition);
    observer.observe(rail);
    return () => {
      rail.removeEventListener('scroll', updatePosition);
      observer.disconnect();
    };
  }, [updatePosition]);

  useEffect(() => {
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [updatePosition, visibleCount]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const rail = railRef.current;
      if (!rail) return;
      if (direction === 1 && visibleCount < films.length) {
        setVisibleCount((count) => Math.min(films.length, count + 6));
      }
      rail.scrollBy({ left: direction * rail.clientWidth * 0.82, behavior: 'smooth' });
    },
    [films.length, visibleCount],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByPage(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByPage(-1);
    }
  };

  return (
    <div className="group/rail relative">
      <p id={hintId} className="sr-only">
        Scroll horizontally or use the left and right arrow keys to browse more films.
      </p>
      <ul
        ref={railRef}
        id={railId}
        role="list"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          'scroll-rail -mx-4 scroll-px-4 px-4 pr-12 outline-none sm:mx-0 sm:px-0 sm:pr-14',
          className,
        )}
      >
        {films.slice(0, visibleCount).map((film, index) => (
          <li
            key={film.id ?? film.slug}
            className={cn(
              'scroll-rail-item w-[6.5rem] xs:w-28 sm:w-32 lg:w-36',
              itemClassName,
            )}
          >
            <Poster
              film={film}
              size={size}
              priority={eager && index < 6}
              overlay={
                showFeedback && film.reason && film.id ? (
                  <RecommendationOptionsMenu
                    targetType="movie"
                    targetId={film.id}
                    reasonKind={film.reason.kind}
                  />
                ) : undefined
              }
            />
            <p className="mt-1.5 truncate text-[0.8125rem] font-medium leading-snug">{film.title}</p>
            <p className="text-[0.6875rem] text-dim tabular">
              {film.year ?? ''}
              {film.caption || (showReason && film.reason) ? (
                <span className="ml-1 text-ember">{film.caption ?? recommendationReasonLabel(film.reason!)}</span>
              ) : null}
            </p>
            {film.owned ? <p className="mt-0.5 text-[0.6875rem] font-medium text-iris">Owned</p> : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label={`Previous films in ${label}`}
        aria-controls={railId}
        disabled={!canScrollBack}
        className="absolute left-1 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-canvas-raised/95 text-muted shadow-pop transition-[opacity,color,transform] hover:text-text disabled:pointer-events-none disabled:opacity-0 md:flex"
      >
        <ChevronRightIcon className="h-5 w-5 rotate-180" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label={`More films in ${label}`}
        aria-controls={railId}
        disabled={!canScrollForward}
        className="absolute right-1 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-canvas-raised/95 text-muted shadow-pop transition-[opacity,color,transform] hover:text-text disabled:pointer-events-none disabled:opacity-0 md:flex"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
