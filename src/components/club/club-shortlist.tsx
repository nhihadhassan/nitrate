'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { filmHref } from '@/lib/links';
import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';
import { nominateAction } from '@/server/actions/clubs';

type ShortlistItem = {
  movie: { id: string; slug: string; title: string; year: number | null };
  reasons: RecommendationReason[];
  ownedFormats?: string[];
};

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
      <ul className="space-y-3">
        {items.slice(0, 4).map((item) => (
          <li key={item.movie.id} className="rounded-md border border-line bg-surface/30 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Link href={filmHref(item.movie)} className="block truncate text-sm font-medium hover:text-iris">
                  {item.movie.title}
                </Link>
                {item.movie.year ? <p className="text-xs text-dim tabular">{item.movie.year}</p> : null}
                {item.ownedFormats?.length ? <p className="mt-0.5 text-[0.6875rem] font-medium text-iris">Owned · {item.ownedFormats.join(', ')}</p> : null}
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
            </div>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">{item.reasons.map(recommendationReasonLabel).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
