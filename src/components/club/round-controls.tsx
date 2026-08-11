'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import type { RoundStatus } from '@/lib/types';
import { cancelRoundAction, closeVotingAction, openVotingAction, startRoundAction } from '@/server/actions/clubs';

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
  nominationCount,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string | null;
  status: RoundStatus | null;
  nominationCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [starting, setStarting] = useState(false);
  const [winner, setWinner] = useState<{ title: string; slug: string; votes: number; tied: boolean } | null>(
    null,
  );

  if (!roundId || !status) {
    return (
      <>
        <Button variant="iris" onClick={() => setStarting(true)}>
          Open nominations
        </Button>
        {starting ? (
          <StartRoundSheet clubId={clubId} clubSlug={clubSlug} onClose={() => setStarting(false)} />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'nominations_open' ? (
        <Button
          variant="iris"
          size="sm"
          disabled={pending || nominationCount < 2}
          title={nominationCount < 2 ? 'You need at least two nominations' : undefined}
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
          Open voting
        </Button>
      ) : null}

      {status === 'voting_open' ? (
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

      {status !== 'completed' && status !== 'cancelled' ? (
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
  const [limit, setLimit] = useState(1);
  const [nominationsClose, setNominationsClose] = useState(localDateTimeValue(3));
  const [votingClose, setVotingClose] = useState(localDateTimeValue(5));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Open a nomination round"
      description="Members suggest films, then everyone votes. Totals stay hidden until you close it."
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
                  nominationLimitPerMember: limit,
                  nominationsCloseAt: nominationsClose
                    ? new Date(nominationsClose).toISOString()
                    : null,
                  votingCloseAt: votingClose ? new Date(votingClose).toISOString() : null,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast({ message: 'Nominations are open', tone: 'success' });
                onClose();
                router.push(`/club/${clubSlug}`);
                router.refresh();
              });
            }}
          >
            {pending ? 'Opening…' : 'Open nominations'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>

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

        <Field label="Nominations per member" htmlFor="round-limit">
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

        <Field label="Nominations close" htmlFor="round-nominations-close" optional>
          <input
            id="round-nominations-close"
            type="datetime-local"
            value={nominationsClose}
            onChange={(event) => setNominationsClose(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Voting closes" htmlFor="round-voting-close" optional>
          <input
            id="round-voting-close"
            type="datetime-local"
            value={votingClose}
            onChange={(event) => setVotingClose(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </Sheet>
  );
}
