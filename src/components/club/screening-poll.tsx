'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { FormError } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTimeInZone, pluralize } from '@/lib/utils';
import { bestPollOption } from '@/lib/screening-poll';
import {
  cancelScreeningPollAction,
  confirmScreeningPollOptionAction,
  createScreeningPollAction,
  respondToScreeningPollAction,
} from '@/server/actions/clubs';

type Poll = {
  id: string;
  status: 'open' | 'closed' | 'cancelled';
  timezone: string;
  options: {
    id: string;
    startsAt: string;
    yes: number;
    maybe: number;
    no: number;
    viewerResponse: 'yes' | 'maybe' | 'no' | null;
  }[];
};

function localDefault(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setHours(20, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ScreeningPoll({
  clubId,
  clubSlug,
  roundId,
  timezone,
  isAdmin,
  poll,
}: {
  clubId: string;
  clubSlug: string;
  roundId: string;
  timezone: string;
  isAdmin: boolean;
  poll: Poll | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [times, setTimes] = useState([localDefault(3), localDefault(4), localDefault(5)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const best = useMemo(() => bestPollOption(poll?.options ?? []), [poll]);

  if (!poll) {
    if (!isAdmin) return null;
    return (
      <form
        className="rounded-lg border border-line p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await createScreeningPollAction({
              clubId,
              clubSlug,
              roundId,
              timezone,
              startsAt: times.map((time) => new Date(time).toISOString()),
            });
            if (!result.ok) return setError(result.error);
            toast({ message: 'Availability poll opened', tone: 'success' });
            router.refresh();
          });
        }}
      >
        <h3 className="text-xl">When could movie night work?</h3>
        <p className="mt-1 text-sm text-muted">Offer a few dates. Everyone can mark each one.</p>
        <FormError>{error}</FormError>
        <div className="mt-4 grid gap-3">
          {times.map((time, index) => (
            <div key={index} className="flex items-end gap-2 rounded-lg border border-line bg-surface/35 p-3">
              <label className="min-w-0 flex-1 text-xs text-muted" htmlFor={`poll-option-${index}`}>
                Option {index + 1}
              <DateTimePicker
                id={`poll-option-${index}`}
                value={time}
                onChange={(value) => setTimes((current) => current.map((item, i) => (i === index ? value : item)))}
                accent="iris"
                required
              />
              </label>
              {times.length > 2 ? <Button type="button" variant="ghost" size="sm" onClick={() => setTimes((current) => current.filter((_, i) => i !== index))}>Remove</Button> : null}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" disabled={times.length >= 8} onClick={() => setTimes((current) => [...current, localDefault(current.length + 3)])}>Add another date</Button>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? 'Opening…' : 'Open availability poll'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="rounded-lg border border-iris/30 bg-iris/[0.045] p-4" aria-labelledby="availability-heading">
      <p className="eyebrow text-iris">Availability poll</p>
      <h3 id="availability-heading" className="mt-1 text-xl">When can you make it?</h3>
      <p className="mt-1 text-sm text-muted">
        Mark every time. Yes counts strongest; maybe helps break a tie. An admin confirms the final night.
      </p>
      <FormError>{error}</FormError>
      <ul className="mt-4 space-y-3">
        {poll.options.map((option) => (
          <li key={option.id} className="rounded-md border border-line bg-surface/45 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium tabular">
                {formatDateTimeInZone(new Date(option.startsAt), poll.timezone)}
              </p>
              <p className="text-xs text-dim">
                {pluralize(option.yes, 'yes', 'yeses')} ·{' '}
                {pluralize(option.maybe, 'maybe', 'maybes')} ·{' '}
                {pluralize(option.no, 'no', 'nos')}
              </p>
            </div>
            {poll.status === 'open' ? (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Your availability">
                {(['yes', 'maybe', 'no'] as const).map((availability) => (
                  <button
                    key={availability}
                    type="button"
                    disabled={pending}
                    aria-pressed={option.viewerResponse === availability}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await respondToScreeningPollAction({
                          pollId: poll.id,
                          optionId: option.id,
                          clubSlug,
                          availability,
                        });
                        if (!result.ok) return setError(result.error);
                        router.refresh();
                      });
                    }}
                    className={cn(
                      'min-h-11 rounded-md border px-3 text-xs capitalize transition-colors sm:min-h-9',
                      option.viewerResponse === availability
                        ? 'border-iris/50 bg-iris/15 text-iris'
                        : 'border-line text-muted hover:border-line-strong hover:text-text',
                    )}
                  >
                    {availability}
                  </button>
                ))}
                {isAdmin ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={best?.id === option.id ? 'iris' : 'outline'}
                    className="ml-auto min-h-11 sm:min-h-9"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await confirmScreeningPollOptionAction({
                          pollId: poll.id,
                          optionId: option.id,
                          clubSlug,
                        });
                        if (!result.ok) return setError(result.error);
                        toast({ message: 'Movie night scheduled', tone: 'success' });
                        router.push(`/club/${clubSlug}/screening/${result.data.screeningId}`);
                      });
                    }}
                  >
                    {best?.id === option.id ? 'Confirm best time' : 'Confirm this time'}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {isAdmin && poll.status === 'open' ? (
        <button
          type="button"
          disabled={pending}
          className="mt-4 text-xs text-muted underline underline-offset-2 hover:text-text"
          onClick={() =>
            startTransition(async () => {
              const result = await cancelScreeningPollAction({ pollId: poll.id, clubSlug });
              if (!result.ok) return setError(result.error);
              toast({ message: 'Availability poll cancelled' });
              router.refresh();
            })
          }
        >
          Cancel poll
        </button>
      ) : null}
    </section>
  );
}
