'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { PosterWheel } from '@/components/club/wheel/poster-wheel';
import { Press, SharedPoster } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Sheet } from '@/components/ui/sheet';
import { Avatar, AvatarStack, type AvatarUser } from '@/components/user/avatar';
import { CommentIcon, SparkIcon } from '@/components/ui/icons';
import { ThemeBadge, type ThemeInfo } from '@/components/club/theme-badge';
import { filmHref, userHref } from '@/lib/links';
import { backdropUrl } from '@/lib/images';
import { WHEEL, WHEEL_TOTAL_MS } from '@/lib/motion';
import { themeAccent } from '@/lib/movie-themes';
import { cn, formatRuntime } from '@/lib/utils';
import {
  beginWheelRevealAction,
  completeWheelRevealAction,
  replaceWheelPoolAction,
  setWheelWinnerManuallyAction,
  spinWheelAction,
  type SpinWheelResponse,
} from '@/server/actions/clubs';
import type { WheelRevealPayload } from '@/server/services/clubs';

type Preview = WheelRevealPayload['order'][number];
type ManagerPoolItem = { nominationId: string; movieId: string; providerId: string; movie: Preview['movie'] };

/** The winning poster morphs from the wheel into the hero; both ends share this. */
const WINNER_SHARE_ID = 'club-wheel-winner';

