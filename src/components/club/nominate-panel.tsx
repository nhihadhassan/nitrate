'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Poster } from '@/components/film/poster';
import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { formatRuntime } from '@/lib/utils';
import { nominateAction, withdrawNominationAction } from '@/server/actions/clubs';

type NominationItem = {
  id: string;
  pitch: string | null;
  nominatedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: {
    slug: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    runtime: number | null;
  };
  isMine: boolean;
};

export function NominatePanel({
  clubId,
  clubSlug,
  roundId,
  limit,
  myNominations,
  nominations,
  queue,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  limit: number;
  myNominations: number;
  nominations: NominationItem[];
  queue: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const remaining = limit - myNominations;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="iris" onClick={() => setOpen(true)} disabled={remaining <= 0}>
          {remaining > 0 ? 'Nominate a film' : 'Nominations used'}
        </Button>
        <p className="text-xs text-dim">
          {remaining > 0
            ? `${remaining} of ${limit} nomination${limit === 1 ? '' : 's'} left`
            : 'You have used all your nominations for this round.'}
        </p>
      </div>

      {nominations.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {nominations.map((nomination) => (
            <li
              key={nomination.id}
              className="flex gap-3 rounded-lg border border-line p-3"
            >
              <div className="w-14 shrink-0">
                <Poster film={nomination.movie} size="xs" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nomination.movie.title}</p>
                <p className="text-xs text-dim tabular">
                  {nomination.movie.year}
                  {nomination.movie.runtime ? ` · ${formatRuntime(nomination.movie.runtime)}` : ''}
                </p>
                {nomination.pitch ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                    “{nomination.pitch}”
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <UserChip user={nomination.nominatedBy} size="xs" />
                  {nomination.isMine ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await withdrawNominationAction(nomination.id, clubSlug);
                          if (!result.ok) {
                            toast({ message: result.error, tone: 'error' });
                            return;
                          }
                          router.refresh();
                        })
                      }
                      className="shrink-0 text-[0.6875rem] text-dim hover:text-rose"
                    >
                      Withdraw
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-dim">
          No nominations yet. Put something forward.
        </p>
      )}

      {open ? (
        <NominateSheet
          clubId={clubId}
          roundId={roundId}
          queue={queue}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function NominateSheet({
  clubId,
  roundId,
  queue,
  onClose,
}: {
  clubId: string;
  roundId: string;
  queue: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [film, setFilm] = useState<PickedFilm | null>(null);
  const [pitch, setPitch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Nominate a film"
      description="One good sentence goes a long way when people are voting."
      footer={
        film ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="iris"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await nominateAction({
                    roundId,
                    clubId,
                    movieId: film.movieId,
                    providerId: film.providerId,
                    pitch: pitch.trim() || null,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  toast({ message: `${film.title} nominated`, tone: 'success' });
                  onClose();
                  router.refresh();
                });
              }}
            >
              {pending ? 'Nominating…' : 'Nominate'}
            </Button>
          </div>
        ) : null
      }
    >
      {film ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 shrink-0">
              <Poster
                film={{
                  slug: film.slug ?? film.providerId ?? '',
                  title: film.title,
                  year: film.year,
                  posterPath: film.posterPath,
                }}
                size="xs"
                linked={false}
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight">{film.title}</p>
              {film.year ? <p className="text-sm text-dim tabular">{film.year}</p> : null}
              <button
                type="button"
                onClick={() => setFilm(null)}
                className="mt-1 text-xs text-muted underline underline-offset-2 hover:text-iris"
              >
                Choose a different film
              </button>
            </div>
          </div>

          <Field label="Why this one?" htmlFor="nomination-pitch" optional>
            <textarea
              id="nomination-pitch"
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ninety minutes, nobody's seen it, and it's genuinely unhinged."
              className={inputClass}
            />
          </Field>

          <FormError>{error}</FormError>
        </div>
      ) : (
        <div className="space-y-5">
          {queue.length ? (
            <div>
              <p className="eyebrow mb-2">From your shared queue</p>
              <ul className="space-y-1">
                {queue.slice(0, 5).map((item) => (
                  <li key={item.movieId}>
                    <button
                      type="button"
                      onClick={() =>
                        setFilm({
                          movieId: item.movieId,
                          title: item.title,
                          year: item.year,
                          posterPath: item.posterPath,
                        })
                      }
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover"
                    >
                      {item.title}
                      {item.year ? <span className="ml-1.5 text-xs text-dim tabular">{item.year}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <FilmPicker autoFocus onPick={setFilm} placeholder="Search for a film…" />
        </div>
      )}
    </Sheet>
  );
}
