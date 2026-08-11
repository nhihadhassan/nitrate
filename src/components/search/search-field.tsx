'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SearchIcon } from '@/components/ui/icons';
import { inputClass } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'nitrate-recent-searches';

function readRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function SearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setRecents(readRecents()), []);

  useEffect(() => {
    if (!initialQuery) return;
    try {
      const next = [initialQuery, ...readRecents().filter((r) => r !== initialQuery)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecents(next);
    } catch {
      /* private mode */
    }
  }, [initialQuery]);

  // Debounced navigation: typing updates the URL, which re-runs the server search.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === initialQuery) return;
    const timer = window.setTimeout(() => {
      router.replace(trimmed.length >= 2 ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, initialQuery, router]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          placeholder="Films, people, lists, clubs…"
          aria-label="Search Nitrate"
          className={cn(inputClass, 'h-11 pl-9 text-base')}
        />
      </div>

      {!value.trim() && recents.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-dim">Recent:</span>
          {recents.map((recent) => (
            <button
              key={recent}
              type="button"
              onClick={() => {
                setValue(recent);
                router.replace(`/search?q=${encodeURIComponent(recent)}`);
              }}
              className="rounded-xs border border-line px-2 py-0.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
            >
              {recent}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(RECENT_KEY);
              setRecents([]);
            }}
            className="text-xs text-dim underline underline-offset-2 hover:text-muted"
          >
            clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
