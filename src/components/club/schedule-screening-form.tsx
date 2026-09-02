'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { scheduleScreeningAction } from '@/server/actions/clubs';

function defaultWhen(): string {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  date.setHours(20, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ScheduleScreeningForm({
  clubId,
  clubSlug,
  roundId,
  timezone,
  movie,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string | null;
  timezone: string;
  movie?: { movieId: string; title: string; year: number | null; posterPath: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [film, setFilm] = useState<PickedFilm | null>(movie ?? null);
  const [when, setWhen] = useState(defaultWhen());
  const [location, setLocation] = useState('');
  const [watchLink, setWatchLink] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!film) {
          setError('Choose a film first.');
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await scheduleScreeningAction({
            clubId,
            roundId,
            movieId: film.movieId,
            providerId: film.providerId,
            scheduledAt: new Date(when).toISOString(),
            timezone,
            location: location.trim() || null,
            watchLink: watchLink.trim() || null,
            notes: notes.trim() || null,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast({ message: 'Movie night scheduled', tone: 'success' });
          router.push(`/club/${clubSlug}/screening/${result.data.screeningId}`);
          router.refresh();
        });
      }}
    >
      <FormError>{error}</FormError>

      {film ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {film.title}
            {film.year ? <span className="ml-1.5 text-xs text-dim tabular">{film.year}</span> : null}
          </span>
          {!movie ? (
            <button
              type="button"
              onClick={() => setFilm(null)}
              className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-iris"
            >
              Change
            </button>
          ) : null}
        </div>
      ) : (
        <FilmPicker onPick={setFilm} placeholder="Which film?" />
      )}

      <Field label="When" htmlFor="screening-when" hint={`Shown to members in ${timezone}`}>
        <DateTimePicker
          id="screening-when"
          value={when}
          onChange={setWhen}
          accent="iris"
          required
          placeholder="Pick a night"
        />
      </Field>

      <details className="rounded-lg border border-line p-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-muted hover:text-text">
          Add location, link or notes
        </summary>
        <div className="mt-3 space-y-4">
          <Field label="Where" htmlFor="screening-location" optional>
          <input
            id="screening-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={200}
            placeholder="Sam's flat / the Rio / a call"
            className={inputClass}
          />
          </Field>

          <Field label="Watch link" htmlFor="screening-link" optional hint="Streaming link, call link, ticket page.">
            <input
              id="screening-link"
              type="url"
              value={watchLink}
              onChange={(event) => setWatchLink(event.target.value)}
              maxLength={500}
              placeholder="https://"
              className={inputClass}
            />
          </Field>

          <Field label="Notes" htmlFor="screening-notes" optional>
            <textarea
              id="screening-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Bring snacks. Starting on time for once."
              className={cn(inputClass, 'resize-y')}
            />
          </Field>
        </div>
      </details>

      <div className="flex justify-end">
        <Button type="submit" variant="iris" disabled={pending || !film}>
          {pending ? 'Scheduling…' : 'Schedule movie night'}
        </Button>
      </div>
    </form>
  );
}
