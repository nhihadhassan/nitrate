'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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

  const tones: Record<RsvpStatus, string> = {
    going: 'border-jade/50 bg-jade/12 text-jade',
    maybe: 'border-amber/50 bg-amber/12 text-amber',
    cant: 'border-line-strong bg-surface-strong text-muted',
  };

  return (
    <div role="radiogroup" aria-label="Your RSVP" className="flex flex-wrap gap-2">
      {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => {
              const previous = value;
              setValue(option);
              startTransition(async () => {
                const result = await setRsvpAction({ screeningId, clubSlug, rsvp: option });
                if (!result.ok) {
                  setValue(previous);
                  toast({ message: result.error, tone: 'error' });
                  return;
                }
                router.refresh();
              });
            }}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              active ? tones[option] : 'border-line text-muted hover:border-line-strong hover:text-text',
            )}
          >
            {RSVP_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
