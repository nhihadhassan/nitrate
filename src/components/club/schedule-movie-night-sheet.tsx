'use client';

import { useState } from 'react';

import { ScheduleScreeningForm } from '@/components/club/schedule-screening-form';
import { ScreeningPoll } from '@/components/club/screening-poll';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Poll = Parameters<typeof ScreeningPoll>[0]['poll'];

export function ScheduleMovieNightSheet({
  clubId,
  clubSlug,
  roundId,
  timezone,
  movie,
  poll,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  timezone: string;
  movie: { movieId: string; title: string; year: number | null; posterPath: string | null };
  poll: Poll;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'date' | 'poll'>('date');

  if (poll) {
    return <ScreeningPoll clubId={clubId} clubSlug={clubSlug} roundId={roundId} timezone={timezone} isAdmin poll={poll} />;
  }

  return (
    <>
      <div className="flex justify-center">
        <Button variant="iris" size="lg" onClick={() => setOpen(true)}>Choose a date</Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Schedule movie night" description={movie.title} size="lg">
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-surface p-1" role="tablist" aria-label="Scheduling method">
          {(['date', 'poll'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
              className={cn('min-h-11 rounded-md px-3 text-sm transition-colors', mode === item ? 'bg-canvas-raised font-medium text-text shadow-sm' : 'text-muted hover:text-text')}
            >
              {item === 'date' ? 'Choose a date' : 'Ask everyone'}
            </button>
          ))}
        </div>
        {mode === 'date' ? (
          <ScheduleScreeningForm clubId={clubId} clubSlug={clubSlug} roundId={roundId} timezone={timezone} movie={movie} />
        ) : (
          <ScreeningPoll clubId={clubId} clubSlug={clubSlug} roundId={roundId} timezone={timezone} isAdmin poll={null} />
        )}
      </Sheet>
    </>
  );
}
