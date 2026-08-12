'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { CalendarIcon, ChevronRightIcon, XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * A date and time field that reads like a sentence and opens a real calendar.
 *
 * Drop-in for `<input type="datetime-local">`: `value` and `onChange` speak the
 * same `YYYY-MM-DDTHH:mm` local-time string, so nothing downstream changes.
 * The native control was replaced because its rendering is browser roulette —
 * Chrome shows `2026-08-14, 10:23 PM` in a cramped tri-segment field, Safari and
 * Firefox each do something else, and none of it matches the product.
 *
 * Deliberately not using UTC anywhere: these are wall-clock times for a club in
 * a given timezone, and the caller already labels which one.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MINUTE_STEP = 5;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DDTHH:mm` → parts, or null for empty and malformed input. */
function parse(value: string): { y: number; m: number; d: number; h: number; min: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number) as unknown as number[];
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  return { y, m: m - 1, d, h, min };
}

function serialise(y: number, m: number, d: number, h: number, min: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(h)}:${pad(min)}`;
}

/** `June 12, 2026 · 4 PM` — minutes only when they carry information. */
function format(value: string): string | null {
  const parts = parse(value);
  if (!parts) return null;
  const hour12 = parts.h % 12 === 0 ? 12 : parts.h % 12;
  const meridiem = parts.h < 12 ? 'AM' : 'PM';
  const time = parts.min === 0 ? `${hour12} ${meridiem}` : `${hour12}:${pad(parts.min)} ${meridiem}`;
  return `${MONTHS[parts.m]} ${parts.d}, ${parts.y} · ${time}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, y: number, m: number, d: number): boolean {
  return a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;
}

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date and time',
  accent = 'ember',
  required,
  clearable = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Club surfaces are iris; everything else is ember. */
  accent?: 'ember' | 'iris';
  required?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const parsed = parse(value);
  const now = new Date();

  // The month on screen. Starts at the selected date, or today when empty.
  const [view, setView] = useState(() => ({
    y: parsed?.y ?? now.getFullYear(),
    m: parsed?.m ?? now.getMonth(),
  }));

  // Follow the value when it changes from outside while closed.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const next = parse(value);
    if (next && !open) setView({ y: next.y, m: next.m });
  }

  // Open upwards when the panel would not fit below — a field near the bottom
  // of a sheet is the common case for "when is movie night".
  const [dropUp, setDropUp] = useState(false);
  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const PANEL = 430;
    setDropUp(window.innerHeight - rect.bottom < PANEL && rect.top > PANEL);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); // Don't also close the surrounding sheet.
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    // Capture phase, so the picker wins the Escape before any parent modal.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  // Committing any part of the value fills in sensible defaults for the rest,
  // so picking a day on an empty field does not produce midnight by surprise.
  function commit(next: Partial<{ y: number; m: number; d: number; h: number; min: number }>) {
    const base = parsed ?? {
      y: now.getFullYear(),
      m: now.getMonth(),
      d: now.getDate(),
      h: 19,
      min: 0,
    };
    const merged = { ...base, ...next };
    const clampedDay = Math.min(merged.d, daysInMonth(merged.y, merged.m));
    onChange(serialise(merged.y, merged.m, clampedDay, merged.h, merged.min));
  }

  function shiftMonth(delta: number) {
    setView((current) => {
      const date = new Date(current.y, current.m + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth() };
    });
  }

  const grid = useMemo(() => {
    const leading = new Date(view.y, view.m, 1).getDay();
    const count = daysInMonth(view.y, view.m);
    const cells: (number | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= count; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const label = format(value);
  const accentBg = accent === 'iris' ? 'bg-iris' : 'bg-ember';
  const accentText = accent === 'iris' ? 'text-iris' : 'text-ember';
  const accentRing = accent === 'iris' ? 'outline-iris' : 'outline-ember';

  /** Arrow keys move by a day or a week, the way a calendar should behave. */
  function onGridKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, day: number) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();

    const target = new Date(view.y, view.m, day + delta);
    setView({ y: target.getFullYear(), m: target.getMonth() });
    commit({ y: target.getFullYear(), m: target.getMonth(), d: target.getDate() });

    // The grid re-renders; move focus onto whichever cell now holds the date.
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${target.getDate()}"]`)
        ?.focus();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-line bg-canvas-raised px-3 py-2 text-left text-sm',
          'transition-colors hover:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0',
          accentRing,
          open && 'border-line-strong',
        )}
      >
        <CalendarIcon className={cn('h-4 w-4 shrink-0', label ? accentText : 'text-dim')} />
        <span className={cn('flex-1 truncate', label ? 'text-text' : 'text-dim')}>
          {label ?? placeholder}
        </span>
        {label && clearable && !required ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onChange('');
            }}
            className="rounded p-0.5 text-dim transition-colors hover:text-text"
          >
            <XIcon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={labelId}
          className={cn(
            'absolute left-0 z-50 w-[19rem] rounded-xl border border-line bg-surface p-3 shadow-2xl',
            'motion-safe:animate-[picker-in_120ms_ease-out]',
            dropUp ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top',
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-canvas-raised hover:text-text"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </button>
            <span id={labelId} aria-live="polite" className="font-display text-base">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-canvas-raised hover:text-text"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5" aria-hidden>
            {WEEKDAYS.map((day, index) => (
              <span key={index} className="py-1 text-center text-[0.65rem] font-medium uppercase tracking-wider text-dim">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((day, index) => {
              if (day === null) return <span key={`pad-${index}`} />;
              const selected = parsed ? isSameDay(new Date(parsed.y, parsed.m, parsed.d), view.y, view.m, day) : false;
              const today = isSameDay(now, view.y, view.m, day);
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  // Only one cell is tabbable; arrows move within the grid.
                  tabIndex={selected || (!parsed && today) ? 0 : -1}
                  aria-pressed={selected}
                  onClick={() => commit({ y: view.y, m: view.m, d: day })}
                  onKeyDown={(event) => onGridKeyDown(event, day)}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                    selected
                      ? cn(accentBg, 'font-medium text-white')
                      : 'text-text hover:bg-canvas-raised',
                    !selected && today && cn('font-medium', accentText),
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-dim">Time</span>
              <div className="flex items-center gap-1">
                <Stepper
                  label="Hour"
                  value={parsed ? (parsed.h % 12 === 0 ? 12 : parsed.h % 12) : 7}
                  display={String(parsed ? (parsed.h % 12 === 0 ? 12 : parsed.h % 12) : 7)}
                  onStep={(delta) => {
                    const current = parsed?.h ?? 19;
                    commit({ h: (current + delta + 24) % 24 });
                  }}
                />
                <span className="text-sm text-dim">:</span>
                <Stepper
                  label="Minute"
                  value={parsed?.min ?? 0}
                  display={pad(parsed?.min ?? 0)}
                  onStep={(delta) => {
                    const current = parsed?.min ?? 0;
                    const next = (current + delta * MINUTE_STEP + 60) % 60;
                    commit({ min: Math.round(next / MINUTE_STEP) * MINUTE_STEP % 60 });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parsed?.h ?? 19;
                    commit({ h: (current + 12) % 24 });
                  }}
                  className={cn(
                    'ml-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium tabular-nums transition-colors hover:border-line-strong',
                    accentText,
                  )}
                >
                  {(parsed?.h ?? 19) < 12 ? 'AM' : 'PM'}
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {[
                { label: 'Tonight 7 PM', h: 19, days: 0 },
                { label: 'Tomorrow 7 PM', h: 19, days: 1 },
                { label: 'Friday 8 PM', h: 20, days: (5 - now.getDay() + 7) % 7 || 7 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + preset.days);
                    setView({ y: target.getFullYear(), m: target.getMonth() });
                    commit({
                      y: target.getFullYear(),
                      m: target.getMonth(),
                      d: target.getDate(),
                      h: preset.h,
                      min: 0,
                    });
                  }}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90',
                accentBg,
              )}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Up/down buttons plus arrow keys — no free typing, so nothing to validate. */
function Stepper({
  label,
  value,
  display,
  onStep,
}: {
  label: string;
  value: number;
  display: string;
  onStep: (delta: number) => void;
}) {
  return (
    <span
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={display}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onStep(1);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onStep(-1);
        }
      }}
      className="flex items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 focus:outline-none focus-visible:border-line-strong"
    >
      <span className="w-6 text-center text-sm tabular-nums">{display}</span>
      <span className="flex flex-col">
        <button
          type="button"
          aria-label={`${label} up`}
          onClick={() => onStep(1)}
          className="text-dim transition-colors hover:text-text"
        >
          <ChevronRightIcon className="h-3 w-3 -rotate-90" />
        </button>
        <button
          type="button"
          aria-label={`${label} down`}
          onClick={() => onStep(-1)}
          className="text-dim transition-colors hover:text-text"
        >
          <ChevronRightIcon className="h-3 w-3 rotate-90" />
        </button>
      </span>
    </span>
  );
}
