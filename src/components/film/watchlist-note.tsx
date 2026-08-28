'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { updateWatchlistNoteAction } from '@/server/actions/films';

export function WatchlistNote({ movieId, initialNote }: { movieId: string; initialNote: string | null }) {
  const toast = useToast();
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(initialNote ?? '');
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <label htmlFor={`watchlist-note-${movieId}`} className="sr-only">Private watchlist note</label>
      <textarea
        id={`watchlist-note-${movieId}`}
        value={note}
        rows={2}
        maxLength={500}
        placeholder="Why you saved it (private)"
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          const next = note.trim();
          if (next === saved) return;
          startTransition(async () => {
            const result = await updateWatchlistNoteAction({ movieId, note: next || null });
            if (!result.ok) {
              setNote(saved);
              toast({ message: result.error, tone: 'error' });
              return;
            }
            setSaved(next);
          });
        }}
        className={cn(
          'w-full resize-none rounded-md border border-line bg-surface px-2.5 py-2 text-xs leading-relaxed text-muted outline-none',
          'placeholder:text-dim focus:border-ember/50 focus:ring-2 focus:ring-ember/15',
          pending && 'opacity-60',
        )}
      />
      <p className="mt-1 text-[0.625rem] text-dim" aria-live="polite">
        {pending ? 'Saving…' : 'Only you can see this note'}
      </p>
    </div>
  );
}
