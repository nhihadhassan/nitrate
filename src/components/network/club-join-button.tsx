'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { joinOpenClubAction, requestClubJoinAction } from '@/server/actions/network';

export function ClubJoinButton({ clubId, policy, signedIn }: { clubId: string; policy: 'invite_only' | 'request' | 'open'; signedIn: boolean }) {
  const [sent, setSent] = useState(false); const [pending, startTransition] = useTransition(); const toast = useToast(); const router = useRouter();
  if (policy === 'invite_only') return <span className="text-xs text-dim">Invite only</span>;
  return <Button size="sm" variant={policy === 'open' ? 'primary' : 'outline'} disabled={pending || sent} onClick={() => {
    if (!signedIn) return router.push('/login?next=/network/clubs');
    startTransition(async () => { const result = policy === 'open' ? await joinOpenClubAction(clubId) : await requestClubJoinAction({ clubId }); if (!result.ok) return toast({ message: result.error, tone: 'error' }); setSent(true); toast({ message: policy === 'open' ? 'Joined the club' : 'Request sent', tone: 'success' }); router.refresh(); });
  }}>{pending ? 'Working…' : sent ? (policy === 'open' ? 'Joined' : 'Requested') : policy === 'open' ? 'Join club' : 'Request to join'}</Button>;
}
