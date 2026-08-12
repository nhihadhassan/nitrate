'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { SearchIcon } from '@/components/ui/icons';
import { posterUrl, profileUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

type SuggestItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  imagePath: string | null;
  shape: 'poster' | 'avatar' | 'profile' | 'none';
};

type SuggestGroup = { key: string; label: string; items: SuggestItem[] };

/**
 * Search → film → log is the product's core loop, so finding a film has to be
 * the fastest thing in the app. This is a real palette rather than a page:
 * `⌘K` or `/` from anywhere, results grouped by kind with artwork, arrow keys
 * to move, Enter to go. Escape hatches to the full results page for anything
 * the first handful of rows missed.
 */
export function QuickSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SuggestGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setGroups([]);
      return;
    }
  }, [open]);

  // Debounced fetch, with the previous request abandoned rather than raced.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('suggest failed');
        const data = (await response.json()) as { groups: SuggestGroup[] };
        setGroups(data.groups ?? []);
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const seeAll = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    go(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [go, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-backdrop absolute inset-0 bg-canvas/80 backdrop-blur-sm" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="search-dialog relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-canvas-raised shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-dim" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => (flat.length ? (index + 1) % flat.length : 0));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                const target = flat[active];
                if (target) go(target.href);
                else seeAll();
              }
            }}
            placeholder="Search films, cast, members, clubs…"
            aria-label="Search"
            className="h-12 w-full bg-transparent text-[0.9375rem] text-text placeholder:text-dim focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-xs border border-line px-1.5 py-0.5 text-[0.625rem] text-dim sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(28rem,60vh)] overflow-y-auto overscroll-contain">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-sm text-dim">
              Type at least two characters. Films, cast and crew, members, lists and clubs.
            </p>
          ) : loading && !flat.length ? (
            <div className="space-y-2 px-3.5 py-3" aria-label="Searching">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="skeleton h-10 w-7 shrink-0 rounded-xs" />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="skeleton block h-3 w-2/3 rounded-xs" />
                    <span className="skeleton block h-2.5 w-1/3 rounded-xs" />
                  </span>
                </div>
              ))}
            </div>
          ) : !flat.length ? (
            <p className="px-4 py-6 text-sm text-dim">
              Nothing matched “{query.trim()}”. Try the original title, or add a year.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" className="py-1.5">
              {groups.map((group) => (
                <li key={group.key} role="presentation">
                  <p className="eyebrow px-3.5 pb-1 pt-2.5">{group.label}</p>
                  <ul role="presentation">
                    {group.items.map((item) => {
                      const index = flat.indexOf(item);
                      return (
                        <li key={`${group.key}-${item.id}`} role="presentation">
                          <button
                            type="button"
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(item.href)}
                            className={cn(
                              'search-result flex w-full items-center gap-3 px-3.5 py-2 text-left',
                              index === active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                            )}
                          >
                            <Thumb item={item} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{item.title}</span>
                              {item.subtitle ? (
                                <span className="block truncate text-xs text-dim">{item.subtitle}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {query.trim().length >= 2 ? (
          <button
            type="button"
            onClick={seeAll}
            className="flex w-full items-center justify-between border-t border-line px-3.5 py-2.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <span>See all results for “{query.trim()}”</span>
            <span aria-hidden>↵</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Thumb({ item }: { item: SuggestItem }) {
  if (item.shape === 'none' || !item.imagePath) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex h-10 w-7 shrink-0 items-center justify-center rounded-xs bg-surface text-[0.625rem] text-dim',
          item.shape === 'avatar' || item.shape === 'profile' ? 'h-8 w-8 rounded-full' : '',
        )}
      >
        {item.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  const src =
    item.shape === 'poster'
      ? posterUrl(item.imagePath, 'xs')
      : item.shape === 'profile'
        ? profileUrl(item.imagePath, 'sm')
        : item.imagePath;

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- palette thumbnails are
       tiny, transient and must not queue behind the image optimiser. */
    <img
      src={src ?? ''}
      alt=""
      loading="lazy"
      className={cn(
        'shrink-0 bg-surface object-cover',
        item.shape === 'poster' ? 'h-10 w-7 rounded-xs' : 'h-8 w-8 rounded-full',
      )}
    />
  );
}

/** Global `⌘K` / `Ctrl-K` / `/` handler, mounted once in the app shell. */
export function useQuickSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
        return;
      }
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onOpen();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}
