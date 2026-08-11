'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light' | 'system';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
];

function apply(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem('nitrate-theme', theme);
}

export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem('nitrate-theme') as Theme | null) ?? 'dark');
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
  }

  if (withLabel) {
    return (
      <div>
        <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-dim">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="flex gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mounted && theme === option.value}
              onClick={() => choose(option.value)}
              className={cn(
                'flex-1 rounded-xs border px-2 py-1 text-xs transition-colors',
                mounted && theme === option.value
                  ? 'border-ember/40 bg-ember/12 text-ember'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => choose(theme === 'light' ? 'dark' : 'light')}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-text"
    >
      <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <path d="M20 13.5A8.2 8.2 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
