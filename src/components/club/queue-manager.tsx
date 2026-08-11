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
import { cn, formatRuntime, pluralize } from '@/lib/utils';
import { addQueueItemAction, removeQueueItemAction } from '@/server/actions/clubs';

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

export function QueueManager({
  clubId,
  clubSlug,
  viewerId,
  isAdmin,
  memberCount,
  items,
}: {
  clubId: string;
  clubSlug: string;
  viewerId: string;
  isAdmin: boolean;
  memberCount: number;
  items: QueueItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<Sort>('added');
  const [pending, startTransition] = useTransition();

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
          <h2 className="text-2xl">Shared queue</h2>
          <p className="mt-0.5 text-sm text-muted">
            {pluralize(items.length, 'film')} the group might watch.
          </p>
        </div>
        <Button variant="iris" onClick={() => setAdding(true)}>
          Suggest a film
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
                    <Link href={`/film/${item.movie.slug}`} className="font-medium hover:text-iris">
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
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing in the queue"
          description="Add anything you would happily watch with this group. The queue feeds nominations."
          action={
            <Button variant="iris" onClick={() => setAdding(true)}>
              Suggest a film
            </Button>
          }
        />
      )}

      {adding ? (
        <AddToQueueSheet
          clubId={clubId}
          clubSlug={clubSlug}
          existing={items.map((i) => i.movie.id)}
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
  onClose,
}: {
  clubId: string;
  clubSlug: string;
  existing: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [film, setFilm] = useState<PickedFilm | null>(null);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Suggest a film"
      description="It goes on the shared queue for everyone to see."
      footer={
        film ? (
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
                  toast({ message: `${film.title} added to the queue`, tone: 'success' });
                  onClose();
                  router.push(`/club/${clubSlug}/queue`);
                  router.refresh();
                })
              }
            >
              {pending ? 'Adding…' : 'Add to queue'}
            </Button>
          </div>
        ) : null
      }
    >
      {film ? (
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
          <Field label="Why?" htmlFor="queue-note" optional>
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
