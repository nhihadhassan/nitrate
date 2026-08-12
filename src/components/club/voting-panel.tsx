'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { CheckIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
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

  function vote(nominationId: string) {
    if (!open) return;
    const previous = selected;
    setSelected(nominationId);
    startTransition(async () => {
      const result = await castVoteAction({ roundId, nominationId, clubId });
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
      <p className="mb-3 text-sm text-muted">
        {open
          ? viewerVoted || selected
            ? 'Your vote is in. You can change it until voting closes.'
            : `Pick one. Totals stay hidden until the round closes — ${pluralize(memberCount, 'member')} can vote.`
          : totalsVisible
            ? `${pluralize(totalVotes, 'vote')} cast.`
            : 'Voting has closed.'}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {nominations.map((nominee) => {
          const isSelected = selected === nominee.id;
          const isWinner = winnerNominationId === nominee.id;
          const share = totalsVisible && totalVotes > 0 ? (nominee.voteCount / totalVotes) * 100 : 0;

          return (
            <li key={nominee.id}>
              <div
                className={cn(
                  'relative flex h-full gap-3 overflow-hidden rounded-lg border p-3 transition-colors',
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

                <div className="relative w-14 shrink-0">
                  <Poster film={nominee.movie} size="xs" />
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
                    <UserChip user={nominee.nominatedBy} size="xs" />
                    {open ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => vote(nominee.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex min-h-11 shrink-0 touch-manipulation items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:px-2.5',
                          isSelected
                            ? 'border-iris/50 bg-iris/15 text-iris'
                            : 'border-line text-muted hover:border-line-strong hover:text-text',
                        )}
                      >
                        {isSelected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                        {isSelected ? 'Your vote' : 'Vote'}
                      </button>
                    ) : isWinner ? (
                      <span className="shrink-0 rounded-xs bg-iris/15 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-iris">
                        Winner
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
