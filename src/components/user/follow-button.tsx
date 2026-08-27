'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { toggleFollowAction } from '@/server/actions/social';

export function FollowButton({
  userId,
  initialFollowing,
  signedIn,
  source,
}: {
  userId: string;
  initialFollowing: boolean;
  signedIn: boolean;
  source?: 'recommendation';
}) {
  const router = useRouter();
  const toast = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={following ? 'secondary' : 'outline'}
      size="sm"
      disabled={pending}
      className="shrink-0"
      onClick={() => {
        if (!signedIn) {
          router.push('/login');
          return;
        }
        const next = !following;
        setFollowing(next);
        startTransition(async () => {
          const result = await toggleFollowAction(userId, source);
          if (!result.ok) {
            setFollowing(!next);
            toast({ message: result.error, tone: 'error' });
            return;
          }
          setFollowing(result.data.following);
        });
      }}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
