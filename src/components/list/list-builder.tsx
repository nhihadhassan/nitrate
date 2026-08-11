'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { posterUrl } from '@/lib/images';
import { VISIBILITY_LABELS, type Visibility } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createListAction } from '@/server/actions/lists';

export function ListBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [isRanked, setIsRanked] = useState(false);
  const [films, setFilms] = useState<PickedFilm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= films.length) return;
    const next = [...films];
    [next[index], next[target]] = [next[target], next[index]];
    setFilms(next);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createListAction({
            title,
            description: description.trim() || null,
            visibility,
            isRanked,
            films: films.map((f) => ({ movieId: f.movieId, providerId: f.providerId })),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/list/${result.data.id}`);
        });
      }}
    >
      <FormError>{error}</FormError>

      <Field label="Title" htmlFor="list-title">
        <input
          id="list-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          placeholder="Films to watch when it rains"
          className={inputClass}
        />
      </Field>

      <Field label="Description" htmlFor="list-description" optional>
        <textarea
          id="list-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
          className={cn(inputClass, 'resize-y')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Visibility</legend>
          <div className="flex gap-1.5">
            {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVisibility(option)}
                aria-pressed={visibility === option}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors',
                  visibility === option
                    ? 'border-ember/40 bg-ember/10 text-ember'
                    : 'border-line text-muted hover:text-text',
                )}
              >
                {VISIBILITY_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <span className="mb-1.5 block text-sm font-medium">Ordering</span>
          <label className="flex h-[2.125rem] cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={isRanked}
              onChange={(event) => setIsRanked(event.target.checked)}
              className="h-4 w-4 accent-[var(--ember)]"
            />
            Ranked list — show numbers
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">
          Films <span className="font-normal text-dim">({films.length})</span>
        </p>
        <FilmPicker
          placeholder="Add a film…"
          excludeProviderIds={films.map((f) => f.providerId).filter(Boolean) as string[]}
          onPick={(film) => setFilms((current) => [...current, film])}
          emptyHint="Search above to start adding films."
        />
      </div>

      {films.length ? (
        <ol className="space-y-1.5">
          {films.map((film, index) => {
            const poster = posterUrl(film.posterPath, 'xs');
            return (
              <li
                key={`${film.providerId ?? film.movieId}-${index}`}
                className="flex items-center gap-3 rounded-md border border-line px-2.5 py-2"
              >
                {isRanked ? (
                  <span className="w-5 shrink-0 text-center text-sm text-dim tabular">{index + 1}</span>
                ) : null}
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-xs bg-surface">
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="32px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {film.title}
                  {film.year ? <span className="ml-1.5 text-xs text-dim tabular">{film.year}</span> : null}
                </span>
                <span className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${film.title} up`}
                    className="flex h-7 w-7 items-center justify-center rounded-xs text-dim transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === films.length - 1}
                    aria-label={`Move ${film.title} down`}
                    className="flex h-7 w-7 items-center justify-center rounded-xs text-dim transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilms((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove ${film.title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-xs text-dim transition-colors hover:bg-surface-hover hover:text-rose"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button type="submit" variant="primary" size="lg" disabled={pending || !title.trim()}>
          {pending ? 'Creating…' : 'Create list'}
        </Button>
      </div>
    </form>
  );
}
