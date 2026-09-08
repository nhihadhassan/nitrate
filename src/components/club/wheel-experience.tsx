'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { PosterWheel } from '@/components/club/wheel/poster-wheel';
import { Press, SharedPoster } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Avatar, AvatarStack, type AvatarUser } from '@/components/user/avatar';
import { CommentIcon, SparkIcon } from '@/components/ui/icons';
import { filmHref, userHref } from '@/lib/links';
import { backdropUrl } from '@/lib/images';
import { WHEEL, WHEEL_TOTAL_MS } from '@/lib/motion';
import { formatRuntime } from '@/lib/utils';
import {
  beginWheelRevealAction,
  completeWheelRevealAction,
  spinWheelAction,
  type SpinWheelResponse,
} from '@/server/actions/clubs';
import type { WheelRevealPayload } from '@/server/services/clubs';

type Preview = WheelRevealPayload['order'][number];

/** The winning poster morphs from the wheel into the hero; both ends share this. */
const WINNER_SHARE_ID = 'club-wheel-winner';

/**
 * The wheel, end to end.
 *
 * Four states, one screen: the picks waiting to be spun, the spin itself, a
 * held beat, and the film. The server owns the outcome throughout — the client
 * asks for a result, is told one, and animates towards it. Nothing here can
 * choose or change a winner, and a replay re-runs the same committed result.
 *
 * A member who arrives after someone else has spun gets the same experience
 * rather than a spoiler: the page is not given the winner until they ask for
 * it, and they can skip the animation or replay it later.
 */
