'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { setFavoritesAction } from '@/server/actions/profile';

export function FavoritesEditor({ initial }: { initial: PickedFilm[] }) {
  const router = useRouter();
  const toast = useToast();
  const [films, setFilms] = useState<PickedFilm[]>(initial);
  const [pending, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= films.length) return;
    const next = [...films];
    [next[index], next[target]] = [next[target], next[index]];
    setFilms(next);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl">Favourite films</h2>
        <p className="mt-1.5 text-sm text-muted">
          Four films, front and centre on your profile. Order matters.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((index) => {
          const film = films[index];
          return film ? (
            <div key={`${film.movieId ?? film.providerId}-${index}`}>
              <Poster
                film={{
                  slug: film.slug ?? film.providerId ?? '',
                  title: film.title,
                  year: film.year,
                  posterPath: film.posterPath,
                }}
                linked={false}
              />
              <div className="mt-1 flex justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${film.title} earlier`}
                  className="rounded-xs px-1.5 text-xs text-dim hover:text-text disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setFilms((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove ${film.title}`}
                  className="rounded-xs px-1.5 text-xs text-dim hover:text-rose"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === films.length - 1}
                  aria-label={`Move ${film.title} later`}
                  className="rounded-xs px-1.5 text-xs text-dim hover:text-text disabled:opacity-30"
                >
                  →
                </button>
              </div>
            </div>
          ) : (
            <div
              key={index}
              className="flex aspect-[2/3] items-center justify-center rounded-sm border border-dashed border-line text-2xl text-dim"
            >
              {index + 1}
            </div>
          );
        })}
      </div>

      {films.length < 4 ? (
        <FilmPicker
          placeholder="Search for a favourite…"
          excludeProviderIds={films.map((f) => f.providerId).filter(Boolean) as string[]}
          onPick={(film) => setFilms((current) => [...current, film].slice(0, 4))}
        />
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setFavoritesAction(
                films.map((f) => ({ movieId: f.movieId, providerId: f.providerId })),
              );
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              toast({ message: 'Favourites saved', tone: 'success' });
              router.refresh();
            })
          }
        >
          {pending ? 'Saving…' : 'Save favourites'}
        </Button>
      </div>
    </div>
  );
}
