'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useOptimistic, useRef, useState, useTransition } from 'react';

import { Press, TickingCount } from '@/components/motion/primitives';
import { CheckIcon, XIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { SPRING } from '@/lib/motion';
import type { RsvpStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { setRsvpAction } from '@/server/actions/clubs';

const OPTIONS: { value: RsvpStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'going', label: 'Going', icon: <CheckIcon className="h-3.5 w-3.5" /> },
  { value: 'maybe', label: 'Maybe', icon: <span aria-hidden className="text-[0.8125rem] leading-none">?</span> },
  { value: 'cant', label: 'Can’t', icon: <XIcon className="h-3.5 w-3.5" /> },
];

/**
 * RSVP as one tactile control rather than a button plus a dropdown.
 *
 * The three answers are equally reachable, which is the point — "can't come"
 * should not be hidden behind a menu. The selection commits immediately and
 * the highlight slides to it; the motion never delays the write, and the
 * count updates from the value it had rather than counting up from zero.
 */
export function RsvpSegmented({
  screeningId,
  clubSlug,
  current,
  goingCount,
  maybeCount = 0,
}: {
  screeningId: string;
  clubSlug: string;
  current: RsvpStatus | null;
  goingCount: number;
  maybeCount?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<RsvpStatus | null>(current);
  // The count the viewer sees moves the instant they answer, then reconciles
  // with the server on refresh.
  const [optimisticGoing, setOptimisticGoing] = useOptimistic(goingCount);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(option: RsvpStatus) {
    if (option === value) return;
    const previous = value;
    setValue(option);
    startTransition(async () => {
      const delta = (option === 'going' ? 1 : 0) - (previous === 'going' ? 1 : 0);
      setOptimisticGoing(goingCount + delta);
      const result = await setRsvpAction({ screeningId, clubSlug, rsvp: option });
      if (!result.ok) {
        setValue(previous);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      router.refresh();
    });
  }

  /**
   * A radiogroup is expected to behave like one: arrow keys move between the
   * answers and only the active answer is in the tab order, so a keyboard or
   * screen-reader user reaches the control once and cycles inside it.
   */
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    refs.current[next]?.focus();
    choose(OPTIONS[next].value);
  }

  // With nothing chosen yet the first answer holds the tab stop.
  const activeIndex = Math.max(
    OPTIONS.findIndex((option) => option.value === value),
    0,
  );

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Your RSVP"
        className="relative grid grid-cols-3 gap-1 rounded-full border border-line bg-surface/60 p-1"
      >
        {OPTIONS.map((option, index) => {
          const selected = value === option.value;
          return (
            <Press key={option.value}>
              <button
                type="button"
                role="radio"
                ref={(node) => {
                  refs.current[index] = node;
                }}
                tabIndex={index === activeIndex ? 0 : -1}
                aria-checked={selected}
                disabled={pending}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  'relative flex min-h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
                  selected ? 'text-canvas' : 'text-muted hover:text-text',
                )}
              >
                {selected ? (
                  <motion.span
                    aria-hidden
                    layoutId={reduced ? undefined : 'rsvp-selection'}
                    transition={SPRING.layout}
                    className={cn(
                      'absolute inset-0 rounded-full',
                      option.value === 'going' && 'bg-jade',
                      option.value === 'maybe' && 'bg-amber',
                      option.value === 'cant' && 'bg-surface-strong',
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative flex items-center gap-1.5',
                    option.value === 'cant' && selected && 'text-text',
                  )}
                >
                  {option.icon}
                  {option.label}
                </span>
              </button>
            </Press>
          );
        })}
      </div>

      <p className="mt-2.5 text-center text-xs text-dim">
        <TickingCount value={optimisticGoing} className="text-muted" /> going
        {maybeCount ? ` · ${maybeCount} maybe` : ''}
      </p>
    </div>
  );
}
