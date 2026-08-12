'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SearchIcon } from '@/components/ui/icons';
import { posterUrl } from '@/lib/images';
import { inputClass } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export type PickedFilm = {
  providerId?: string;
  movieId?: string;
  slug?: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

type SearchResult = {
  providerId: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
};

const RECENT_KEY = 'nitrate-recent-films';

function readRecents(): PickedFilm[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as PickedFilm[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberFilm(film: PickedFilm) {
  try {
    const existing = readRecents().filter(
      (f) => f.providerId !== film.providerId || f.title !== film.title,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify([film, ...existing].slice(0, 8)));
  } catch {
    // Private browsing; recents are a nicety.
  }
}

/**
 * Debounced film search with keyboard navigation. Used by the log sheet, list
 * builder, club queue and nominations — anywhere a film has to be chosen.
 */
export function FilmPicker({
  onPick,
  autoFocus,
  placeholder = 'Search for a film…',
  excludeProviderIds,
  emptyHint,
}: {
  onPick: (film: PickedFilm) => void;
  autoFocus?: boolean;
  placeholder?: string;
  excludeProviderIds?: string[];
  emptyHint?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<PickedFilm[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setRecents(readRecents()), []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/search/films?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const json = (await response.json()) as { results: SearchResult[]; degraded: boolean };
        setResults(json.results ?? []);
        setDegraded(Boolean(json.degraded));
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  const visible = useMemo(
    () => results.filter((r) => !excludeProviderIds?.includes(r.providerId)),
    [results, excludeProviderIds],
  );

  function choose(film: PickedFilm) {
    rememberFilm(film);
    onPick(film);
  }

  const showRecents = query.trim().length < 2 && recents.length > 0;

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, visible.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && visible[active]) {
              event.preventDefault();
              choose(visible[active]);
            }
          }}
          placeholder={placeholder}
          aria-label="Search for a film"
          aria-autocomplete="list"
          aria-controls="film-picker-results"
          className={cn(inputClass, 'pl-9')}
        />
        {loading ? (
          <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-line-strong border-t-ember" />
        ) : null}
      </div>

      {degraded ? (
        <p className="mt-2 text-xs text-amber">
          Showing films we already have — the film database is unreachable right now.
        </p>
      ) : null}

      <ul id="film-picker-results" role="listbox" className="mt-2 space-y-0.5">
        {showRecents ? (
          <>
            <li className="px-1 py-1.5">
              <p className="eyebrow">Recent</p>
            </li>
            {recents.map((film) => (
              <li key={`${film.providerId}-${film.title}`}>
                <ResultRow film={film} onPick={() => choose(film)} />
              </li>
            ))}
          </>
        ) : null}

        {visible.map((film, index) => (
          <li key={film.providerId}>
            <ResultRow
              film={film}
              subtitle={film.overview ?? undefined}
              active={index === active}
              onPick={() =>
                choose({
                  providerId: film.providerId,
                  title: film.title,
                  year: film.year,
                  posterPath: film.posterPath,
                })
              }
            />
          </li>
        ))}
      </ul>

      {!loading && query.trim().length >= 2 && visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-dim">
          Nothing matched “{query.trim()}”. Try the original title, or add the year.
        </p>
      ) : null}

      {!showRecents && query.trim().length < 2 && emptyHint ? (
        <div className="px-1 py-6 text-center text-sm text-dim">{emptyHint}</div>
      ) : null}
    </div>
  );
}

function ResultRow({
  film,
  subtitle,
  active,
  onPick,
}: {
  film: { title: string; year: number | null; posterPath: string | null };
  subtitle?: string;
  active?: boolean;
  onPick: () => void;
}) {
  const url = posterUrl(film.posterPath, 'xs');
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onPick}
      className={cn(
        'flex min-h-16 w-full touch-manipulation items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
      )}
    >
      <span className="relative h-14 w-[2.375rem] shrink-0 overflow-hidden rounded-xs bg-surface">
        {url ? (
          <Image src={url} alt="" fill sizes="38px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[0.5rem] text-dim">
            No art
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-medium">{film.title}</span>
          {film.year ? <span className="shrink-0 text-xs text-dim tabular">{film.year}</span> : null}
        </span>
        {subtitle ? <span className="mt-0.5 block truncate text-xs text-dim">{subtitle}</span> : null}
      </span>
    </button>
  );
}
