'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cancelScreeningAction, completeScreeningAction } from '@/server/actions/clubs';

export function ScreeningAdminControls({
  screeningId,
  clubSlug,
  status,
  isPast,
}: {
  screeningId: string;
  clubSlug: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  isPast: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (status !== 'scheduled') return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="iris"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await completeScreeningAction(screeningId, clubSlug);
            if (!result.ok) {
              toast({ message: result.error, tone: 'error' });
              return;
            }
            toast({ message: 'Screening complete — ratings are open', tone: 'success' });
            router.refresh();
          })
        }
      >
        {pending ? 'Saving…' : isPast ? 'Mark as watched' : 'We watched it early'}
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
                toast({ message: 'Screening cancelled' });
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
        <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>
          Cancel screening
        </Button>
      )}
    </div>
  );
}
