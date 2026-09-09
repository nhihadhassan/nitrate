'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { CheckIcon, TrashIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { cancelScreeningAction, completeScreeningAction } from '@/server/actions/clubs';

export function ScreeningAdminControls({
  screeningId,
  clubSlug,
  status,
  isPast,
  mobileCards = false,
}: {
  screeningId: string;
  clubSlug: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  isPast: boolean;
  mobileCards?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (status !== 'scheduled') return null;

  if (mobileCards) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={pending}
          className="flex min-h-[5.25rem] items-center gap-3 rounded-xl border border-iris/45 bg-iris/[0.09] px-3 text-left text-iris disabled:opacity-50"
          onClick={() => startTransition(async () => {
            const result = await completeScreeningAction(screeningId, clubSlug);
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            toast({ message: 'Marked as watched — ratings are open', tone: 'success' });
            router.refresh();
          })}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-iris text-canvas"><CheckIcon className="h-5 w-5" /></span>
          <span><span className="block text-sm font-medium">{pending ? 'Saving…' : 'Mark watched'}</span><span className="mt-0.5 block text-xs text-muted">Mark as complete</span></span>
        </button>
        {confirmCancel ? (
          <div className="grid min-h-[5.25rem] grid-cols-1 gap-1 rounded-xl border border-rose/55 bg-rose/[0.08] p-2">
            <button type="button" disabled={pending} onClick={() => startTransition(async () => {
              const result = await cancelScreeningAction(screeningId, clubSlug);
              if (!result.ok) return toast({ message: result.error, tone: 'error' });
              toast({ message: 'Movie night cancelled' });
              router.push(`/club/${clubSlug}`);
              router.refresh();
            })} className="rounded-md bg-rose px-2 text-xs font-medium text-white">Confirm cancel</button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="text-xs text-muted">Keep it</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmCancel(true)} className="flex min-h-[5.25rem] items-center gap-3 rounded-xl border border-rose/55 bg-rose/[0.08] px-3 text-left text-rose">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center"><TrashIcon className="h-6 w-6" /></span>
            <span><span className="block text-sm font-medium">Cancel movie night</span><span className="mt-0.5 block text-xs text-muted">Remove this event</span></span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={mobileCards ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
      <Button
        variant="iris"
        size="sm"
        className={mobileCards ? 'min-h-16 justify-center rounded-lg' : undefined}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await completeScreeningAction(screeningId, clubSlug);
            if (!result.ok) {
              toast({ message: result.error, tone: 'error' });
              return;
            }
            toast({ message: 'Marked as watched — ratings are open', tone: 'success' });
            router.refresh();
          })
        }
      >
        {pending ? 'Saving…' : isPast ? 'Mark it watched' : 'We watched it early'}
      </Button>

      {confirmCancel ? (
        <>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelScreeningAction(screeningId, clubSlug);
                if (!result.ok) {
                  toast({ message: result.error, tone: 'error' });
                  return;
                }
                toast({ message: 'Movie night cancelled' });
                router.push(`/club/${clubSlug}`);
                router.refresh();
              })
            }
          >
            Confirm cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button variant={mobileCards ? 'danger' : 'ghost'} size="sm" className={mobileCards ? 'min-h-16 justify-center rounded-lg' : undefined} onClick={() => setConfirmCancel(true)}>
          Cancel movie night
        </Button>
      )}
    </div>
  );
}
