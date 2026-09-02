'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { useToast } from '@/components/ui/toast';
import { RSVP_LABELS, type RsvpStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { setRsvpAction } from '@/server/actions/clubs';

export function RsvpControls({
  screeningId,
  clubSlug,
  current,
}: {
  screeningId: string;
  clubSlug: string;
  current: RsvpStatus | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<RsvpStatus | null>(current);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDetailsElement>(null);

  const tones: Record<RsvpStatus, string> = {
    going: 'border-jade/50 bg-jade/12 text-jade',
    maybe: 'border-amber/50 bg-amber/12 text-amber',
    cant: 'border-line-strong bg-surface-strong text-muted',
  };

  const choose = (option: RsvpStatus) => {
    const previous = value;
    setValue(option);
    menuRef.current?.removeAttribute('open');
    startTransition(async () => {
      const result = await setRsvpAction({ screeningId, clubSlug, rsvp: option });
      if (!result.ok) {
        setValue(previous);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      router.refresh();
    });
  };

  return (
    <div aria-label="Your RSVP" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={value === 'going'}
        disabled={pending}
        onClick={() => choose('going')}
        className={cn(
          'min-h-11 rounded-md border px-5 text-sm font-medium transition-[border-color,background-color,transform] active:scale-[0.98]',
          value === 'going' ? tones.going : 'border-jade/40 bg-jade/10 text-jade hover:bg-jade/15',
        )}
      >
        {value === 'going' ? 'Going' : "I'm going"}
      </button>
      <details ref={menuRef} className="relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-line px-4 text-sm text-muted hover:border-line-strong hover:text-text">
          {value === 'maybe' || value === 'cant' ? RSVP_LABELS[value] : 'Other RSVP'}
        </summary>
        <div className="absolute left-0 top-full z-20 mt-1 min-w-40 rounded-md border border-line bg-canvas-raised p-1 shadow-pop">
          {(['maybe', 'cant'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            disabled={pending}
            onClick={() => choose(option)}
            className={cn(
              'flex min-h-10 w-full items-center rounded-xs px-3 text-left text-sm transition-colors',
              value === option ? tones[option] : 'text-muted hover:bg-surface-hover hover:text-text',
            )}
          >
            {RSVP_LABELS[option]}
          </button>
          ))}
        </div>
      </details>
    </div>
  );
}
