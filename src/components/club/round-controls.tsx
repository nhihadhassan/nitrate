'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Avatar, type AvatarUser } from '@/components/user/avatar';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ChevronRightIcon, FilmIcon } from '@/components/ui/icons';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import type { RoundStatus } from '@/lib/types';
import {
  cancelRoundAction,
  closeVotingAction,
  continueExpiredPicksAction,
  extendPickDeadlineAction,
  openVotingAction,
  startRoundAction,
} from '@/server/actions/clubs';

import { WinnerReveal } from './winner-reveal';

function localDateTimeValue(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Admin controls for the round state machine. Only the transitions the server
 * would actually accept are offered, so the UI and the backend agree.
 */
export function RoundControls({
  clubId,
  clubSlug,
  roundId,
  status,
  mode,
  nominationCount,
  allMembersPicked,
  picksExpired = false,
  picksClosed = false,
  isAdmin = false,
  canExtendDeadline = false,
  canStartWheel = false,
  idleVariant = 'button',
  idleMembers = [],
}: {
  clubId: string;
  clubSlug: string;
  roundId: string | null;
  status: RoundStatus | null;
  mode?: 'vote' | 'wheel';
  nominationCount: number;
  allMembersPicked: boolean;
  picksExpired?: boolean;
  picksClosed?: boolean;
  isAdmin?: boolean;
  canExtendDeadline?: boolean;
  canStartWheel?: boolean;
  idleVariant?: 'button' | 'next-selection';
  idleMembers?: AvatarUser[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [starting, setStarting] = useState(false);
  const [extending, setExtending] = useState(false);
  const [deadline, setDeadline] = useState(localDateTimeValue(2));
  const [winner, setWinner] = useState<{ title: string; slug: string; votes: number; tied: boolean } | null>(
    null,
  );

  if (!roundId || !status) {
    return (
      <>
        {idleVariant === 'next-selection' ? (
          <button
            type="button"
            onClick={() => setStarting(true)}
            className="group relative grid min-h-[6.25rem] w-full grid-cols-[5.25rem_minmax(0,1fr)_2rem] items-center gap-3 overflow-hidden rounded-xl border border-ember/45 bg-canvas-raised p-2.5 pr-3 text-left shadow-[0_18px_45px_rgb(0_0_0/0.24)] transition-[border-color,transform] duration-200 ease-out hover:border-ember/75 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2"
            aria-label="Choose the next movie"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_92%_115%,rgb(88_64_214/0.34),transparent_48%),radial-gradient(circle_at_10%_-15%,rgb(234_88_50/0.22),transparent_42%),linear-gradient(105deg,rgb(11_18_25),rgb(13_20_34))]"
            />
            <span className="relative flex aspect-[1.12] h-full min-h-[4.75rem] items-center justify-center overflow-hidden rounded-lg border border-line/60 bg-[radial-gradient(circle_at_43%_38%,rgb(234_88_50/0.4),transparent_24%),linear-gradient(145deg,rgb(46_44_46),rgb(12_17_22))] text-ember shadow-inner">
              <FilmIcon className="h-10 w-10 drop-shadow-[0_5px_14px_rgb(0_0_0/0.55)]" />
            </span>
            <span className="relative min-w-0">
              <span className="eyebrow block text-[0.625rem] tracking-[0.24em] text-dim">Next selection</span>
              <span className="mt-1 block font-display text-[1.45rem] leading-none text-text">
                Choose next movie
              </span>
              <span className="mt-2 flex items-center gap-2">
                {idleMembers.length ? (
                  <span className="flex -space-x-1.5" aria-hidden>
                    {idleMembers.slice(0, 5).map((member, index) => (
                      <Avatar
                        key={`${member.username ?? member.displayName}-${index}`}
                        user={member}
                        size="xs"
                        className="ring-2 ring-canvas-raised"
                      />
                    ))}
                  </span>
                ) : null}
                <span className="text-xs tabular-nums text-muted">
                  {idleMembers.length}/{idleMembers.length}
                </span>
              </span>
            </span>
            <ChevronRightIcon className="relative h-5 w-5 text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-text" />
          </button>
        ) : (
          <Button variant="iris" onClick={() => setStarting(true)}>
            Choose the next movie
          </Button>
        )}
        {starting ? (
          <StartRoundSheet clubId={clubId} clubSlug={clubSlug} onClose={() => setStarting(false)} />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'nominations_open' && picksExpired && !picksClosed && canStartWheel ? (
        <>
          <Button
            variant="iris"
            size="sm"
            disabled={pending || nominationCount < 2}
            onClick={() =>
              startTransition(async () => {
                const result = await continueExpiredPicksAction(roundId, clubId);
                if (!result.ok) return toast({ message: result.error, tone: 'error' });
                toast({ message: 'Picks closed. The club can move on.', tone: 'success' });
                router.refresh();
              })
            }
          >
            Continue with {nominationCount} picks
          </Button>
        </>
      ) : null}

      {status === 'nominations_open' && mode === 'wheel' && !picksExpired && !picksClosed && canStartWheel && !allMembersPicked && nominationCount >= 2 ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await continueExpiredPicksAction(roundId, clubId);
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            toast({ message: 'Picks closed early. The wheel is ready.', tone: 'success' });
            router.refresh();
          })}
        >
          Close picks early
        </Button>
      ) : null}

      {status === 'nominations_open' && picksExpired && !picksClosed && canExtendDeadline ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setExtending(true)}>
          Extend deadline
        </Button>
      ) : null}

      {status === 'nominations_open' && mode !== 'wheel' && isAdmin ? (
        <Button
          variant={allMembersPicked || picksClosed ? 'iris' : 'outline'}
          size="sm"
          disabled={pending || nominationCount < 2 || (!allMembersPicked && !picksClosed)}
          title={nominationCount < 2 ? 'At least two movie picks are needed' : undefined}
          onClick={() =>
            startTransition(async () => {
              const result = await openVotingAction(roundId, clubId);
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              toast({ message: 'Voting is open', tone: 'success' });
              router.refresh();
            })
          }
        >
          {allMembersPicked || picksClosed ? 'Open voting' : 'Waiting for picks'}
        </Button>
      ) : null}

      {status === 'voting_open' && isAdmin ? (
        <Button
          variant="iris"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await closeVotingAction(roundId, clubId);
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              setWinner({
                title: result.data.movieTitle,
                slug: result.data.movieSlug,
                votes: result.data.voteCount,
                tied: result.data.tied,
              });
            })
          }
        >
          {pending ? 'Counting…' : 'Close voting & reveal'}
        </Button>
      ) : null}

      {status !== 'completed' && status !== 'cancelled' && isAdmin ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelRoundAction(roundId, clubSlug);
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              toast({ message: 'Round cancelled' });
              router.refresh();
            })
          }
        >
          Cancel round
        </Button>
      ) : null}

      {winner ? (
        <WinnerReveal
          title={winner.title}
          slug={winner.slug}
          votes={winner.votes}
          tied={winner.tied}
          onClose={() => {
            setWinner(null);
            router.refresh();
          }}
        />
      ) : null}
      {extending ? (
        <Sheet
          open
          onClose={() => setExtending(false)}
          title="Extend pick deadline"
          description="Give everyone a little more time. Existing picks stay in place."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExtending(false)} disabled={pending}>Cancel</Button>
              <Button
                variant="iris"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await extendPickDeadlineAction({
                      roundId,
                      clubId,
                      deadline: new Date(deadline).toISOString(),
                    });
                    if (!result.ok) return toast({ message: result.error, tone: 'error' });
                    setExtending(false);
                    toast({ message: 'Pick deadline extended', tone: 'success' });
                    router.refresh();
                  })
                }
              >
                Save deadline
              </Button>
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Quick deadline extensions">
            {[['1 hour', 1], ['3 hours', 3], ['1 day', 24]].map(([label, hours]) => (
              <Button key={label} type="button" size="sm" variant="outline" onClick={() => {
                const date = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
                const offset = date.getTimezoneOffset() * 60_000;
                setDeadline(new Date(date.getTime() - offset).toISOString().slice(0, 16));
              }}>{label}</Button>
            ))}
          </div>
          <DateTimePicker id="extend-pick-deadline" value={deadline} onChange={setDeadline} accent="iris" />
        </Sheet>
      ) : null}
    </div>
  );
}

