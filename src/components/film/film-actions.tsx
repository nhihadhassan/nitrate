'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';

import { useLogDialog } from '@/components/log/log-dialog-provider';
import { StarInput } from '@/components/film/star-input';
import { LikeMark } from '@/components/film/stars';
import { BookmarkIcon, CheckIcon, EyeIcon, PlusIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { filmHref, loginHref } from '@/lib/links';
import type { FilmRef } from '@/lib/types';
import { cn } from '@/lib/utils';
import { updateFilmStateAction } from '@/server/actions/films';

export type ViewerFilmState = {
  watched: boolean;
  liked: boolean;
  rating: number | null;
  inWatchlist: boolean;
  logCount: number;
};

/**
 * The primary control surface on a film page. Every toggle is optimistic and
 * reverts with an explanation if the server disagrees — the whole point is that
 * marking a film should feel like flipping a switch, not submitting a form.
 */
export function FilmActions({
  film,
  state,
  signedIn,
  layout = 'stacked',
}: {
  film: FilmRef;
  state: ViewerFilmState | null;
  signedIn: boolean;
  layout?: 'stacked' | 'inline';
}) {
  const router = useRouter();
  const toast = useToast();
  const { open } = useLogDialog();
  const [pending, startTransition] = useTransition();

  const base: ViewerFilmState = state ?? {
    watched: false,
    liked: false,
    rating: null,
    inWatchlist: false,
    logCount: 0,
  };
  const [current, setCurrent] = useState(base);

  // Logging happens in a sheet elsewhere on the page, which refreshes the server
  // component but does not remount this one. Re-sync when the server disagrees,
  // otherwise the buttons keep showing pre-log state.
  const serverSignature = `${base.watched}|${base.liked}|${base.rating}|${base.inWatchlist}|${base.logCount}`;
  const [lastSignature, setLastSignature] = useState(serverSignature);
  if (serverSignature !== lastSignature) {
    setLastSignature(serverSignature);
    setCurrent(base);
  }

  const [optimistic, applyOptimistic] = useOptimistic(
    current,
    (prev: ViewerFilmState, patch: Partial<ViewerFilmState>) => ({ ...prev, ...patch }),
  );

  function mutate(patch: Partial<ViewerFilmState>, message?: string, undo?: Partial<ViewerFilmState>) {
    if (!signedIn) {
      router.push(loginHref(filmHref(film)));
      return;
    }
    startTransition(async () => {
      applyOptimistic(patch);
      const result = await updateFilmStateAction({ movieId: film.id, ...patch });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      setCurrent((prev) => ({ ...prev, ...patch }));
      if (message) {
        toast({
          message,
          action: undo
            ? {
                label: 'Undo',
                onClick: () =>
                  startTransition(async () => {
                    applyOptimistic(undo);
                    await updateFilmStateAction({ movieId: film.id, ...undo });
                    setCurrent((prev) => ({ ...prev, ...undo }));
                    router.refresh();
                  }),
              }
            : undefined,
        });
      }
      router.refresh();
    });
  }

  const inline = layout === 'inline';

  return (
    <div className={cn('space-y-3', inline && 'space-y-2')}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            mutate(
              { watched: !optimistic.watched },
              optimistic.watched ? undefined : `Marked ${film.title} as watched`,
              optimistic.watched ? undefined : { watched: false },
            )
          }
          aria-pressed={optimistic.watched}
          disabled={pending}
          className={cn(
            'action-tile flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[0.6875rem] font-medium',
            optimistic.watched
              ? 'border-jade/40 bg-jade/12 text-jade'
              : 'border-line text-muted hover:border-line-strong hover:text-text',
          )}
        >
          {optimistic.watched ? (
            <CheckIcon className="h-[1.15rem] w-[1.15rem]" />
          ) : (
            <EyeIcon className="h-[1.15rem] w-[1.15rem]" />
          )}
          {optimistic.watched ? 'Watched' : 'Watch'}
        </button>

        <button
          type="button"
          onClick={() => mutate({ liked: !optimistic.liked })}
          aria-pressed={optimistic.liked}
          disabled={pending}
          className={cn(
            'action-tile flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[0.6875rem] font-medium',
            optimistic.liked
              ? 'border-rose/40 bg-rose/12 text-rose'
              : 'border-line text-muted hover:border-line-strong hover:text-text',
          )}
        >
          <LikeMark
            filled={optimistic.liked}
            className={cn('text-[1.15rem]', optimistic.liked && 'animate-pop')}
          />
          {optimistic.liked ? 'Liked' : 'Like'}
        </button>

        <button
          type="button"
          onClick={() =>
            mutate(
              { inWatchlist: !optimistic.inWatchlist },
              optimistic.inWatchlist ? 'Removed from watchlist' : 'Added to your watchlist',
              { inWatchlist: optimistic.inWatchlist },
            )
          }
          aria-pressed={optimistic.inWatchlist}
          disabled={pending}
          className={cn(
            'action-tile flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[0.6875rem] font-medium',
            optimistic.inWatchlist
              ? 'border-ember/40 bg-ember/12 text-ember'
              : 'border-line text-muted hover:border-line-strong hover:text-text',
          )}
        >
          <BookmarkIcon
            className={cn('action-icon h-[1.15rem] w-[1.15rem]', optimistic.inWatchlist && 'is-active')}
          />
          {optimistic.inWatchlist ? 'Saved' : 'Watchlist'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
        <span className="text-[0.8125rem] text-muted">Your rating</span>
        <StarInput
          value={optimistic.rating}
          size="sm"
          disabled={pending}
          onChange={(value) => mutate({ rating: value })}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          if (!signedIn) {
            router.push(loginHref(filmHref(film)));
            return;
          }
          open({
            film: {
              movieId: film.id,
              slug: film.slug,
              title: film.title,
              year: film.year,
              posterPath: film.posterPath,
            },
            initial: {
              rating: optimistic.rating,
              liked: optimistic.liked,
              watched: optimistic.watched,
            },
          });
        }}
        className="tactile-button flex w-full items-center justify-center gap-2 rounded-md bg-ember px-4 py-2.5 text-sm font-medium text-white hover:bg-ember-soft"
      >
        <PlusIcon className="h-4 w-4" />
        {optimistic.watched ? 'Log a rewatch' : 'Log this film'}
      </button>

      {optimistic.logCount > 0 ? (
        <p className="text-center text-xs text-dim">
          You&apos;ve logged this {optimistic.logCount === 1 ? 'once' : `${optimistic.logCount} times`}
        </p>
      ) : null}
    </div>
  );
}
