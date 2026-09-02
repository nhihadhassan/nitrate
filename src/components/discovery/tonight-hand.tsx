'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { RecommendationContext } from '@/components/discovery/recommendation-context';
import { RecommendationOptionsMenu } from '@/components/discovery/recommendation-options-menu';
import { PosterCard, PosterGrid } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { formatRuntime } from '@/lib/utils';
import type { TonightRecommendation } from '@/server/services/discovery';

export function TonightHand({
  items,
  ownedIds,
  nextHref,
  hasMore,
  totalEligible,
  offset,
}: {
  items: TonightRecommendation[];
  ownedIds: string[];
  nextHref: string;
  hasMore: boolean;
  totalEligible: number;
  offset: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const owned = new Set(ownedIds);

  return (
    <section aria-busy={pending} aria-live="polite">
      <div
        key={offset}
        className="transition-opacity duration-150 motion-safe:animate-[nitrate-rise_180ms_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        <PosterGrid density="shortlist">
          {items.map(({ movie, reasons, availability }) => {
            const atHome = availability ? [...availability.stream, ...availability.free] : [];
            return (
              <PosterCard
                key={movie.id}
                film={movie}
                size="xl"
                overlay={
                  reasons.length ? (
                    <RecommendationOptionsMenu
                      targetType="movie"
                      targetId={movie.id}
                      reasonKind={reasons[0].kind}
                      resetBatchOnFeedback
                    />
                  ) : undefined
                }
                footer={(
                  <>
                    <p className="mt-0.5 text-[0.6875rem] text-dim">
                      {movie.runtime ? formatRuntime(movie.runtime) : 'Runtime unknown'}
                      {atHome.length ? ` · ${atHome.slice(0, 2).map((provider) => provider.name).join(', ')}` : ''}
                    </p>
                    {owned.has(movie.id) ? <Badge tone="iris">Owned · ready tonight</Badge> : null}
                    <RecommendationContext reasons={reasons} />
                  </>
                )}
              />
            );
          })}
        </PosterGrid>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        {hasMore ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(() => router.push(nextHref, { scroll: false }))}
          >
            {pending ? 'Finding three more…' : 'Show me three more'}
          </Button>
        ) : (
          <p className="text-sm text-muted">
            {totalEligible <= 3
              ? totalEligible === 3
                ? 'These are the three that fit.'
                : 'That is every film that fits right now.'
              : 'That is every film matching these choices.'}
          </p>
        )}
        {hasMore ? (
          <p className="sr-only">Showing films {offset + 1} to {offset + items.length} of {totalEligible}.</p>
        ) : null}
      </div>
    </section>
  );
}
