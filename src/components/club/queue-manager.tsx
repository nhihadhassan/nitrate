'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { CheckIcon, PlusIcon, SearchIcon, SparkIcon, TrashIcon, UsersIcon } from '@/components/ui/icons';
import { EmptyState, Field, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { filmHref } from '@/lib/links';
import { posterUrl } from '@/lib/images';
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

type DiscoveryMovie = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtime?: number | null;
};

type DiscoverySection = {
  id: string;
  title: string;
  subtitle: string;
  items: { movie: DiscoveryMovie; reason: string }[];
};

export function QueueManager({
  clubId,
  clubSlug,
  viewerId,
  isAdmin,
  memberCount,
  items,
  activeRound,
  discoverySections,
}: {
  clubId: string;
  clubSlug: string;
  viewerId: string;
  isAdmin: boolean;
  memberCount: number;
  items: QueueItem[];
  activeRound: ActiveRound | null;
  discoverySections: DiscoverySection[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<Sort>('added');
  const [pending, startTransition] = useTransition();
  const savedMovieIds = new Set(items.map((item) => item.movie.id));

  function saveDiscoveryMovie(movie: DiscoveryMovie) {
    startTransition(async () => {
      const result = await addQueueItemAction({ clubId, movieId: movie.id });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: `${movie.title} saved to Movie Ideas`, tone: 'success' });
      router.refresh();
    });
  }

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
      <div className="mb-5 flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Movie ideas</h1>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Search movies"
            className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm text-muted hover:border-line-strong hover:text-text sm:min-w-48 sm:justify-start"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Search movies</span>
          </button>
          <Button variant="primary" onClick={() => setAdding(true)} className="rounded-full">
            <PlusIcon className="h-4 w-4" />
            Add movie
          </Button>
        </div>
      </div>

      <nav aria-label="Movie idea sections" className="mobile-tabs -mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-1 text-xs sm:mx-0 sm:px-0">
        {discoverySections.filter((section) => section.items.length).map((section, index) => (
          <a key={section.id} href={`#${section.id}`} className={cn('flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4', index === 0 ? 'border-ember/70 bg-ember/10 text-ember' : 'border-line text-muted hover:text-text')}>
            {index === 0 ? <SparkIcon className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
            {section.title}
          </a>
        ))}
        <a href="#saved-by-your-club" className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-muted hover:text-text">
          <CheckIcon className="h-4 w-4" /> Saved
        </a>
      </nav>

      <div className="space-y-7">
        {discoverySections.filter((section) => section.items.length).map((section) => (
          <DiscoveryRail
            key={section.id}
            section={section}
            savedMovieIds={savedMovieIds}
            pending={pending}
            onSave={saveDiscoveryMovie}
          />
        ))}
      </div>

      <section id="saved-by-your-club" className="mt-9 scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl">Saved by your club</h2>
            <p className="mt-0.5 text-sm text-muted">
              {pluralize(items.length, 'movie')} · sorted by {SORTS.find((item) => item.key === sort)?.label.toLowerCase()}
            </p>
          </div>
        </div>

      {items.length > 1 ? (
        <nav aria-label="Sort saved movies" className="mb-4 flex flex-wrap gap-1 text-xs">
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
      </section>

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

function DiscoveryRail({
  section,
  savedMovieIds,
  pending,
  onSave,
}: {
  section: DiscoverySection;
  savedMovieIds: Set<string>;
  pending: boolean;
  onSave: (movie: DiscoveryMovie) => void;
}) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <div className="mb-2.5">
        <h2 className="font-display text-[1.65rem] leading-none sm:text-3xl">{section.title}</h2>
        <p className="mt-0.5 text-sm text-muted">{section.subtitle}</p>
      </div>
      <ul className="scroll-rail -mx-4 px-4 pr-10 sm:mx-0 sm:px-0">
        {section.items.slice(0, 8).map(({ movie, reason }) => {
          const saved = savedMovieIds.has(movie.id);
          const artwork = posterUrl(movie.posterPath, 'md');
          return (
            <li key={movie.id} className="scroll-rail-item w-[8.75rem] sm:w-[9.5rem]">
              <article className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line bg-canvas-raised">
                <Link href={filmHref(movie)} className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2" aria-label={`${movie.title}, ${movie.year ?? 'year unknown'}`}>
                  {artwork ? <Image src={artwork} alt="" fill sizes="(max-width: 640px) 140px, 152px" className="object-cover" unoptimized /> : null}
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/15 to-transparent" />
                </Link>
                <button
                  type="button"
                  disabled={pending || saved}
                  onClick={() => onSave(movie)}
                  aria-label={saved ? `${movie.title} is saved` : `Save ${movie.title} to Movie Ideas`}
                  className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-canvas/75 text-white backdrop-blur-sm disabled:text-jade"
                >
                  {saved ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-5 w-5" />}
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
                  <p className="truncate text-sm font-medium text-white">{movie.title}</p>
                  <p className="mt-0.5 text-xs text-white/65">
                    {[movie.year, movie.runtime ? formatRuntime(movie.runtime) : null].filter(Boolean).join(' · ')}
                  </p>
                  {reason ? <p className="mt-2 line-clamp-2 text-[0.6875rem] leading-tight text-iris">{reason}</p> : null}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
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
