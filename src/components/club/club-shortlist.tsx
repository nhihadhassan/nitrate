'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { filmHref } from '@/lib/links';
import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';
import { nominateAction } from '@/server/actions/clubs';

type ShortlistItem = {
  movie: { id: string; slug: string; title: string; year: number | null; posterPath: string | null };
  reasons: RecommendationReason[];
  ownedFormats?: string[];
};

/**
 * The shared reason vocabulary's `club_interest` label ("In 1 of your Movie
 * Ideas queues") is written for a cross-club count on Explore. Here it is
 * always exactly this one club's own queue, so the plainer phrase is both
 * shorter and more accurate.
 */
function shortlistReasonLabel(reason: RecommendationReason): string {
  if (reason.kind === 'club_interest') return 'In Movie Ideas';
  return recommendationReasonLabel(reason);
}

/** A short, explainable answer to the question every club asks. */
export function ClubShortlist({
  items,
  clubId,
  roundId,
  canPick,
}: {
  items: ShortlistItem[];
  clubId: string;
  roundId: string | null;
  canPick: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  if (!items.length) return null;

  return (
    <section>
      <p className="eyebrow mb-1.5">What should we watch?</p>
      <p className="mb-3 text-xs leading-relaxed text-dim">Based on Movie Ideas, watchlists, and what the club has not seen.</p>
      <ul className="space-y-2.5">
        {items.slice(0, 4).map((item) => (
          <li key={item.movie.id} className="flex items-center gap-3 rounded-md border border-line bg-surface/30 p-2.5">
            <div className="w-10 shrink-0">
              <Poster film={item.movie} size="xs" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={filmHref(item.movie)} className="block truncate text-sm font-medium hover:text-iris">
                {item.movie.title}
                {item.movie.year ? <span className="ml-1.5 font-normal text-dim tabular">{item.movie.year}</span> : null}
              </Link>
              <p className="mt-0.5 truncate text-[0.6875rem] leading-relaxed text-muted">
                {item.reasons.map(shortlistReasonLabel).join(' · ')}
              </p>
              {item.ownedFormats?.length ? (
                <p className="mt-0.5 text-[0.6875rem] font-medium text-iris">Owned · {item.ownedFormats.join(', ')}</p>
              ) : null}
            </div>
            {canPick && roundId ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await nominateAction({ clubId, roundId, movieId: item.movie.id, pitch: null });
                    if (!result.ok) {
                      toast({ message: result.error, tone: 'error' });
                      return;
                    }
                    toast({ message: `${item.movie.title} is your pick`, tone: 'success' });
                    router.refresh();
                  })
                }
              >
                {pending ? 'Picking…' : 'Pick'}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
