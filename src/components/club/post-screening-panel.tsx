'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useLogDialog } from '@/components/log/log-dialog-provider';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { confirmAttendanceAction } from '@/server/actions/clubs';

/**
 * The post-screening flow, as a short checklist rather than a wizard: were you
 * there, is it in your diary, and then the blind rating below. Logging reuses
 * the normal log sheet and is pinned to this screening, so a member who already
 * logged the film independently never gets a duplicate entry.
 */
export function PostScreeningPanel({
  screeningId,
  clubSlug,
  attended,
  hasLogged,
  film,
  personalState,
  screeningDate,
}: {
  screeningId: string;
  clubSlug: string;
  attended: boolean | null;
  hasLogged: boolean;
  film: { movieId: string; slug: string; title: string; year: number | null; posterPath: string | null };
  personalState: { rating: number | null; liked: boolean; watched: boolean };
  screeningDate: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { open } = useLogDialog();
  const [attendedState, setAttendedState] = useState(attended);
  const [pending, startTransition] = useTransition();

  function confirm(value: boolean) {
    const previous = attendedState;
    setAttendedState(value);
    startTransition(async () => {
      const result = await confirmAttendanceAction({ screeningId, clubSlug, attended: value });
      if (!result.ok) {
        setAttendedState(previous);
        toast({ message: result.error, tone: 'error' });
        return;
      }
      router.refresh();
    });
  }

  return (
    <ol className="space-y-2.5">
      <li className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2.5">
        <StepMark done={attendedState !== null} />
        <span className="min-w-0 flex-1 text-sm">
          {attendedState === true
            ? 'You watched it with the club'
            : attendedState === false
              ? 'You missed this one'
              : 'Were you there?'}
        </span>
        <span className="flex shrink-0 gap-1.5">
          <Button
            variant={attendedState === true ? 'iris' : 'outline'}
            size="sm"
            disabled={pending}
            onClick={() => confirm(true)}
          >
            I was there
          </Button>
          <Button
            variant={attendedState === false ? 'secondary' : 'ghost'}
            size="sm"
            disabled={pending}
            onClick={() => confirm(false)}
          >
            I missed it
          </Button>
        </span>
      </li>

      <li className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2.5">
        <StepMark done={hasLogged} />
        <span className="min-w-0 flex-1 text-sm">
          {hasLogged
            ? `${film.title} is in your diary`
            : 'Log it to your own diary, rate it and add a review'}
        </span>
        <Button
          variant={hasLogged ? 'ghost' : 'primary'}
          size="sm"
          className="shrink-0"
          onClick={() =>
            open({
              film: {
                movieId: film.movieId,
                slug: film.slug,
                title: film.title,
                year: film.year,
                posterPath: film.posterPath,
              },
              initial: {
                rating: personalState.rating,
                liked: personalState.liked,
                watched: personalState.watched,
              },
              screeningId,
              dateHint: screeningDate,
              title: hasLogged ? 'Update your entry' : 'Log this film',
            })
          }
        >
          {hasLogged ? 'Edit entry' : 'Log it'}
        </Button>
      </li>
    </ol>
  );
}

function StepMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.625rem]',
        done ? 'border-jade/50 bg-jade/15 text-jade' : 'border-line text-dim',
      )}
    >
      {done ? <CheckIcon className="h-3 w-3" /> : '·'}
    </span>
  );
}
