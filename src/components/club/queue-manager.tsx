'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { CheckIcon, TrashIcon } from '@/components/ui/icons';
import { EmptyState, Field, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { filmHref } from '@/lib/links';
import { cn, formatRuntime, pluralize } from '@/lib/utils';
import {
  addQueueItemAction,
  nominateAction,
  removeQueueItemAction,
  replaceNominationAction,
} from '@/server/actions/clubs';

type QueueItem = {
  id: string;
  note: string | null;
  addedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  onWatchlistCount: number;
  watchedByCount: number;
  alreadyScreened: boolean;
  movie: {
    id: string;
    slug: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    runtime: number | null;
  };
};

type Sort = 'added' | 'wanted' | 'unseen' | 'runtime';

type ActiveRound = {
  id: string;
  mode: 'vote' | 'wheel';
  limit: number;
  myPicks: { id: string; movieId: string }[];
};

export function QueueManager({
  clubId,
  clubSlug,
  viewerId,
  isAdmin,
  memberCount,
  items,
  activeRound,
}: {
  clubId: string;
  clubSlug: string;
  viewerId: string;
  isAdmin: boolean;
  memberCount: number;
  items: QueueItem[];
  activeRound: ActiveRound | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<Sort>('added');
  const [pending, startTransition] = useTransition();

  function pickForRound(item: QueueItem) {
    if (!activeRound) return;
    const current = activeRound.myPicks[0];
    startTransition(async () => {
      const result =
        activeRound.limit === 1 && current
          ? await replaceNominationAction({
              nominationId: current.id,
              roundId: activeRound.id,
              clubId,
              movieId: item.movie.id,
            })
          : await nominateAction({ roundId: activeRound.id, clubId, movieId: item.movie.id });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: `${item.movie.title} is your pick`, tone: 'success' });
      router.push(`/club/${clubSlug}`);
      router.refresh();
    });
  }

  const sorted = [...items].sort((a, b) => {
    if (sort === 'wanted') return b.onWatchlistCount - a.onWatchlistCount;
    if (sort === 'unseen') return a.watchedByCount - b.watchedByCount;
    if (sort === 'runtime') return (a.movie.runtime ?? 9999) - (b.movie.runtime ?? 9999);
    return 0;
  });

  const SORTS: { key: Sort; label: string }[] = [
    { key: 'added', label: 'Recently added' },
    { key: 'wanted', label: 'Most wanted' },
    { key: 'unseen', label: 'Fewest have seen' },
    { key: 'runtime', label: 'Shortest' },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">Movie Ideas</h2>
          <p className="mt-0.5 text-sm text-muted">
            {pluralize(items.length, 'movie')} saved for a future movie night.
          </p>
        </div>
        <Button variant="iris" onClick={() => setAdding(true)}>
          Save an idea
        </Button>
      </div>

      {items.length > 1 ? (
        <nav aria-label="Sort queue" className="mb-4 flex flex-wrap gap-1 text-xs">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              aria-pressed={sort === option.key}
              className={cn(
                'rounded-md border px-2.5 py-1 transition-colors',
                sort === option.key
                  ? 'border-iris/40 bg-iris/10 text-iris'
                  : 'border-line text-muted hover:text-text',
              )}
            >
              {option.label}
            </button>
          ))}
        </nav>
      ) : null}

      {sorted.length ? (
        <ul className="space-y-2.5">
          {sorted.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-lg border border-line p-3">
              <div className="w-14 shrink-0">
                <Poster film={item.movie} size="xs" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={filmHref(item.movie)} className="font-medium hover:text-iris">
                      {item.movie.title}
                    </Link>
                    <p className="text-xs text-dim tabular">
                      {item.movie.year}
                      {item.movie.runtime ? ` · ${formatRuntime(item.movie.runtime)}` : ''}
                    </p>
                  </div>
                  {item.addedBy.id === viewerId || isAdmin ? (
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${item.movie.title} from the queue`}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeQueueItemAction(clubId, item.id);
                          if (!result.ok) {
                            toast({ message: result.error, tone: 'error' });
                            return;
                          }
                          router.refresh();
                        })
                      }
                      className="shrink-0 rounded-xs p-1 text-dim transition-colors hover:text-rose"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {item.note ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">“{item.note}”</p>
                ) : null}

                {/* The group context that actually helps a decision get made. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
                  <UserChip user={item.addedBy} size="xs" />
                  {item.onWatchlistCount > 0 ? (
                    <span className="text-ember">
                      {item.onWatchlistCount} of {memberCount} want it
                    </span>
                  ) : null}
                  {item.watchedByCount > 0 ? (
                    <span className="text-dim">{item.watchedByCount} already seen it</span>
                  ) : (
                    <span className="text-jade">Nobody has seen it</span>
                  )}
                  {item.alreadyScreened ? (
                    <span className="inline-flex items-center gap-1 text-iris">
                      <CheckIcon className="h-3 w-3" />
                      Club watched this
                    </span>
                  ) : null}
                </div>
                {activeRound && !activeRound.myPicks.some((pick) => pick.movieId === item.movie.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={pending || (activeRound.limit > 1 && activeRound.myPicks.length >= activeRound.limit)}
                    onClick={() => pickForRound(item)}
                  >
                    {activeRound.limit === 1 && activeRound.myPicks.length ? 'Change to this pick' : 'Pick for this round'}
                  </Button>
                ) : activeRound ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-jade">
                    <CheckIcon className="h-3.5 w-3.5" /> Your pick for this round
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No movie ideas yet"
          description="Save something the group might want to watch in a future round."
          action={
            <Button variant="iris" onClick={() => setAdding(true)}>
              Save an idea
            </Button>
          }
        />
      )}

      {adding ? (
        <AddToQueueSheet
          clubId={clubId}
          clubSlug={clubSlug}
          existing={items.map((i) => i.movie.id)}
          activeRound={activeRound}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

function AddToQueueSheet({
  clubId,
  clubSlug,
  existing,
  activeRound,
  onClose,
}: {
  clubId: string;
  clubSlug: string;
  existing: string[];
  activeRound: ActiveRound | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [film, setFilm] = useState<PickedFilm | null>(null);
  const [note, setNote] = useState('');
  const [savingForLater, setSavingForLater] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Save a movie idea"
      description="Movie Ideas are possibilities for a future round."
      footer={
        film && (savingForLater || !activeRound || activeRound.myPicks.length >= activeRound.limit) ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="iris"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await addQueueItemAction({
                    clubId,
                    movieId: film.movieId,
                    providerId: film.providerId,
                    note: note.trim() || null,
                  });
                  if (!result.ok) {
                    toast({ message: result.error, tone: 'error' });
                    return;
                  }
                  toast({ message: `${film.title} saved to Movie Ideas`, tone: 'success' });
                  onClose();
                  router.push(`/club/${clubSlug}/queue`);
                  router.refresh();
                })
              }
            >
              {pending ? 'Saving…' : 'Save for later'}
            </Button>
          </div>
        ) : null
      }
    >
      {film && activeRound && activeRound.myPicks.length < activeRound.limit && !savingForLater ? (
        <div className="space-y-4">
          <div>
            <p className="eyebrow text-iris">Active round</p>
            <h3 className="mt-1 text-xl">What do you want to do with this movie?</h3>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await nominateAction({
                  roundId: activeRound.id,
                  clubId,
                  movieId: film.movieId,
                  providerId: film.providerId,
                });
                if (!result.ok) {
                  toast({ message: result.error, tone: 'error' });
                  return;
                }
                toast({ message: `${film.title} is your pick`, tone: 'success' });
                onClose();
                router.push(`/club/${clubSlug}`);
                router.refresh();
              })
            }
            className="w-full rounded-md border border-iris/45 bg-iris/[0.08] p-4 text-left transition-colors hover:bg-iris/[0.12]"
          >
            <span className="block font-medium text-text">Pick it for this round</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              This becomes your movie in the current selection.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSavingForLater(true)}
            className="w-full rounded-md border border-line p-4 text-left transition-colors hover:border-line-strong"
          >
            <span className="block font-medium text-text">Save it for later</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              Add it to Movie Ideas for a future round.
            </span>
          </button>
          <button type="button" onClick={() => setFilm(null)} className="min-h-11 text-xs text-muted underline underline-offset-2 sm:min-h-0">
            Choose a different movie
          </button>
        </div>
      ) : film ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="min-w-0 truncate font-display text-lg">{film.title}</span>
            <button
              type="button"
              onClick={() => setFilm(null)}
              className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-iris"
            >
              Change
            </button>
          </div>
          <Field label="Why save this one?" htmlFor="queue-note" optional>
            <input
              id="queue-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={280}
              placeholder="Been meaning to watch this for years"
              className={inputClass}
            />
          </Field>
        </div>
      ) : (
        <FilmPicker autoFocus onPick={setFilm} excludeProviderIds={existing} />
      )}
    </Sheet>
  );
}
