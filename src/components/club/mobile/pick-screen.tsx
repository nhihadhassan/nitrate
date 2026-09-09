'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Press } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/user/avatar';
import { cn } from '@/lib/utils';
import {
  nominateAction,
  nominateForMemberAction,
  replaceNominationAction,
  withdrawNominationAction,
} from '@/server/actions/clubs';

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
  pickCount: number;
};

type Suggestion = {
  movieId: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

/**
 * Picking a movie, as curation rather than a form.
 *
 * One screen: who is still deciding, a wall of artwork to choose from, an
 * optional note, one submit. The note is genuinely optional and never blocks
 * the button.
 *
 * Submitting for another member goes through the same screen with the target
 * named in a bar that cannot be missed, because the failure mode that matters
 * is a helper's pick being recorded against the wrong person.
 */
export function PickScreen({
  clubId,
  clubSlug,
  roundId,
  limit,
  members,
  viewerId,
  canSubmitForOthers,
  myPicks,
  ideas,
  watchlist,
  suggestions,
  dueLabel,
  selectionLabel,
  pickingOpen,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  limit: number;
  members: Person[];
  viewerId: string;
  canSubmitForOthers: boolean;
  myPicks: { id: string; title: string; year: number | null; posterPath: string | null; slug: string }[];
  ideas: Suggestion[];
  watchlist: Suggestion[];
  suggestions: Suggestion[];
  dueLabel: string | null;
  selectionLabel: string;
  pickingOpen: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  /** Who this pick is being submitted for — null means the viewer. */
  const [proxyFor, setProxyFor] = useState<Person | null>(null);
  const [proxyOpen, setProxyOpen] = useState(false);
  const [film, setFilm] = useState<PickedFilm | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, limit - myPicks.length);
  const ready = members.filter((member) => member.pickCount >= limit);
  const stillDeciding = members.filter((member) => member.pickCount < limit);
  // You cannot submit on your own behalf through the proxy flow, so a club
  // where only you are left to pick offers nothing to submit for.
  const othersDeciding = stillDeciding.filter((member) => member.id !== viewerId);
  // "Change my pick" only makes sense for a one-pick round; with a bigger
  // allowance a member adds and removes picks instead.
  const replacingId = !proxyFor && limit === 1 && myPicks.length === 1 ? myPicks[0].id : null;

  const shelves = [
    { title: 'Movie Ideas', items: ideas },
    { title: 'Your watchlist', items: watchlist },
    { title: 'For this group', items: suggestions },
  ].filter((shelf) => shelf.items.length);

  function remove(nominationId: string) {
    startTransition(async () => {
      const result = await withdrawNominationAction(nominationId, clubSlug);
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      router.refresh();
    });
  }

  function submit() {
    if (!film) return;
    setError(null);
    startTransition(async () => {
      const input = {
        roundId,
        clubId,
        movieId: film.movieId,
        providerId: film.providerId,
        pitch: note.trim() || null,
      };
      const result = proxyFor
        ? await nominateForMemberAction({ ...input, nominatedForUserId: proxyFor.id })
        : replacingId
          ? await replaceNominationAction({ ...input, nominationId: replacingId })
          : await nominateAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({
        message: proxyFor ? `${film.title} submitted for ${proxyFor.displayName}` : `${film.title} is your pick`,
        tone: 'success',
      });
      setFilm(null);
      setNote('');
      setProxyFor(null);
      router.push(`/club/${clubSlug}`);
      router.refresh();
    });
  }

  return (
    <div className="pb-32">
      <header className="pt-2">
        <Link href={`/club/${clubSlug}`} className="text-sm text-muted hover:text-text">
          ← {selectionLabel}
        </Link>
        <h1 className="mt-2 font-display text-[2rem] leading-none">
          {proxyFor ? `Pick for ${proxyFor.displayName}` : 'Pick your movie'}
        </h1>
        {dueLabel ? <p className="mt-2 text-sm text-muted">{dueLabel}</p> : null}
      </header>

      {/* Who is in, who is not. */}
      <section className="mt-5 rounded-xl border border-line bg-surface/40 p-4">
        <p className="text-sm">
          <span className="text-text">
            {ready.length} of {members.length}
          </span>{' '}
          {/* This counts members who have used their whole allowance, so with
              a limit above one "picks in" would be a different number to the
              one the reader is looking at. */}
          <span className="text-muted">{limit === 1 ? 'picks in' : 'members ready'}</span>
        </p>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-strong"
          role="progressbar"
          aria-valuenow={ready.length}
          aria-valuemin={0}
          aria-valuemax={members.length}
        >
          <span
            className="block h-full rounded-full bg-ember transition-[width] duration-500 ease-out"
            style={{ width: `${members.length ? Math.round((ready.length / members.length) * 100) : 0}%` }}
          />
        </div>

        {/* Each member says where they are, so "who is still deciding" is
            answered on the face of the card rather than behind a tap. */}
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {members.map((member) => {
            const isReady = member.pickCount >= limit;
            return (
              <li key={member.id} className="flex w-14 shrink-0 flex-col items-center gap-1 text-center">
                <span className="relative">
                  <Avatar user={member} size="md" className={isReady ? 'border-jade/60' : 'opacity-55'} />
                  {isReady ? (
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-jade text-canvas ring-2 ring-surface"
                    >
                      <CheckIcon className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-[0.6875rem] text-muted">
                  {member.displayName}
                </span>
                <span className={cn('text-[0.625rem]', isReady ? 'text-jade' : 'text-dim')}>
                  {isReady ? 'picked' : 'deciding'}
                </span>
              </li>
            );
          })}
        </ul>

        {canSubmitForOthers && othersDeciding.length ? (
          <button
            type="button"
            onClick={() => setProxyOpen(true)}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-iris/40 px-4 text-sm text-iris"
          >
            Submit for a member
          </button>
        ) : null}
      </section>

      {/* The pick being submitted for someone else is never ambiguous. */}
      {proxyFor ? (
        <div
          className="sticky top-2 z-20 mt-5 flex items-center justify-between gap-3 rounded-lg border border-iris bg-iris/15 px-4 py-3"
          role="status"
        >
          <p className="min-w-0 text-sm">
            Picking for <span className="font-medium text-text">{proxyFor.displayName}</span>
          </p>
          <button
            type="button"
            onClick={() => setProxyFor(null)}
            className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-text"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {myPicks.length && !proxyFor ? (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">{myPicks.length === 1 ? 'Your pick' : 'Your picks'}</p>
            {limit > 1 ? (
              <p className="text-xs text-dim">
                {myPicks.length} of {limit} used
              </p>
            ) : null}
          </div>
          <ul className="mt-2 space-y-2">
            {myPicks.map((pick) => (
              <li
                key={pick.id}
                className="flex items-center gap-3 rounded-lg border border-iris/30 bg-canvas-raised p-3"
              >
                <div className="w-12 shrink-0">
                  <Poster film={pick} size="xs" linked={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pick.title}</p>
                  {pick.year ? <p className="text-xs text-dim tabular">{pick.year}</p> : null}
                </div>
                {pickingOpen && limit > 1 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(pick.id)}
                    className="min-h-11 shrink-0 rounded-md px-2.5 text-xs text-muted hover:bg-surface-hover hover:text-text"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!pickingOpen ? (
        <p className="mt-6 rounded-lg border border-line p-4 text-sm text-muted">Picks are closed.</p>
      ) : remaining === 0 && !proxyFor && !replacingId ? (
        <p className="mt-6 rounded-lg border border-line p-4 text-sm text-muted">
          {limit === 1
            ? 'Your pick is in.'
            : `All ${limit} of your picks are in. Remove one to swap it.`}
        </p>
      ) : (
        <>
          <section className="mt-7">
            <FilmPicker onPick={setFilm} placeholder="Search for a movie…" />
          </section>

          {shelves.map((shelf) => (
            <section key={shelf.title} className="mt-7">
              <p className="eyebrow mb-2.5">{shelf.title}</p>
              <ul className="grid grid-cols-2 gap-3">
                {shelf.items.slice(0, 6).map((item) => {
                  const selected = film?.movieId === item.movieId;
                  return (
                    <li key={item.movieId}>
                      <Press>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setFilm(
                              selected
                                ? null
                                : {
                                    movieId: item.movieId,
                                    title: item.title,
                                    year: item.year,
                                    posterPath: item.posterPath,
                                  },
                            )
                          }
                          className={cn(
                            'block w-full rounded-md text-left transition-all',
                            selected
                              ? 'ring-2 ring-ember ring-offset-2 ring-offset-canvas'
                              : 'ring-0',
                          )}
                        >
                          <span className="relative block">
                            <Poster
                              size="md"
                              film={{
                                slug: item.movieId,
                                title: item.title,
                                year: item.year,
                                posterPath: item.posterPath,
                              }}
                              linked={false}
                            />
                            <span
                              aria-hidden
                              className={cn(
                                'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                                selected
                                  ? 'border-ember bg-ember text-inverse'
                                  : 'border-white/60 bg-black/35',
                              )}
                            >
                              {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                            </span>
                          </span>
                          <span className="mt-1.5 block truncate text-xs">{item.title}</span>
                        </button>
                      </Press>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {/* Selected film, note, and submit — pinned so the action is always one tap away. */}
      {film && pickingOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl">
          <div className="mx-auto max-w-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 shrink-0">
                <Poster
                  film={{
                    slug: film.slug ?? film.movieId ?? '',
                    title: film.title,
                    year: film.year,
                    posterPath: film.posterPath,
                  }}
                  size="xs"
                  linked={false}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{film.title}</p>
                <p className="truncate text-xs text-dim">
                  {proxyFor ? `for ${proxyFor.displayName}` : note ? note : 'Add a note (optional)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilm(null)}
                className="shrink-0 text-xs text-muted underline underline-offset-2"
              >
                Clear
              </button>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer list-none text-xs text-muted">Add a note</summary>
              <Field label="Why this one?" htmlFor="pick-note" optional>
                <textarea
                  id="pick-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={500}
                  className={inputClass}
                />
              </Field>
            </details>

            <FormError>{error}</FormError>

            <Press className="mt-2.5">
              <Button
                variant="iris"
                size="lg"
                className="w-full justify-center"
                onClick={submit}
                disabled={pending}
              >
                {pending
                  ? 'Submitting…'
                  : proxyFor
                    ? `Submit for ${proxyFor.displayName}`
                    : replacingId
                      ? 'Change my pick'
                      : 'Submit pick'}
              </Button>
            </Press>
          </div>
        </div>
      ) : null}

      {proxyOpen ? (
        <Sheet
          open
          onClose={() => setProxyOpen(false)}
          title="Submit for a member"
          description="Choose who this pick belongs to. It is recorded as their pick, not yours."
        >
          <ul className="space-y-1">
            {othersDeciding.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProxyFor(member);
                      setProxyOpen(false);
                      setFilm(null);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-surface-hover"
                  >
                    <Avatar user={member} size="md" />
                    <span className="min-w-0 flex-1 truncate text-sm">{member.displayName}</span>
                    <span className="text-xs text-dim">still deciding</span>
                  </button>
                </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}
