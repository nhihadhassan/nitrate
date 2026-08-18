'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { addQueueItemAction, nominateAction } from '@/server/actions/clubs';

export function ClubFilmAction({ clubId, movieId, activeRoundId, inIdeas }: {
  clubId: string;
  movieId: string;
  activeRoundId: string | null;
  inIdeas: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const label = activeRoundId ? 'Pick it' : inIdeas ? 'In Movie Ideas' : 'Save idea';
  if (inIdeas && !activeRoundId) return <span className="shrink-0 text-xs text-iris">{label}</span>;
  return (
    <Button
      variant={activeRoundId ? 'iris' : 'outline'}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = activeRoundId
          ? await nominateAction({ clubId, roundId: activeRoundId, movieId })
          : await addQueueItemAction({ clubId, movieId });
        if (!result.ok) return toast({ message: result.error, tone: 'error' });
        toast({ message: activeRoundId ? 'This is your pick' : 'Saved to Movie Ideas', tone: 'success' });
        router.refresh();
      })}
    >
      {pending ? 'Saving…' : label}
    </Button>
  );
}
