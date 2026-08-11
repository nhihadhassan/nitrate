'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Spoiler protection has to be a deliberate act, not a blur you can read
 * through. The text is not rendered at all until the reader asks for it, so it
 * cannot be revealed by selecting, screenshotting or inspecting the page.
 */
export function ReviewBody({
  text,
  containsSpoilers,
  clamp,
  className,
}: {
  text: string;
  containsSpoilers: boolean;
  clamp?: number;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(!containsSpoilers);

  if (!revealed) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-amber/40 bg-amber/[0.06] px-3 py-3 text-center',
          className,
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-amber">Contains spoilers</p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-1.5 text-sm text-muted underline underline-offset-2 transition-colors hover:text-text"
        >
          Reveal review
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {containsSpoilers ? (
        <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-amber">
          Spoilers
        </p>
      ) : null}
      <p
        className={cn(
          'whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted',
          clamp === 3 && 'line-clamp-3',
          clamp === 5 && 'line-clamp-5',
        )}
      >
        {text}
      </p>
    </div>
  );
}
