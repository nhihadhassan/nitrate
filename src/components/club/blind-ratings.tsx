'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { StarInput } from '@/components/film/star-input';
import { Stars } from '@/components/film/stars';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { submitClubRatingAction } from '@/server/actions/clubs';

/**
 * Blind ratings.
 *
 * Before you submit, the server sends no average and no individual scores — only
 * how many people have rated. That removes anchoring entirely and makes the
 * reveal worth waiting for.
 */
export function BlindRatings({
  screeningId,
  clubSlug,
  revealed,
  viewerRating,
  average,
  count,
  pendingMembers,
  spread,
}: {
  screeningId: string;
  clubSlug: string;
  revealed: boolean;
  viewerRating: number | null;
  average: number | null;
  count: number;
  pendingMembers: number;
  spread: {
    user: { username: string; displayName: string; avatarAssetId: string | null };
    rating: number;
  }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [rating, setRating] = useState<number | null>(viewerRating);
  const [pending, startTransition] = useTransition();
  const [justRevealed, setJustRevealed] = useState(false);

  function submit() {
    if (!rating) return;
    startTransition(async () => {
      const result = await submitClubRatingAction({ screeningId, clubSlug, rating });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      if (!revealed) setJustRevealed(true);
      toast({ message: 'Rating submitted', tone: 'success' });
      router.refresh();
    });
  }

  if (!revealed) {
    return (
      <div className="rounded-lg border border-iris/30 bg-iris/[0.06] p-5 text-center">
        <p className="font-display text-xl">What did you make of it?</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          {count > 0
            ? `${pluralize(count, 'member')} already rated it. You will see the spread the moment you commit.`
            : 'Be the first. Nobody sees anyone else’s score until they have given their own.'}
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <StarInput value={rating} onChange={setRating} size="lg" label="Your club rating" />
          <Button variant="iris" disabled={pending || !rating} onClick={submit}>
            {pending ? 'Submitting…' : 'Submit and reveal'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={justRevealed ? 'animate-reveal' : undefined}>
      <div className="flex flex-wrap items-end gap-6 rounded-lg border border-line bg-surface/50 p-4">
        <div>
          <p className="eyebrow">Group rating</p>
          <p className="font-display text-5xl leading-none tabular">
            {average ? (average / 2).toFixed(1) : '—'}
          </p>
          <p className="mt-1 text-xs text-dim">
            {pluralize(count, 'rating')}
            {pendingMembers > 0 ? ` · ${pendingMembers} yet to rate` : ''}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">How everyone scored it</p>
          <ul className="space-y-1.5">
            {spread.map((entry) => (
              <li key={entry.user.username} className="flex items-center gap-2">
                <Avatar user={entry.user} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {entry.user.displayName}
                </span>
                <Stars value={entry.rating} size="xs" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Change your rating</span>
        <StarInput value={rating} onChange={setRating} size="sm" label="Your club rating" />
        {rating !== viewerRating ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Update'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