/**
 * The wheel, end to end.
 *
 * Four states, one screen: the picks waiting to be spun, the spin itself, a
 * held beat, and the film. The server owns the outcome throughout — the client
 * asks for a result, is told one, and animates towards it. Wheel-authorized
 * members can also curate the pool or explicitly set a manual result before
 * the round is resolved; a replay always uses the same committed result.
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
  poolCount,
  canEditPool,
  canChooseWinnerManually,
  canOverrideResult,
  poolWasOverridden,
  managerPool,
  spun,
  revealed,
  resultMode,
  initialPayload,
  selectionMovieLabel,
  canPlanMovieNight = false,
  members = [],
  memberLine,
  theme = null,
}: {
  clubId: string;
  clubSlug: string;
  clubName: string;
  roundId: string;
  previews: Preview[];
  canSpin: boolean;
  allReady: boolean;
  poolCount: number;
  canEditPool: boolean;
  canChooseWinnerManually: boolean;
  canOverrideResult: boolean;
  poolWasOverridden: boolean;
  managerPool: ManagerPoolItem[];
  spun: boolean;
  revealed: boolean;
  resultMode: 'random' | 'manual';
  initialPayload: WheelRevealPayload | null;
  selectionMovieLabel: string;
  canPlanMovieNight?: boolean;
  /** Who is in the club, shown under the wheel as presence. */
  members?: AvatarUser[];
  /** "8 members · Monthly". */
  memberLine?: string;
  /** The round's theme, if it has one. Lightly tints the wheel's ambience. */
  theme?: ThemeInfo | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payload, setPayload] = useState<WheelRevealPayload | null>(initialPayload);
  const [currentResultMode, setCurrentResultMode] = useState(resultMode);
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'spinning' | 'settling' | 'revealed'>(
    revealed ? 'revealed' : spun ? 'waiting' : 'ready',
  );
  const [poolEditorOpen, setPoolEditorOpen] = useState(false);
  const [poolFilms, setPoolFilms] = useState<PickedFilm[]>(() => managerPool.map((item) => ({
    movieId: item.movieId,
    providerId: item.providerId,
    slug: item.movie.slug,
    title: item.movie.title,
    year: item.movie.year,
    posterPath: item.movie.posterPath,
  })));
  const [manualWinnerId, setManualWinnerId] = useState<string | null>(null);
  const [choosingWinner, setChoosingWinner] = useState(false);

  const cards = payload?.order ?? previews;
  const winner = payload?.winner ?? null;
  const spinning = phase === 'spinning' || phase === 'settling';

  // The reveal must happen exactly once per attempt, whichever of the two
  // paths below gets there first.
  const finishing = useRef(false);

  function planMovieNight() {
    const anchor = window.matchMedia('(min-width: 64rem)').matches
      ? 'club-schedule'
      : 'club-schedule-m';
    router.push(`/club/${clubSlug}#${anchor}`);
  }

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
  const onSettled = useCallback(() => {
    setPhase('settling');
    window.setTimeout(() => finish('animated'), WHEEL.revealHold * 1000);
  }, [finish]);

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
      if (mode === 'reveal' && currentResultMode === 'manual') {
        const completed = await completeWheelRevealAction({ roundId, clubId, method: 'skipped' });
        if (!completed.ok) {
          toast({ message: completed.error, tone: 'error' });
          return;
        }
        setPhase('revealed');
        router.refresh();
      } else {
        setPhase('spinning');
      }
    });
  }

  function savePool() {
    startTransition(async () => {
      const result = await replaceWheelPoolAction({
        roundId,
        clubId,
        movies: poolFilms.map((film) => ({ movieId: film.movieId, providerId: film.providerId })),
      });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setPoolEditorOpen(false);
      setManualWinnerId(null);
      toast({ message: 'Wheel movies updated. Picks are now closed.', tone: 'success' });
      router.refresh();
    });
  }

  function chooseWinnerManually() {
    if (!manualWinnerId) return;
    setChoosingWinner(true);
    startTransition(async () => {
      const result = await setWheelWinnerManuallyAction({ roundId, clubId, nominationId: manualWinnerId });
      if (!result.ok) {
        setChoosingWinner(false);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      const reveal = await beginWheelRevealAction(roundId, clubId);
      setChoosingWinner(false);
      if (!reveal.ok) {
        toast({ message: reveal.error, tone: 'error' });
        router.refresh();
        return;
      }
      setPayload(reveal.data);
      setCurrentResultMode('manual');
      setPhase('waiting');
      toast({ message: 'The result is set. You can reveal it to the club.', tone: 'success' });
    });
  }

  function correctWinnerManually() {
    if (!manualWinnerId) return;
    setChoosingWinner(true);
    startTransition(async () => {
      const result = await setWheelWinnerManuallyAction({ roundId, clubId, nominationId: manualWinnerId });
      if (!result.ok) {
        setChoosingWinner(false);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      const reveal = await beginWheelRevealAction(roundId, clubId);
      setChoosingWinner(false);
      if (!reveal.ok) {
        toast({ message: reveal.error, tone: 'error' });
        router.refresh();
        return;
      }
      setPayload(reveal.data);
      setCurrentResultMode('manual');
      setManualWinnerId(null);
      toast({ message: 'The result has been corrected for the club.', tone: 'success' });
      router.refresh();
    });
  }

  /** Replays the same committed result. It never asks the server for a new one. */
  function replay() {
    if (!payload) return;
    finishing.current = false;
    setPhase('spinning');
  }

  function skipWaitingReveal() {
    startTransition(async () => {
      let revealPayload = payload;
      if (!revealPayload) {
        const reveal = await beginWheelRevealAction(roundId, clubId);
        if (!reveal.ok) {
          toast({ message: reveal.error, tone: 'error' });
          return;
        }
        revealPayload = reveal.data;
      }
      const result = await completeWheelRevealAction({ roundId, clubId, method: 'skipped' });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setPayload(revealPayload);
      setPhase('revealed');
      router.refresh();
    });
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
          {currentResultMode === 'manual' ? <p className="mt-2 rounded-full border border-line px-3 py-1 text-xs text-muted">Chosen manually</p> : null}
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
                <button
                  type="button"
                  onClick={planMovieNight}
                  className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-inverse"
                >
                  Plan movie night
                </button>
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

          {canOverrideResult && managerPool.length > 1 ? (
            <div className="mt-8 w-full rounded-xl border border-line p-3 text-left">
              <p className="text-sm font-medium">Correct the result</p>
              <p className="mt-1 text-xs text-dim">Choose the movie your group actually selected. This also updates any movie night linked to this round.</p>
              <ul className="mt-3 space-y-1.5">
                {managerPool.map((item) => (
                  <li key={item.nominationId}>
                    <button
                      type="button"
                      disabled={pending || choosingWinner || item.nominationId === winner.nominationId}
                      aria-pressed={manualWinnerId === item.nominationId}
                      onClick={() => setManualWinnerId(item.nominationId)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 text-left disabled:opacity-55 ${manualWinnerId === item.nominationId ? 'border-iris bg-iris/10' : 'border-line hover:border-line-strong'}`}
                    >
                      <span className="w-8 shrink-0"><Poster film={item.movie} size="xs" linked={false} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.movie.title}</span>
                      <span className="text-xs text-iris">{item.nominationId === winner.nominationId ? 'Current result' : manualWinnerId === item.nominationId ? 'Selected' : 'Choose'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="lg"
                className="mt-3 w-full justify-center"
                disabled={!manualWinnerId || pending || choosingWinner}
                onClick={correctWinnerManually}
              >
                {choosingWinner ? 'Updating result…' : 'Save corrected result'}
              </Button>
            </div>
          ) : null}

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
      ? currentResultMode === 'manual' ? 'The result is ready' : 'The wheel has spun'
      : spinning
        ? selectionMovieLabel
        : selectionMovieLabel;

  const accent = themeAccent(theme?.themeId ? { id: theme.themeId, type: theme.themeType ?? 'custom' } : null);

  return (
    <section className="flex flex-col items-center py-2 text-center" aria-label="Movie Club wheel">
      <p className="eyebrow text-iris">{clubName}</p>
      {theme?.themeName && phase !== 'revealed' ? (
        <div className="mt-2 flex justify-center">
          <ThemeBadge theme={theme} />
        </div>
      ) : null}
      <h1 className="mt-1.5 font-display text-[2rem] leading-none">{heading}</h1>
      {phase === 'ready' ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-muted">
            {poolCount} {poolCount === 1 ? 'movie' : 'movies'} on the wheel
          </p>
          {poolWasOverridden ? <p className="text-xs text-iris">Pool selected together</p> : null}
          {theme?.themeName ? <p className="text-xs text-dim">{theme.themeName}</p> : null}
        </div>
      ) : null}

      <div
        className={cn('mt-7 w-full rounded-full', accent === 'ember' && !revealed && 'drop-shadow-[0_0_70px_rgba(234,88,50,0.32)]')}
      >
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
                className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-inverse disabled:opacity-45"
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
            {canEditPool ? (
              <button
                type="button"
                onClick={() => setPoolEditorOpen(true)}
                disabled={pending}
                className="min-h-11 w-full rounded-full border border-line px-4 text-sm text-muted hover:border-iris hover:text-text"
              >
                Edit movies on the wheel
              </button>
            ) : null}
            {canChooseWinnerManually ? (
              <div className="rounded-xl border border-line p-3 text-left">
                <p className="text-sm font-medium">Choose the result manually</p>
                <p className="mt-1 text-xs text-dim">Pick one movie from the wheel pool. The result stays hidden until each member reveals it.</p>
                <ul className="mt-3 space-y-1.5">
                  {previews.map((item) => (
                    <li key={item.nominationId}>
                      <button
                        type="button"
                        disabled={pending}
                        aria-pressed={manualWinnerId === item.nominationId}
                        onClick={() => setManualWinnerId(item.nominationId)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 text-left ${manualWinnerId === item.nominationId ? 'border-iris bg-iris/10' : 'border-line hover:border-line-strong'}`}
                      >
                        <span className="w-8 shrink-0"><Poster film={item.movie} size="xs" linked={false} /></span>
                        <span className="min-w-0 flex-1 truncate text-sm">{item.movie.title}</span>
                        <span className="text-xs text-iris">{manualWinnerId === item.nominationId ? 'Selected' : 'Choose'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-3 w-full justify-center"
                  disabled={!manualWinnerId || pending || choosingWinner}
                  onClick={chooseWinnerManually}
                >
                  {choosingWinner ? 'Setting result…' : 'Set this as the result'}
                </Button>
              </div>
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
                className="flex min-h-12 w-full items-center justify-center rounded-full bg-ember px-5 text-[0.9375rem] font-medium text-inverse"
              >
                {pending ? 'Opening…' : currentResultMode === 'manual' ? 'Show the result' : 'Watch the reveal'}
              </button>
            </Press>
            {currentResultMode === 'random' ? (
              <button
                type="button"
                onClick={skipWaitingReveal}
                disabled={pending}
                className="min-h-11 w-full text-xs text-muted underline underline-offset-2 hover:text-text"
              >
                Skip to the result
              </button>
            ) : null}
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

      <Sheet
        open={poolEditorOpen}
        onClose={() => setPoolEditorOpen(false)}
        title="Edit movies on the wheel"
        description="Choose the movies your group agreed on. Saving replaces the current pool and closes picks."
        size="md"
        footer={(
          <Button variant="iris" size="lg" className="w-full justify-center" disabled={pending || poolFilms.length < 2} onClick={savePool}>
            {pending ? 'Saving…' : `Save ${poolFilms.length} movies and close picks`}
          </Button>
        )}
      >
        <FilmPicker
          onPick={(film) => setPoolFilms((current) => {
            const duplicate = current.some((item) =>
              (film.providerId && item.providerId === film.providerId) ||
              (film.movieId && item.movieId === film.movieId),
            );
            return duplicate || current.length >= 20 ? current : [...current, film];
          })}
          placeholder="Search for a movie to add…"
        />
        <div className="mt-5">
          <p className="eyebrow">On the wheel · {poolFilms.length}/20</p>
          <ul className="mt-2 space-y-2">
            {poolFilms.map((film, index) => (
              <li key={`${film.movieId ?? film.providerId ?? film.title}-${index}`} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                <span className="w-10 shrink-0"><Poster film={{ slug: film.slug ?? film.movieId ?? '', title: film.title, year: film.year, posterPath: film.posterPath }} size="xs" linked={false} /></span>
                <span className="min-w-0 flex-1 truncate text-sm">{film.title}</span>
                <button type="button" onClick={() => setPoolFilms((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="min-h-11 px-2 text-xs text-muted underline underline-offset-2 hover:text-text">Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
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
