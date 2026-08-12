'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';

import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { StarInput } from '@/components/film/star-input';
import { LikeMark } from '@/components/film/stars';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { posterUrl } from '@/lib/images';
import { VISIBILITY_HINTS, VISIBILITY_LABELS, type Visibility } from '@/lib/types';
import { cn } from '@/lib/utils';
import { logFilmAction } from '@/server/actions/films';
import { updateFilmStateAction } from '@/server/actions/films';

export type LogSheetSeed = {
  film?: PickedFilm;
  /** Pre-fills from the viewer's existing state so a rewatch does not start blank. */
  initial?: {
    rating?: number | null;
    liked?: boolean;
    watched?: boolean;
    visibility?: Visibility;
  };
  screeningId?: string;
  title?: string;
  dateHint?: string;
};

function todayLocalIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function LogSheet({
  seed,
  onClose,
  onLogged,
}: {
  seed: LogSheetSeed;
  onClose: () => void;
  onLogged: (result: { entryId: string; movieSlug: string }) => void;
}) {
  const [film, setFilm] = useState<PickedFilm | null>(seed.film ?? null);
  const [watchedDate, setWatchedDate] = useState(seed.dateHint ?? todayLocalIso());
  const [rating, setRating] = useState<number | null>(seed.initial?.rating ?? null);
  const [liked, setLiked] = useState(seed.initial?.liked ?? false);
  const [review, setReview] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(seed.initial?.visibility ?? 'public');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const isRewatch = Boolean(seed.initial?.watched);
  const tags = tagInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  function submit() {
    if (!film) return;
    setError(null);
    startTransition(async () => {
      const result = await logFilmAction({
        movieId: film.movieId,
        providerId: film.providerId,
        watchedDate,
        rating,
        liked,
        reviewText: review.trim() || null,
        containsSpoilers: spoilers && Boolean(review.trim()),
        visibility,
        tags,
        isRewatch,
        screeningId: seed.screeningId ?? null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast({
        message: result.data.removedFromWatchlist
          ? `Logged ${film.title} · removed from your watchlist`
          : `Logged ${film.title}`,
        tone: 'success',
      });
      onLogged({ entryId: result.data.entryId, movieSlug: result.data.movieSlug });
    });
  }

  /** "Seen it, no idea when" — the historical-watch path that avoids fake dates. */
  function markWatchedOnly() {
    if (!film) return;
    setError(null);
    startTransition(async () => {
      const result = await updateFilmStateAction({
        movieId: film.movieId,
        providerId: film.providerId,
        watched: true,
        rating,
        liked,
        inWatchlist: false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ message: `Marked ${film.title} as watched`, tone: 'success' });
      onLogged({ entryId: '', movieSlug: result.data.movieSlug });
    });
  }

  const poster = film ? posterUrl(film.posterPath, 'sm') : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={seed.title ?? (film ? (isRewatch ? 'Log a rewatch' : 'Log this film') : 'Log a film')}
      description={film ? undefined : 'Find the film you watched.'}
      size="md"
      footer={
        film ? (
          <div className="flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:items-center">
            <Button
              variant="ghost"
              size="md"
              onClick={markWatchedOnly}
              disabled={pending}
              className="w-full justify-center min-[360px]:w-auto min-[360px]:shrink-0"
              title="Adds it to your films without inventing a date"
            >
              Seen it, no date
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={submit}
              disabled={pending}
              className="w-full justify-center min-[360px]:ml-auto min-[360px]:w-auto min-[360px]:min-w-28"
            >
              {pending ? 'Saving…' : isRewatch ? 'Log rewatch' : 'Log film'}
            </Button>
          </div>
        ) : null
      }
    >
      {!film ? (
        <FilmPicker autoFocus onPick={setFilm} />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="relative h-[6.75rem] w-18 shrink-0 overflow-hidden rounded-sm bg-surface" style={{ width: '4.5rem' }}>
              {poster ? (
                <Image src={poster} alt="" fill sizes="72px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center p-1 text-center text-[0.625rem] text-dim">
                  {film.title}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight">{film.title}</p>
              {film.year ? <p className="text-sm text-dim tabular">{film.year}</p> : null}
              {isRewatch ? (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-xs bg-iris/12 px-1.5 py-0.5 text-[0.6875rem] font-medium text-iris">
                  Rewatch — your earlier entries stay untouched
                </p>
              ) : null}
              {!seed.film ? (
                <button
                  type="button"
                  onClick={() => setFilm(null)}
                  className="mt-1 flex min-h-11 items-center text-sm text-muted underline underline-offset-2 hover:text-ember sm:min-h-0 sm:text-xs"
                >
                  Choose a different film
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date watched" htmlFor="log-date">
              <input
                id="log-date"
                type="date"
                value={watchedDate}
                max={todayLocalIso()}
                onChange={(event) => setWatchedDate(event.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Rating</span>
              <div className="flex h-10 items-center gap-3">
                <StarInput value={rating} onChange={setRating} size="md" />
                <button
                  type="button"
                  onClick={() => setLiked((v) => !v)}
                  aria-pressed={liked}
                  aria-label={liked ? 'Remove like' : 'Like this film'}
                  className={cn(
                    'flex h-11 w-11 touch-manipulation items-center justify-center rounded-md border text-lg transition-colors sm:h-9 sm:w-9',
                    liked
                      ? 'border-rose/40 bg-rose/12 text-rose'
                      : 'border-line text-dim hover:border-line-strong hover:text-muted',
                  )}
                >
                  <LikeMark filled={liked} className={liked ? 'animate-pop' : undefined} />
                </button>
              </div>
            </div>
          </div>

          <Field
            label="Review"
            htmlFor="log-review"
            optional
            hint="Markdown isn't supported yet — plain words work beautifully."
          >
            <textarea
              id="log-review"
              value={review}
              onChange={(event) => setReview(event.target.value)}
              rows={4}
              maxLength={10_000}
              placeholder="What stayed with you?"
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
          </Field>

          {review.trim() ? (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
              <input
                type="checkbox"
                checked={spoilers}
                onChange={(event) => setSpoilers(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
              />
              <span className="text-sm">
                <span className="font-medium">Contains spoilers</span>
                <span className="mt-0.5 block text-xs text-dim">
                  Readers will have to tap to reveal it.
                </span>
              </span>
            </label>
          ) : null}

          <Field label="Tags" htmlFor="log-tags" optional hint="Comma separated. e.g. rewatch, cinema, 2026">
            <input
              id="log-tags"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="cinema, with friends"
              className={inputClass}
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Who can see this</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  aria-pressed={visibility === option}
                  className={cn(
                    'flex min-h-12 touch-manipulation flex-col gap-0.5 rounded-md border px-2 py-2 text-left transition-colors sm:px-2.5',
                    visibility === option
                      ? 'border-ember/40 bg-ember/10'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="flex items-center gap-1 text-[0.8125rem] font-medium">
                    {visibility === option ? <CheckIcon className="h-3.5 w-3.5 text-ember" /> : null}
                    {VISIBILITY_LABELS[option]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-dim">{VISIBILITY_HINTS[visibility]}</p>
          </fieldset>

          <FormError>{error}</FormError>
        </div>
      )}
    </Sheet>
  );
}
