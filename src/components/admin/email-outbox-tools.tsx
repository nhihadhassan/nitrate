'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { flushEmailQueueAction } from '@/server/actions/admin';

export function EmailOutboxTools() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await flushEmailQueueAction();
          if (!result.ok) {
            toast({ message: result.error, tone: 'error' });
            return;
          }
          toast({
            message: `Sent ${result.data.sent}, failed ${result.data.failed}, ${result.data.remaining} still queued`,
            tone: result.data.failed ? 'error' : 'success',
          });
          router.refresh();
        })
      }
    >
      {pending ? 'Sending…' : 'Send queued mail now'}
    </Button>
  );
}
