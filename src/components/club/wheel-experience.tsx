'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { filmHref } from '@/lib/links';
import { formatRuntime } from '@/lib/utils';
import {
  beginWheelRevealAction,
  completeWheelRevealAction,
  spinWheelAction,
  type SpinWheelResponse,
} from '@/server/actions/clubs';
import type { WheelRevealPayload } from '@/server/services/clubs';

type Preview = WheelRevealPayload['order'][number];

export function WheelExperience({
  clubId,
  clubSlug,
  roundId,
  previews,
  canSpin,
  allReady,
  spun,
  revealed,
  initialPayload,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  previews: Preview[];
  canSpin: boolean;
  allReady: boolean;
  spun: boolean;
  revealed: boolean;
  initialPayload: WheelRevealPayload | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [payload, setPayload] = useState<WheelRevealPayload | null>(initialPayload);
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'spinning' | 'revealed'>(
    revealed ? 'revealed' : spun ? 'waiting' : 'ready',
  );
  const [reducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cards = payload?.order ?? previews;
  const winner = payload?.winner ?? null;
  const visibleCards = useMemo(() => {
    if (!cards.length) return [];
    const repeats = phase === 'spinning' ? (cards.length <= 3 ? 5 : 3) : 1;
    return Array.from({ length: repeats }, () => cards).flat();
  }, [cards, phase]);
  const targetIndex = payload ? 2 * payload.order.length + payload.winnerIndex : 0;
  const cardStep = 112;
  const distance = targetIndex * cardStep;

  function loadPayload() {
    startTransition(async () => {
      const result = await beginWheelRevealAction(roundId, clubId);
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setPayload(result.data);
      if (reducedMotion) {
        const completed = await completeWheelRevealAction({ roundId, clubId, method: 'skipped' });
        if (!completed.ok) return toast({ message: completed.error, tone: 'error' });
        setPhase('revealed');
      } else setPhase('spinning');
    });
  }

  function spin() {
    if (!reducedMotion && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
    startTransition(async () => {
      const result = await spinWheelAction(roundId, clubId);
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      const reveal = await beginWheelRevealAction(roundId, clubId);
      if (!reveal.ok) {
        toast({ message: reveal.error, tone: 'error' });
        return;
      }
      setPayload(reveal.data);
      if (reducedMotion) {
        const completed = await completeWheelRevealAction({ roundId, clubId, method: 'skipped' });
        if (!completed.ok) return toast({ message: completed.error, tone: 'error' });
        setPhase('revealed');
      } else setPhase('spinning');
    });
  }

  function finish(method: 'animated' | 'skipped') {
    if (!payload) return;
    startTransition(async () => {
      const result = await completeWheelRevealAction({ roundId, clubId, method });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setPhase('revealed');
    });
  }

  const title = phase === 'ready' ? 'The wheel is ready' : phase === 'waiting' ? 'The wheel has been spun' : phase === 'spinning' ? 'Finding this week’s film…' : 'This week’s movie';

  if (phase === 'revealed' && winner) {
    return (
      <section className="wheel-experience winner-card relative overflow-hidden rounded-2xl border border-iris/35 bg-canvas-raised p-5 shadow-pop sm:p-8" aria-live="polite">
        {winner.backdropPath ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${winner.backdropPath})` }} aria-hidden /> : null}
        <div className="relative grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
          <div className="mx-auto w-44 sm:w-full"><Poster film={winner} size="lg" linked={false} priority /></div>
          <div>
            <p className="eyebrow text-iris">This week&apos;s movie</p>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-6xl">{winner.title}</h1>
            <p className="mt-3 text-sm text-muted">{winner.year ?? 'Film'}{winner.runtime ? ` · ${formatRuntime(winner.runtime)}` : ''}</p>
            <p className="mt-4 text-sm text-muted">Picked by <span className="text-text">{winner.nominatedBy.displayName}</span> from {payload?.order.length ?? 0} club picks.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="iris"><Link href={filmHref(winner)}>View movie</Link></Button>
              <Button asChild variant="outline"><Link href={`/club/${clubSlug}`}>Back to club</Link></Button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="React to this movie">
              {payload?.reactions.map((reaction) => <ReactionButton key={reaction.reaction} clubId={clubId} roundId={roundId} reaction={reaction.reaction} count={reaction.count} mine={reaction.mine} />)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wheel-experience signature-surface relative overflow-hidden rounded-2xl border border-iris/25 p-5 text-center shadow-pop sm:p-8" aria-label="Movie Club wheel reveal">
      <p className="eyebrow text-iris">Movie Club night</p>
      <h1 className="mt-2 font-display text-4xl leading-none sm:text-6xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        {phase === 'ready' ? `${previews.length} movies. One movie night.` : phase === 'waiting' ? 'Tap reveal when you are ready to find out.' : 'The result is fixed. Watch it land.'}
      </p>

      <div className="wheel-track mt-8 overflow-hidden" style={{ '--wheel-distance': `${distance}px`, '--wheel-duration': reducedMotion ? '0ms' : '4800ms' } as React.CSSProperties}>
        <div className={`wheel-track-inner ${phase === 'spinning' ? 'is-spinning' : ''}`}>
          {visibleCards.map((card, index) => (
            <div className="wheel-card" key={`${card.nominationId}-${index}`} aria-hidden={phase !== 'revealed'}>
              <Poster film={card.movie} size="sm" linked={false} priority={index < 5} />
              <span className="mt-2 block truncate text-xs text-muted">{card.movie.title}</span>
            </div>
          ))}
        </div>
        <span className="wheel-track-pointer" aria-hidden />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {phase === 'ready' ? <Button variant="iris" size="lg" onClick={spin} disabled={!canSpin || !allReady || pending}>{pending ? 'Starting…' : 'Spin the wheel'}</Button> : null}
        {phase === 'waiting' ? <Button variant="iris" size="lg" onClick={loadPayload} disabled={pending}>{pending ? 'Opening…' : 'Tap to reveal'}</Button> : null}
        {phase === 'spinning' ? <Button variant="outline" size="lg" onClick={() => finish('skipped')} disabled={pending}>Skip animation</Button> : null}
        {phase === 'ready' && !allReady ? <p className="basis-full text-xs text-dim">Waiting for the remaining picks.</p> : null}
        {phase === 'ready' && allReady && !canSpin ? <p className="basis-full text-xs text-dim">Someone with wheel permission can start the reveal.</p> : null}
      </div>
      {phase === 'spinning' ? <p className="mt-3 text-xs text-dim" aria-live="polite">The wheel is spinning. <button type="button" className="underline underline-offset-2 hover:text-text" onClick={() => finish('skipped')}>Reveal result</button></p> : null}
    </section>
  );
}

function ReactionButton({ clubId, roundId, reaction, count, mine }: { clubId: string; roundId: string; reaction: string; count: number; mine: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const labels: Record<string, string> = { love: 'Love it', excited: 'Can’t wait', curious: 'Curious' };
  return <button type="button" disabled={pending} aria-pressed={mine} className={`min-h-11 rounded-full border px-3 text-xs transition-colors ${mine ? 'border-iris bg-iris/15 text-text' : 'border-line text-muted hover:border-iris/60 hover:text-text'}`} onClick={() => startTransition(async () => { const { setRoundReactionAction } = await import('@/server/actions/clubs'); const result = await setRoundReactionAction({ clubId, roundId, reaction: mine ? null : reaction }); if (!result.ok) return toast({ message: result.error, tone: 'error' }); router.refresh(); })}>{labels[reaction]}{count ? ` · ${count}` : ''}</button>;
}

export type WheelSpinPreview = SpinWheelResponse;