export function WheelExperience({
  clubId,
  clubSlug,
  clubName,
  roundId,
  previews,
  canSpin,
  allReady,
  spun,
  revealed,
  initialPayload,
  selectionMovieLabel,
  canPlanMovieNight = false,
  members = [],
  memberLine,
}: {
  clubId: string;
  clubSlug: string;
  clubName: string;
  roundId: string;
  previews: Preview[];
  canSpin: boolean;
  allReady: boolean;
  spun: boolean;
  revealed: boolean;
  initialPayload: WheelRevealPayload | null;
  selectionMovieLabel: string;
  canPlanMovieNight?: boolean;
  /** Who is in the club, shown under the wheel as presence. */
  members?: AvatarUser[];
  /** "8 members · Monthly". */
  memberLine?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payload, setPayload] = useState<WheelRevealPayload | null>(initialPayload);
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'spinning' | 'settling' | 'revealed'>(
    revealed ? 'revealed' : spun ? 'waiting' : 'ready',
  );

  const cards = payload?.order ?? previews;
  const winner = payload?.winner ?? null;
  const spinning = phase === 'spinning' || phase === 'settling';

  // The reveal must happen exactly once per attempt, whichever of the two
  // paths below gets there first.
  const finishing = useRef(false);

  /** Records the reveal for this member, then shows the film. */
  const finish = useCallback(
    (method: 'animated' | 'skipped') => {
      if (finishing.current) return;
      finishing.current = true;
      startTransition(async () => {
        const result = await completeWheelRevealAction({ roundId, clubId, method });
        if (!result.ok) {
          finishing.current = false;
          toast({ message: result.error, tone: 'error' });
          return;
        }
        setPhase('revealed');
        router.refresh();
      });
    },
    [clubId, roundId, router, toast],
  );

  /** The wheel has stopped: hold a beat, then hand over to the film. */
  function onSettled() {
    setPhase('settling');
    window.setTimeout(() => finish('animated'), WHEEL.revealHold * 1000);
  }

  /**
   * A safety net on wall-clock time.
   *
   * Motion pauses while the tab is hidden, so a member who locks their phone
   * mid-spin would otherwise come back to a frozen wheel whose `onComplete`
   * never fired — and their reveal would never be recorded. This finishes the
   * reveal once the spin has had its full duration in real time, whatever the
   * animation is doing.
   */
  useEffect(() => {
    if (phase !== 'spinning') return;
    finishing.current = false;
    const startedAt = Date.now();
    const budget = WHEEL_TOTAL_MS + WHEEL.revealHold * 1000 + 400;

    const timer = window.setTimeout(() => finish('animated'), budget);
    function onVisible() {
      if (document.visibilityState === 'visible' && Date.now() - startedAt >= budget) {
        finish('animated');
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, finish]);

  function loadAndSpin(mode: 'spin' | 'reveal') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
    startTransition(async () => {
      if (mode === 'spin') {
        const spinResult = await spinWheelAction(roundId, clubId);
        if (!spinResult.ok) {
          toast({ message: spinResult.error, tone: 'error' });
          return;
        }
      }
      const reveal = await beginWheelRevealAction(roundId, clubId);
      if (!reveal.ok) {
        toast({ message: reveal.error, tone: 'error' });
        return;
      }
      setPayload(reveal.data);
      setPhase('spinning');
    });
  }

  /** Replays the same committed result. It never asks the server for a new one. */
  function replay() {
    if (!payload) return;
    finishing.current = false;
    setPhase('spinning');
  }

  if (phase === 'revealed' && winner) {
    const backdrop = backdropUrl(winner.backdropPath, 'md');
    const others = (payload?.order ?? []).filter((item) => item.nominationId !== winner.nominationId);

    return (
      <section className="relative -mx-4 -mt-6 min-h-[100dvh] px-4 pb-16 pt-10" aria-live="polite">
        {backdrop ? (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[70vh] bg-cover bg-center"
              style={{ backgroundImage: `url(${backdrop})` }}
            />
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b from-canvas/40 via-canvas/70 to-canvas"
            />
          </>
        ) : null}

        <div className="relative flex flex-col items-center text-center">
          <Link
            href={`/club/${clubSlug}`}
            className="mb-6 self-start text-sm text-muted hover:text-text"
          >
            ← {clubName}
          </Link>
          <SharedPoster shareId={WINNER_SHARE_ID} className="w-52 shadow-pop">
            <Poster film={winner} size="lg" linked={false} priority />
          </SharedPoster>

          <p className="eyebrow mt-6 text-iris">{selectionMovieLabel}</p>
          <h1 className="mt-1.5 font-display text-[2.5rem] leading-[1.05]">{winner.title}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {[winner.year, winner.runtime ? formatRuntime(winner.runtime) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <Link
            href={userHref(winner.nominatedBy)}
            className="mt-4 flex items-center gap-2 rounded-full py-1 pr-2 hover:text-text"
          >
            <Avatar user={winner.nominatedBy} size="sm" />
            <span className="text-sm text-muted">
              Picked by <span className="text-text">{winner.nominatedBy.displayName}</span>
            </span>
          </Link>

          <div className="mt-6 flex w-full justify-center gap-2" aria-label="React to this movie">
            {payload?.reactions.map((reaction) => (
              <ReactionButton
                key={reaction.reaction}
                clubId={clubId}
                roundId={roundId}
                reaction={reaction.reaction}
                count={reaction.count}
                mine={reaction.mine}
              />
            ))}
          </div>

          <div className="mt-6 w-full space-y-2">
            {canPlanMovieNight ? (
              <Press>
                <Link
                  href={`/club/${clubSlug}#club-schedule-m`}
                  className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-white"
                >
                  Plan movie night
                </Link>
              </Press>
            ) : null}
            <Button asChild variant="outline" size="lg" className="w-full justify-center">
              <Link href={filmHref(winner)}>View movie</Link>
            </Button>
            <button
              type="button"
              onClick={replay}
              className="min-h-11 w-full text-xs text-muted underline underline-offset-2 hover:text-text"
            >
              Replay the reveal
            </button>
          </div>

          {others.length ? (
            <div className="mt-9 w-full text-left">
              <p className="eyebrow mb-2.5">Other picks</p>
              <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {others.map((item) => (
                  <li key={item.nominationId} className="w-16 shrink-0">
                    <Poster film={item.movie} size="xs" linked={false} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const heading =
    phase === 'waiting'
      ? 'The wheel has spun'
      : spinning
        ? selectionMovieLabel
        : selectionMovieLabel;

  return (
    <section className="flex flex-col items-center py-2 text-center" aria-label="Movie Club wheel">
      <p className="eyebrow text-iris">{clubName}</p>
      <h1 className="mt-1.5 font-display text-[2rem] leading-none">{heading}</h1>
      {phase === 'ready' ? (
        <p className="mt-2 text-sm text-muted">
          {previews.length} {previews.length === 1 ? 'pick' : 'picks'}
        </p>
      ) : null}

      <div className="mt-7 w-full">
        <PosterWheel
          items={cards.map((card) => ({ nominationId: card.nominationId, movie: card.movie }))}
          winnerIndex={spinning && payload ? payload.winnerIndex : null}
          spinning={spinning}
          onSettled={onSettled}
          hubLabel={clubName}
          height={320}
        />
      </div>

      {members.length && !spinning ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <AvatarStack users={members} max={7} />
          {memberLine ? <p className="eyebrow">{memberLine}</p> : null}
        </div>
      ) : null}

      {/* During the held beat the winning poster appears over the wheel and
          then morphs into the hero on the next screen. */}
      {phase === 'settling' && winner ? (
        <SharedPoster shareId={WINNER_SHARE_ID} className="-mt-24 w-28 shadow-pop">
          <Poster film={winner} size="sm" linked={false} priority />
        </SharedPoster>
      ) : null}

      <div className="mt-8 w-full space-y-2">
        {phase === 'ready' ? (
          <>
            <Press>
              <button
                type="button"
                onClick={() => loadAndSpin('spin')}
                disabled={!canSpin || !allReady || pending || previews.length < 2}
                className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-white disabled:opacity-45"
              >
                {pending ? 'Starting…' : 'Spin the wheel'}
              </button>
            </Press>
            {previews.length < 2 ? (
              <p className="text-xs text-dim">The wheel needs at least two picks</p>
            ) : !allReady ? (
              <p className="text-xs text-dim">Waiting on the remaining picks</p>
            ) : !canSpin ? (
              <p className="text-xs text-dim">Anyone with wheel access can spin</p>
            ) : null}
          </>
        ) : null}

        {phase === 'waiting' ? (
          <>
            <Press>
              <button
                type="button"
                onClick={() => loadAndSpin('reveal')}
                disabled={pending}
                className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-white"
              >
                {pending ? 'Opening…' : 'Watch the reveal'}
              </button>
            </Press>
            <button
              type="button"
              onClick={() => finish('skipped')}
              disabled={pending}
              className="min-h-11 w-full text-xs text-muted underline underline-offset-2 hover:text-text"
            >
              Skip to the result
            </button>
          </>
        ) : null}

        {spinning ? (
          <button
            type="button"
            onClick={() => finish('skipped')}
            disabled={pending}
            className="min-h-11 w-full text-xs text-muted underline underline-offset-2 hover:text-text"
          >
            Skip animation
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ReactionButton({
  clubId,
  roundId,
  reaction,
  count,
  mine,
}: {
  clubId: string;
  roundId: string;
  reaction: string;
  count: number;
  mine: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const labels: Record<string, string> = { love: 'Love it', excited: 'Excited', curious: 'Curious' };
  const icons: Record<string, React.ReactNode> = {
    love: <span aria-hidden className="text-sm leading-none">♥</span>,
    excited: <SparkIcon className="h-3.5 w-3.5" />,
    curious: <CommentIcon className="h-3.5 w-3.5" />,
  };

  return (
    <Press className="flex-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={mine}
        className={`flex min-h-12 w-full flex-col items-center justify-center rounded-xl border text-xs transition-colors ${
          mine ? 'border-iris bg-iris/15 text-text' : 'border-line text-muted hover:border-iris/60'
        }`}
        onClick={() =>
          startTransition(async () => {
            const { setRoundReactionAction } = await import('@/server/actions/clubs');
            const result = await setRoundReactionAction({
              clubId,
              roundId,
              reaction: mine ? null : reaction,
            });
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            router.refresh();
          })
        }
      >
        <span className="flex items-center gap-1.5">
          {icons[reaction]}
          {labels[reaction]}
        </span>
        {count ? <span className="mt-0.5 text-[0.6875rem] text-dim tabular">{count}</span> : null}
      </button>
    </Press>
  );
}

export type WheelSpinPreview = SpinWheelResponse;
