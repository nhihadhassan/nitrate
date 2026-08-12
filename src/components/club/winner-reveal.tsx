'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { filmHref } from '@/lib/links';
import { pluralize } from '@/lib/utils';

/**
 * The payoff moment. Deliberately theatrical but short — a beat of anticipation,
 * then the title. Respects reduced-motion via the global animation override.
 */
export function WinnerReveal({
  title,
  slug,
  votes,
  tied,
  onClose,
}: {
  title: string;
  slug: string;
  votes: number;
  tied: boolean;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Winning film"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 px-6 text-center backdrop-blur-sm"
    >
      <div>
        <p className="eyebrow text-iris">The votes are in</p>
        {revealed ? (
          <>
            <p className="animate-reveal mt-4 font-display text-5xl leading-tight sm:text-7xl">
              {title}
            </p>
            <p className="animate-rise mt-4 text-sm text-muted">
              {pluralize(votes, 'vote')}
              {tied ? ' · tie broken by earliest nomination' : ''}
            </p>
            <div className="animate-rise mt-8 flex flex-wrap justify-center gap-2">
              <Button asChild variant="iris">
                <Link href={filmHref({ slug })}>See the film</Link>
              </Button>
              <Button variant="outline" onClick={onClose}>
                Schedule it
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-6 font-display text-4xl text-dim">Counting…</p>
        )}
      </div>
    </div>
  );
}
