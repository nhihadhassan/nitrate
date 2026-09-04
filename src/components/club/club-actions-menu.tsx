'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ReportClubButton } from '@/components/moderation/report-club-button';
import { Button } from '@/components/ui/button';
import { MoreIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { leaveClubAction } from '@/server/actions/clubs';

export function ClubActionsMenu({
  clubId,
  clubSlug,
  clubName,
  inviteCode,
  role,
  canManageSettings,
  signedIn,
}: {
  clubId: string;
  clubSlug: string;
  clubName: string;
  inviteCode: string;
  role: 'owner' | 'admin' | 'member' | null;
  canManageSettings: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const base = `/club/${clubSlug}`;

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
    toast({ message: 'Invite link copied', tone: 'success' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`More options for ${clubName}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-text"
      >
        <MoreIcon className="h-5 w-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={clubName} description="Club options" size="sm">
        <div className="grid gap-2">
          {role ? (
            <>
              <Button asChild variant="ghost" className="justify-start"><Link href={`${base}/members`}>Members</Link></Button>
              <Button variant="ghost" className="justify-start" onClick={() => void copyInvite()}>Copy invite link</Button>
              {canManageSettings ? <Button asChild variant="ghost" className="justify-start"><Link href={`${base}/settings`}>Club settings</Link></Button> : null}
              {role !== 'owner' ? (
                <Button
                  variant="danger"
                  className="mt-3 justify-start"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const result = await leaveClubAction(clubId);
                    if (!result.ok) return toast({ message: result.error, tone: 'error' });
                    toast({ message: `You left ${clubName}` });
                    router.push('/clubs');
                    router.refresh();
                  })}
                >
                  {pending ? 'Leaving…' : 'Leave club'}
                </Button>
              ) : (
                <p className="mt-3 px-4 text-xs text-dim">Transfer ownership in Members before leaving.</p>
              )}
            </>
          ) : signedIn ? (
            <ReportClubButton clubId={clubId} clubName={clubName} />
          ) : (
            <Button asChild variant="outline"><Link href={`/login?next=${encodeURIComponent(base)}`}>Sign in</Link></Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
