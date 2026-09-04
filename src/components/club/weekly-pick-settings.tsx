'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { setWeeklyPickAction } from '@/server/actions/clubs';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeeklyPickSettings({
  clubId,
  timezone,
  initial,
}: {
  clubId: string;
  timezone: string;
  initial: { enabled: boolean; day: number; hour: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [day, setDay] = useState(initial.day);
  // Stored but not editable while the job runs once a day; kept for a finer schedule later.
  const hour = initial.hour;
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border border-line p-4">
      <h2 className="text-xl">Automatic selections</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Start a selection automatically each week and email everyone to pick a movie. When
        the club is ready, anyone can spin the wheel.
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--iris)]"
        />
        <span className="text-sm">
          Open the weekly selection automatically
          <span className="mt-0.5 block text-xs text-dim">
            Skipped automatically if a round is already in progress.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="mt-4 max-w-xs">
          <Field
            label="Start choosing on"
            htmlFor="weekly-day"
            hint={`Each ${DAYS[day]}, in ${timezone}.`}
          >
            <select
              id="weekly-day"
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
              className={inputClass}
            >
              {DAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          variant="iris"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setWeeklyPickAction({ clubId, enabled, day, hour });
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              toast({
                message: enabled ? 'Automatic selections are on' : 'Automatic selections are off',
                tone: 'success',
              });
              router.refresh();
            })
          }
        >
          {pending ? 'Saving…' : 'Save automation'}
        </Button>
      </div>
    </section>
  );
}
