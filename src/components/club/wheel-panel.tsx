'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { filmHref } from '@/lib/links';
import { formatRuntime, pluralize } from '@/lib/utils';
import { spinWheelAction, type SpinWheelResponse } from '@/server/actions/clubs';

import { Wheel, type WheelSegment } from './wheel';

export type Contender = {
  nominationId: string;
  pitch: string | null;
  nominatedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: {
    slug: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    runtime: number | null;
  };
};

/**
 * Submissions plus the wheel. Once a round has been spun the result is fixed
 * server-side, so this renders the settled state directly rather than replaying
 * the animation on every visit.
 */
export function WheelPanel({
  clubId,
  roundId,
  contenders,
  alreadySpunWinnerId,
  canSpin,
  allMembersPicked,
}: {
  clubId: string;
  roundId: string;
  contenders: Contender[];
  alreadySpunWinnerId: string | null;
  canSpin: boolean;
  allMembersPicked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SpinWheelResponse | null>(null);
  const [revealed, setRevealed] = useState(Boolean(alreadySpunWinnerId));

  const segments: WheelSegment[] = contenders.map((c) => ({
    nominationId: c.nominationId,
    movieTitle: c.movie.title,
  }));

  const settledWinnerId = result
    ? result.order[result.winnerIndex]?.nominationId
    : alreadySpunWinnerId;
  const winner = contenders.find((c) => c.nominationId === settledWinnerId) ?? null;

  // Only animate for a spin that happened in this session.
  const animateTo = result && !result.alreadySpun ? result.winnerIndex : null;
  const showWheel = !alreadySpunWinnerId || Boolean(animateTo !== null);

  function spin() {
    startTransition(async () => {
      const response = await spinWheelAction(roundId, clubId);
      if (!response.ok) {
        toast({ message: response.error, tone: 'error' });
        return;
      }
      setResult(response.data);
      if (response.data.alreadySpun) {
        setRevealed(true);
        router.refresh();
      }
    });
  }

  if (!alreadySpunWinnerId && !allMembersPicked) {
    return (
      <div className="rounded-lg border border-line bg-surface/30 px-4 py-3 text-sm text-muted">
        <span className="font-medium text-text">Next: spin the wheel.</span>{' '}
        It unlocks when everyone has picked.
      </div>
    );
  }

  if (winner && revealed) {
    return (
      <div className="winner-card animate-reveal rounded-lg border border-iris/40 bg-iris/[0.07] p-5" data-pointer-light>
        <p className="eyebrow text-iris">The wheel picked</p>
        <div className="mt-3 flex gap-4">
          <div className="w-20 shrink-0 sm:w-24">
            <Poster film={winner.movie} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={filmHref(winner.movie)}
              className="font-display text-2xl leading-tight hover:text-iris sm:text-3xl"
            >
              {winner.movie.title}
            </Link>
            <p className="mt-1 text-sm text-muted tabular">
              {winner.movie.year}
              {winner.movie.runtime ? ` · ${formatRuntime(winner.movie.runtime)}` : ''}
            </p>
            {winner.pitch ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">“{winner.pitch}”</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dim">
              <span>Picked by</span>
              <UserChip user={winner.nominatedBy} size="xs" />
              <span>
                · chosen at random from {pluralize(contenders.length, 'pick')}
              </span>
            </div>
            <p className="mt-3 text-xs text-jade">Everyone in the club has been emailed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signature-surface rounded-lg border border-line p-5" data-pointer-light>
      <div className="flex flex-col items-center gap-5">
        {showWheel ? (
          <Wheel
            segments={segments}
            winnerIndex={animateTo}
            spinning={pending}
            onSettled={() => {
              setRevealed(true);
              router.refresh();
            }}
          />
        ) : null}

        <div className="text-center">
          {contenders.length < 2 ? (
            <p className="text-sm text-dim">
              The wheel needs at least two picks. {pluralize(contenders.length, 'movie')} so far.
            </p>
          ) : animateTo !== null ? (
            <p className="text-sm text-muted">Spinning…</p>
          ) : canSpin ? (
            <>
              <Button variant="iris" size="lg" onClick={spin} disabled={pending}>
                {pending ? 'Spinning…' : 'Spin the wheel'}
              </Button>
              <p className="mt-2 text-xs text-dim">
                {pluralize(contenders.length, 'pick')} in. One spin, no re-rolls.
              </p>
            </>
          ) : (
            <p className="text-sm text-dim">
              {pluralize(contenders.length, 'pick')} in. Waiting for someone to spin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
