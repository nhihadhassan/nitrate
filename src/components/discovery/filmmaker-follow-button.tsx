'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { setPersonFollowAction } from '@/server/actions/discovery';

export function FilmmakerFollowButton({
  providerId,
  initialFollowed,
}: {
  providerId: string;
  initialFollowed: boolean;
}) {
  const toast = useToast();
  const [followed, setFollowed] = useState(initialFollowed);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={followed ? 'secondary' : 'outline'}
      size="sm"
      disabled={pending}
      onClick={() => {
        const next = !followed;
        setFollowed(next);
        startTransition(async () => {
          const result = await setPersonFollowAction(providerId, next);
          if (!result.ok) {
            setFollowed(!next);
            toast({ message: result.error, tone: 'error' });
            return;
          }
          setFollowed(result.data.followed);
          toast({ message: next ? 'Filmmaker followed' : 'Filmmaker unfollowed', tone: 'success' });
        });
      }}
    >
      {followed ? 'Following filmmaker' : 'Follow filmmaker'}
    </Button>
  );
}
