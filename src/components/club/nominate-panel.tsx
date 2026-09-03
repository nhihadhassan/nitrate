'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { Button } from '@/components/ui/button';
import { recommendationReasonLabel, type RecommendationReason } from '@/lib/recommendations';
import { CheckIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { Avatar, UserChip } from '@/components/user/avatar';
import { cn, formatRuntime, pluralize } from '@/lib/utils';
import {
  nominateAction,
  nominateForMemberAction,
  replaceNominationAction,
  withdrawNominationAction,
  setRoundParticipationAction,
} from '@/server/actions/clubs';

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
};

type NominationItem = {
  id: string;
  pitch: string | null;
  nominatedBy: Person;
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
  mode,
  justJoined,
  limit,
  nominations,
  members,
  queue,
  watchlist,
  suggestions,
  pickingOpen = true,
  showContenders = false,
  canSubmitForOthers = false,
  viewerId,
  participating = true,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  mode: 'vote' | 'wheel';
  justJoined: boolean;
  limit: number;
  nominations: NominationItem[];
  members: (Person & { pickCount: number })[];
  queue: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
  watchlist: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
  suggestions: { movieId: string; title: string; year: number | null; posterPath: string | null; reasons: RecommendationReason[] }[];
  pickingOpen?: boolean;
  showContenders?: boolean;
  canSubmitForOthers?: boolean;
  viewerId: string | null;
  participating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [proxyTarget, setProxyTarget] = useState<Person & { pickCount: number } | null>(null);
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const mine = nominations.filter((nomination) => nomination.isMine);
  const remaining = Math.max(0, limit - mine.length);
  const finishedMembers = members.filter((member) => member.pickCount >= limit).length;
  const waiting = Math.max(0, members.length - finishedMembers);
  const decision = mode === 'wheel' ? 'the wheel decides' : 'voting begins';

  function openPicker(replaceId?: string) {
    setReplacingId(replaceId ?? null);
    setProxyTarget(null);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-iris/40 bg-iris/[0.06] p-4 sm:p-5" aria-labelledby="current-pick-title">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.72fr)]">
          <div className="min-w-0">
            <p className="eyebrow text-iris">
              {justJoined && !mine.length ? "You're in. Your turn" : mine.length ? 'Your pick' : 'Your turn'}
            </p>
            <h3 id="current-pick-title" className="mt-1 text-2xl sm:text-3xl">
              {mine.length
                ? limit === 1
                  ? mine[0].movie.title
                  : `You picked ${pluralize(mine.length, 'movie')}`
                : limit === 1
                  ? 'Pick your movie'
                  : `Pick up to ${limit} movies`}
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
              {mine.length
                ? waiting
                  ? `You're in. Waiting for ${pluralize(waiting, 'more member')}.`
                  : `Everyone is ready. Next, ${decision}.`
                : pickingOpen
                  ? `Everyone gets ${limit === 1 ? 'one pick' : `up to ${limit} picks`}. Once everyone has chosen, ${decision}.`
                  : 'Picks are closed while the club decides what happens next.'}
            </p>

            {viewerId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const result = await setRoundParticipationAction({ roundId, clubId, userId: viewerId, participating: !participating });
                  if (!result.ok) return toast({ message: result.error, tone: 'error' });
                  toast({ message: participating ? 'You are out for this week.' : 'You are back in for this week.', tone: 'success' });
                  router.refresh();
                })}
                className="mt-3 min-h-11 text-xs text-muted underline underline-offset-2 hover:text-iris sm:min-h-0"
              >
                {participating ? 'Not joining this week?' : 'Join this week'}
              </button>
            ) : null}

            {mine.length ? (
              <ul className="mt-4 space-y-2">
                {mine.map((pick) => (
                  <li key={pick.id} className="flex items-center gap-3 rounded-md border border-iris/25 bg-canvas-raised/70 p-2.5">
                    <div className="w-11 shrink-0">
                      <Poster film={pick.movie} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{pick.movie.title}</p>
                      <p className="text-xs text-dim tabular">{pick.movie.year}</p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (limit === 1) {
                          openPicker(pick.id);
                          return;
                        }
                        startTransition(async () => {
                          const result = await withdrawNominationAction(pick.id, clubSlug);
                          if (!result.ok) {
                            toast({ message: result.error, tone: 'error' });
                            return;
                          }
                          router.refresh();
                        });
                      }}
                      className="min-h-11 shrink-0 touch-manipulation rounded-md px-2.5 text-xs font-medium text-muted hover:bg-surface-hover hover:text-text sm:min-h-0"
                    >
                      {limit === 1 ? 'Change pick' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {remaining > 0 && pickingOpen ? (
              <Button variant="iris" size="lg" className="mt-4 w-full justify-center sm:w-auto" onClick={() => openPicker()}>
                {mine.length ? 'Pick another movie' : 'Pick your movie'}
              </Button>
            ) : null}
            {canSubmitForOthers && pickingOpen ? (
              <div className="mt-4 rounded-lg border border-line bg-canvas-raised/50 p-3">
                <p className="text-xs text-dim">Helping someone join this week?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.filter((member) => member.id !== viewerId && member.pickCount < limit).map((member) => (
                    <button key={member.id} type="button" className="min-h-11 rounded-full border border-line px-3 text-xs text-muted hover:border-iris hover:text-text" onClick={() => { setProxyTarget(member); setReplacingId(null); setOpen(true); }}>
                      Add a pick for {member.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-iris/20 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <p className="text-sm font-medium">
              {finishedMembers} of {members.length} members have {limit === 1 ? 'picked' : 'finished choosing'}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
              {members.map((member) => {
                const ready = member.pickCount >= limit;
                return (
                  <li key={member.id} className="flex min-w-0 items-center gap-2">
                    <span className="relative shrink-0">
                      <Avatar user={member} size="sm" className={ready ? 'border-jade/60' : 'opacity-65'} />
                      {ready ? (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-jade text-canvas ring-2 ring-canvas-raised">
                          <CheckIcon className="h-2.5 w-2.5" />
                        </span>
                      ) : null}
                    </span>
                    <span className={cn('truncate text-xs', ready ? 'text-text' : 'text-dim')}>
                      {member.displayName}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-dim">Next: {mode === 'wheel' ? 'spin the wheel' : 'vote on the picks'}.</p>
          </div>
        </div>
      </section>

      {nominations.length && showContenders ? (
        <details className="group rounded-lg border border-line bg-surface/30 p-3.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            <span>Movies picked ({nominations.length})</span>
            <span className="text-xs text-dim group-open:hidden">Show</span>
            <span className="hidden text-xs text-dim group-open:inline">Hide</span>
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {nominations.map((nomination) => (
              <li key={nomination.id} className="flex gap-3 rounded-md border border-line p-3">
                <div className="w-14 shrink-0"><Poster film={nomination.movie} size="xs" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nomination.movie.title}</p>
                  <p className="text-xs text-dim tabular">
                    {nomination.movie.year}{nomination.movie.runtime ? ` · ${formatRuntime(nomination.movie.runtime)}` : ''}
                  </p>
                  {nomination.pitch ? <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">“{nomination.pitch}”</p> : null}
                  <UserChip user={nomination.nominatedBy} size="xs" className="mt-2" />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {open ? (
        <PickMovieSheet
          clubId={clubId}
          roundId={roundId}
          mode={mode}
          replacingId={replacingId}
          queue={queue}
          watchlist={watchlist}
          suggestions={suggestions}
          nominatedFor={proxyTarget}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function PickMovieSheet({
  clubId,
  roundId,
  mode,
  replacingId,
  queue,
  watchlist,
  suggestions,
  nominatedFor,
  onClose,
}: {
  clubId: string;
  roundId: string;
  mode: 'vote' | 'wheel';
  replacingId: string | null;
  queue: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
  watchlist: { movieId: string; title: string; year: number | null; posterPath: string | null }[];
  suggestions: { movieId: string; title: string; year: number | null; posterPath: string | null; reasons: RecommendationReason[] }[];
  nominatedFor: (Person & { pickCount: number }) | null;
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
      title={replacingId ? 'Change your pick' : nominatedFor ? `Pick for ${nominatedFor.displayName}` : 'Pick your movie'}
      description="Pick from Movie Ideas, your watchlist, or a film the group already wants."
      footer={film ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant="iris"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const input = { roundId, clubId, movieId: film.movieId, providerId: film.providerId, pitch: pitch.trim() || null };
                const result = replacingId
                  ? await replaceNominationAction({ ...input, nominationId: replacingId })
                  : nominatedFor
                    ? await nominateForMemberAction({ ...input, nominatedForUserId: nominatedFor.id })
                  : await nominateAction(input);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast({ message: replacingId ? `Your pick is now ${film.title}` : `${film.title} is your pick`, tone: 'success' });
                onClose();
                router.refresh();
              });
            }}
          >
            {pending ? 'Saving…' : replacingId ? 'Save new pick' : 'Choose this movie'}
          </Button>
        </div>
      ) : null}
    >
      {film ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 shrink-0">
              <Poster film={{ slug: film.slug ?? film.providerId ?? '', title: film.title, year: film.year, posterPath: film.posterPath }} size="xs" linked={false} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight">{film.title}</p>
              {film.year ? <p className="text-sm text-dim tabular">{film.year}</p> : null}
              <button type="button" onClick={() => setFilm(null)} className="mt-1 min-h-11 text-xs text-muted underline underline-offset-2 hover:text-iris sm:min-h-0">
                Choose a different movie
              </button>
            </div>
          </div>
          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm text-muted hover:text-text">Add a note</summary>
            <div className="mt-3"><Field label="Why this one?" htmlFor="pick-pitch" optional>
              <textarea
                id="pick-pitch"
                value={pitch}
                onChange={(event) => setPitch(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder={mode === 'vote' ? 'A short reason for the vote.' : 'A short reason for the club.'}
                className={inputClass}
              />
            </Field></div>
          </details>
          <FormError>{error}</FormError>
        </div>
      ) : (
        <div className="space-y-6">
          {queue.length ? (
            <QuickPickList title="Movie Ideas" items={queue} onPick={setFilm} />
          ) : null}
          {watchlist.length ? (
            <QuickPickList title="From your watchlist" items={watchlist} onPick={setFilm} />
          ) : null}
          {suggestions.length ? (
            <QuickPickList title="Good for this group" items={suggestions} onPick={setFilm} />
          ) : null}
          <section>
            <p className="eyebrow mb-2">Search for any movie</p>
            <FilmPicker autoFocus onPick={setFilm} placeholder="Search for a movie…" />
          </section>
        </div>
      )}
    </Sheet>
  );
}

function QuickPickList({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { movieId: string; title: string; year: number | null; posterPath: string | null; reasons?: RecommendationReason[] }[];
  onPick: (film: PickedFilm) => void;
}) {
  return (
    <section>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.slice(0, 6).map((item) => (
          <li key={item.movieId}>
            <button
              type="button"
              onClick={() => onPick({ movieId: item.movieId, title: item.title, year: item.year, posterPath: item.posterPath })}
              className="group w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-2"
            >
              <Poster film={{ slug: item.movieId, title: item.title, year: item.year, posterPath: item.posterPath }} size="sm" linked={false} />
              <span className="mt-1.5 block truncate text-xs font-medium group-hover:text-iris">{item.title}</span>
              <span className="block truncate text-[0.6875rem] text-dim">{item.year ?? ''}</span>
              {item.reasons?.length ? <span className="mt-0.5 hidden truncate text-[0.625rem] text-iris sm:block">{item.reasons.map(recommendationReasonLabel).join(' · ')}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
