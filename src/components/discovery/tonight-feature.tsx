import Link from 'next/link';

import { Poster } from '@/components/film/poster';
import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { filmHref } from '@/lib/links';
import { formatRuntime } from '@/lib/utils';
import type { TonightRecommendation } from '@/server/services/discovery';

/**
 * Home's cinematic entry into Tonight — a real poster and a real film, not a
 * sidebar link explaining that a recommendation feature exists. One primary
 * pick with its poster and reasons, two smaller alternatives alongside, all
 * of it a click into `/tonight` for the full shortlist and its constraints.
 *
 * Renders nothing when there is nothing to shortlist yet — an empty Tonight
 * card is worse than no card.
 */
export function TonightFeature({ suggestions }: { suggestions: TonightRecommendation[] }) {
  if (!suggestions.length) return null;
  const [primary, ...rest] = suggestions;
  const atHome = primary.availability ? [...primary.availability.stream, ...primary.availability.free] : [];

  return (
    <section className="mb-9 rounded-lg border border-ember/20 bg-ember/[0.035] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="eyebrow text-ember">Tonight</p>
        <Link href="/tonight" className="text-xs text-dim transition-colors hover:text-ember">
          Change it up →
        </Link>
      </div>

      <div className="mt-3 flex gap-4 sm:gap-5">
        <div className="w-24 shrink-0 sm:w-32">
          <Poster film={primary.movie} size="lg" priority />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={filmHref(primary.movie)}
            className="block font-display text-xl leading-tight hover:text-ember sm:text-2xl"
          >
            {primary.movie.title}
          </Link>
          <p className="mt-1 text-xs text-dim">
            {[
              primary.movie.runtime ? formatRuntime(primary.movie.runtime) : null,
              atHome.length ? `On ${atHome.slice(0, 2).map((provider) => provider.name).join(', ')}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <RecommendationContext reasons={primary.reasons} />

          {rest.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {rest.map((suggestion) => (
                <Link
                  key={suggestion.movie.id}
                  href={filmHref(suggestion.movie)}
                  className="w-11 shrink-0 rounded-xs focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
                  aria-label={suggestion.movie.title}
                >
                  <Poster film={suggestion.movie} size="xs" linked={false} ariaHidden />
                </Link>
              ))}
              <Link href="/tonight" className="text-xs text-muted transition-colors hover:text-ember">
                {pluralAlternatives(rest.length)} →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function pluralAlternatives(count: number): string {
  return count === 1 ? 'One more choice' : `${count} more choices`;
}