function StartRoundSheet({
  clubId,
  clubSlug,
  onClose,
}: {
  clubId: string;
  clubSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'vote' | 'wheel'>('wheel');
  const [limit, setLimit] = useState(1);
  const [nominationsClose, setNominationsClose] = useState(localDateTimeValue(3));
  const [votingClose, setVotingClose] = useState(localDateTimeValue(5));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Choose the next movie"
      description="Everyone picks a movie. Then the club votes, or the wheel decides."
      footer={
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
                const result = await startRoundAction({
                  clubId,
                  title: title.trim() || null,
                  mode,
                  nominationLimitPerMember: limit,
                  nominationsCloseAt: nominationsClose
                    ? new Date(nominationsClose).toISOString()
                    : null,
                  votingCloseAt:
                    mode === 'wheel' || !votingClose
                      ? null
                      : new Date(votingClose).toISOString(),
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast({ message: 'Everyone can start picking', tone: 'success' });
                onClose();
                router.push(`/club/${clubSlug}`);
                router.refresh();
              });
            }}
          >
            {pending ? 'Starting…' : 'Start choosing'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">How should we choose?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeCard
              active={mode === 'wheel'}
              title="Spin the wheel"
              body="Everyone picks a movie. The wheel chooses one at random."
              onClick={() => setMode('wheel')}
            />
            <ModeCard
              active={mode === 'vote'}
              title="Vote"
              body="Everyone picks a movie, then members vote. Totals stay hidden until voting ends."
              onClick={() => setMode('vote')}
            />
          </div>
        </fieldset>

        <Field label="Round name" htmlFor="round-title" optional>
          <input
            id="round-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="October horror"
            className={inputClass}
          />
        </Field>

        <Field label="Movies per person" htmlFor="round-limit">
          <select
            id="round-limit"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className={inputClass}
          >
            {[1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pick deadline" htmlFor="round-nominations-close" optional>
          <DateTimePicker
            id="round-nominations-close"
            value={nominationsClose}
            onChange={setNominationsClose}
            accent="iris"
            placeholder="No deadline"
          />
        </Field>

        {mode === 'vote' ? (
          <Field label="Voting deadline" htmlFor="round-voting-close" optional>
            <DateTimePicker
              id="round-voting-close"
              value={votingClose}
              onChange={setVotingClose}
              accent="iris"
              placeholder="No deadline"
            />
          </Field>
        ) : null}
      </div>
    </Sheet>
  );
}

function ModeCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
        active ? 'border-iris/50 bg-iris/[0.08]' : 'border-line hover:border-line-strong'
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-dim">{body}</span>
    </button>
  );
}
