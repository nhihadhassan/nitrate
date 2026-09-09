'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { CalendarIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { clubLocalInputValue, clubLocalToInstant } from '@/lib/utils';
import { updateScreeningAction } from '@/server/actions/clubs';

const EDIT_DATE_EVENT = 'nitrate:edit-movie-night-date';

/** Opens the existing permission-checked planner directly at its date picker. */
export function MovieNightDateTrigger({ dateLabel, className }: { dateLabel: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EDIT_DATE_EVENT))}
      aria-label={`Change movie-night date, currently ${dateLabel}`}
      className={className}
    >
      <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-ember" />
      <span>{dateLabel}</span>
      <span className="text-[0.6875rem] font-normal text-muted underline decoration-line-strong underline-offset-4">Change</span>
    </button>
  );
}

/**
 * Everything about a booked night that can still change.
 *
 * The scheduling form only ever ran once, at creation, and there was no way
 * back into it — a night that moved, gained a location, or got a Partiful
 * later had to be cancelled and rebuilt. This is the same fields, reachable
 * afterwards, writing through the same permission-checked action.
 *
 * Closed by default: for most members most of the time the night is settled,
 * and an open form would compete with the RSVP for attention.
 */
export function MovieNightPlanner({
  screeningId,
  clubSlug,
  scheduledAt,
  location: initialLocation,
  watchLink: initialWatchLink,
  inviteLink: initialInviteLink,
  notes: initialNotes,
  isPast,
}: {
  screeningId: string;
  clubSlug: string;
  /** ISO instant; shown and edited as Toronto wall-clock. */
  scheduledAt: string;
  location: string | null;
  watchLink: string | null;
  inviteLink: string | null;
  notes: string | null;
  /** A night whose start time has gone by — the form leads with the date. */
  isPast: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [when, setWhen] = useState(() => clubLocalInputValue(new Date(scheduledAt)));
  const [location, setLocation] = useState(initialLocation ?? '');
  const [watchLink, setWatchLink] = useState(initialWatchLink ?? '');
  const [inviteLink, setInviteLink] = useState(initialInviteLink ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [openDateOnExpand, setOpenDateOnExpand] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function openDatePicker() {
      setOpenDateOnExpand(true);
      setOpen(true);
    }
    window.addEventListener(EDIT_DATE_EVENT, openDatePicker);
    return () => window.removeEventListener(EDIT_DATE_EVENT, openDatePicker);
  }, []);

  useEffect(() => {
    if (!open || !openDateOnExpand) return;
    const trigger = document.getElementById('night-when') as HTMLButtonElement | null;
    trigger?.focus({ preventScroll: true });
    trigger?.click();
    setOpenDateOnExpand(false);
  }, [open, openDateOnExpand]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-line p-4"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-muted hover:text-text">
        {isPast ? 'Move this night' : 'Edit movie night'}
        <span aria-hidden className="text-xs text-dim">
          {open ? 'Close' : 'Open'}
        </span>
      </summary>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const instant = clubLocalToInstant(when);
          if (Number.isNaN(instant.getTime())) {
            setError('Choose a date and time.');
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await updateScreeningAction({
              screeningId,
              clubSlug,
              scheduledAt: instant.toISOString(),
              location: location.trim() || null,
              watchLink: watchLink.trim() || null,
              inviteLink: inviteLink.trim() || null,
              notes: notes.trim() || null,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast({ message: 'Movie night updated', tone: 'success' });
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <FormError>{error}</FormError>

        <Field label="When" htmlFor="night-when" hint="Toronto time (ET)">
          <DateTimePicker
            id="night-when"
            value={when}
            onChange={setWhen}
            accent="iris"
            clearable={false}
            required
          />
        </Field>

        <Field label="Where" htmlFor="night-where" optional>
          <input
            id="night-where"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={200}
            placeholder="Sam's flat / the Rio / a call"
            className={inputClass}
          />
        </Field>

        <Field
          label="Invite link"
          htmlFor="night-invite"
          optional
          hint="Partiful, an event page, wherever people RSVP outside Nitrate."
        >
          <input
            id="night-invite"
            type="url"
            value={inviteLink}
            onChange={(event) => setInviteLink(event.target.value)}
            maxLength={500}
            placeholder="https://partiful.com/e/…"
            className={inputClass}
          />
        </Field>

        <Field label="Watch link" htmlFor="night-watch" optional hint="Streaming link, call link, ticket page.">
          <input
            id="night-watch"
            type="url"
            value={watchLink}
            onChange={(event) => setWatchLink(event.target.value)}
            maxLength={500}
            placeholder="https://"
            className={inputClass}
          />
        </Field>

        <Field label="Details" htmlFor="night-notes" optional>
          <textarea
            id="night-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Bring snacks. Starting on time for once."
            className={inputClass}
          />
        </Field>

        <Button type="submit" variant="iris" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </details>
  );
}
