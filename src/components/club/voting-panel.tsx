'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { CheckIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { Avatar } from '@/components/user/avatar';
import { cn, formatRuntime, pluralize } from '@/lib/utils';
import { castVoteAction } from '@/server/actions/clubs';

type Nominee = {
  id: string;
  voteCount: number;
  votedByViewer: boolean;
  pitch: string | null;
  nominatedBy: { id: string; username: string; displayName: string; avatarAssetId: string | null };
  movie: {
    slug: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    runtime: number | null;
  };
};

/**
 * Voting is blind: totals are not sent to the client at all while a round is
 * open, so there is nothing to inspect and nothing to anchor on. Members can
 * change their vote until the round closes.
 */
export function VotingPanel({
  clubId,
  roundId,
  status,
  totalsVisible,
  viewerVoted,
  memberCount,
  winnerNominationId,
  nominations,
}: {
  clubId: string;
  roundId: string;
  status: string;
  totalsVisible: boolean;
  viewerVoted: boolean;
  memberCount: number;
  winnerNominationId: string | null;
  nominations: Nominee[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(
    nominations.find((n) => n.votedByViewer)?.id ?? null,
  );
  const [pending, startTransition] = useTransition();

  const open = status === 'voting_open';
  const totalVotes = nominations.reduce((sum, n) => sum + n.voteCount, 0);

  function vote() {
    if (!open || !selected) return;
    const previous = selected;
    startTransition(async () => {
      const result = await castVoteAction({ roundId, nominationId: selected, clubId });
      if (!result.ok) {
        setSelected(previous);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: 'Vote counted', tone: 'success' });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-iris/40 bg-iris/[0.06] p-4 sm:p-5">
        <p className="eyebrow text-iris">{viewerVoted || selected ? 'Your vote' : 'Your turn'}</p>
        <h3 className="mt-1 text-2xl">
          {open ? (viewerVoted || selected ? 'Your vote is in' : 'Cast your vote') : 'Voting complete'}
        </h3>
        <p className="mt-1.5 text-sm text-muted">
          {open
            ? viewerVoted || selected
              ? 'You can change it until voting closes.'
              : `Choose one of the movies below. Totals stay hidden until voting ends, and ${pluralize(memberCount, 'member')} can vote.`
            : totalsVisible
              ? `${pluralize(totalVotes, 'vote')} cast.`
              : 'Voting has closed.'}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a movie">
        {nominations.map((nominee) => {
          const isSelected = selected === nominee.id;
          const isWinner = winnerNominationId === nominee.id;
          const share = totalsVisible && totalVotes > 0 ? (nominee.voteCount / totalVotes) * 100 : 0;

          return (
            <li key={nominee.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!open || pending}
                onClick={() => setSelected(nominee.id)}
                className={cn(
                  'relative flex h-full w-full gap-4 overflow-hidden rounded-xl border p-3 text-left transition-[border-color,transform] active:scale-[0.99]',
                  isWinner
                    ? 'border-iris/60 bg-iris/[0.08]'
                    : isSelected
                      ? 'border-iris/40'
                      : 'border-line',
                )}
              >
                {totalsVisible ? (
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-iris/[0.07]"
                    style={{ width: `${share}%` }}
                  />
                ) : null}

                <div className="relative w-24 shrink-0 sm:w-20">
                  <Poster film={nominee.movie} size="sm" linked={false} />
                </div>

                <div className="relative min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{nominee.movie.title}</p>
                      <p className="text-xs text-dim tabular">
                        {nominee.movie.year}
                        {nominee.movie.runtime ? ` · ${formatRuntime(nominee.movie.runtime)}` : ''}
                      </p>
                    </div>
                    {totalsVisible ? (
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-xl leading-none tabular">
                          {nominee.voteCount}
                        </span>
                        <span className="text-[0.625rem] text-dim">
                          {nominee.voteCount === 1 ? 'vote' : 'votes'}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {nominee.pitch ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                      “{nominee.pitch}”
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                      <Avatar user={nominee.nominatedBy} size="xs" />
                      <span className="truncate">{nominee.nominatedBy.displayName}</span>
                    </span>
                    {open && isSelected ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-iris"><CheckIcon className="h-3.5 w-3.5" />Selected</span>
                    ) : isWinner ? (
                      <span className="shrink-0 rounded-xs bg-iris/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-iris">
                        Winner
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <div className="sticky bottom-3 z-10 mt-5 flex justify-center">
          <button
            type="button"
            disabled={!selected || pending}
            onClick={vote}
            className="min-h-12 rounded-lg bg-iris px-6 text-sm font-medium text-white shadow-pop transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Saving vote…' : viewerVoted ? 'Change vote' : 'Cast vote'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
