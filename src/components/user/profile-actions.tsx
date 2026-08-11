'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ReportDialog } from '@/components/moderation/report-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { toggleBlockAction, toggleFollowAction } from '@/server/actions/social';

export function ProfileActions({
  profile,
  isSelf,
  isFollowing,
  signedIn,
}: {
  profile: { id: string; username: string; displayName: string };
  isSelf: boolean;
  isFollowing: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [following, setFollowing] = useState(isFollowing);
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isSelf) {
    return (
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Edit profile</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <Button
        variant={following ? 'secondary' : 'primary'}
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!signedIn) {
            router.push(`/login?next=/@${profile.username}`);
            return;
          }
          const next = !following;
          setFollowing(next);
          startTransition(async () => {
            const result = await toggleFollowAction(profile.id);
            if (!result.ok) {
              setFollowing(!next);
              toast({ message: result.error, tone: 'error' });
              return;
            }
            setFollowing(result.data.following);
            router.refresh();
          });
        }}
      >
        {following ? 'Following' : 'Follow'}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="More options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span aria-hidden className="text-lg leading-none">
          ⋯
        </span>
      </Button>

      {menuOpen ? (
        <div className="animate-rise absolute right-0 top-[calc(100%+0.4rem)] z-20 w-48 overflow-hidden rounded-lg border border-line bg-canvas-raised py-1 shadow-pop">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              if (!signedIn) {
                router.push('/login');
                return;
              }
              setReporting(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            Report account
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              if (!signedIn) {
                router.push('/login');
                return;
              }
              startTransition(async () => {
                const result = await toggleBlockAction(profile.id);
                if (!result.ok) {
                  toast({ message: result.error, tone: 'error' });
                  return;
                }
                toast({
                  message: result.data.blocked
                    ? `Blocked ${profile.displayName}`
                    : `Unblocked ${profile.displayName}`,
                });
                router.refresh();
              });
            }}
            className="block w-full px-3 py-2 text-left text-sm text-rose transition-colors hover:bg-surface-hover"
          >
            Block account
          </button>
        </div>
      ) : null}

      {reporting ? (
        <ReportDialog
          subjectType="user"
          subjectId={profile.id}
          subjectLabel={`@${profile.username}`}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </div>
  );
}
