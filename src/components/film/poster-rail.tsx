import { Poster, type PosterFilm } from '@/components/film/poster';
import { RecommendationFeedback } from '@/components/discovery/recommendation-feedback';
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
}: {
  films: (PosterFilm & { id?: string; caption?: string; reason?: RecommendationReason })[];
  /** Accessible name for the rail's implicit list landmark. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  /** Set on the first rail on the page so its LCP images are not lazy. */
  eager?: boolean;
  itemClassName?: string;
  className?: string;
}) {
  if (!films.length) return null;

  return (
    <ul
      role="list"
      aria-label={label}
      className={cn('scroll-rail -mx-4 px-4 sm:mx-0 sm:px-0', className)}
    >
      {films.map((film, index) => (
        <li
          key={`${film.slug}-${index}`}
          className={cn(
            'scroll-rail-item w-[6.5rem] xs:w-28 sm:w-32 lg:w-36',
            itemClassName,
          )}
        >
          <Poster film={film} size={size} priority={eager && index < 6} />
          <p className="mt-1.5 truncate text-[0.8125rem] font-medium leading-snug">{film.title}</p>
          <p className="text-[0.6875rem] text-dim tabular">
            {film.year ?? ''}
            {film.caption || film.reason ? (
              <span className="ml-1 text-ember">{film.caption ?? recommendationReasonLabel(film.reason!)}</span>
            ) : null}
          </p>
          {film.reason && film.id ? (
            <RecommendationFeedback targetType="movie" targetId={film.id} reasonKind={film.reason.kind} compact />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
