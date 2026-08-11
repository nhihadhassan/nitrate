'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { moderateMemberAction } from '@/server/actions/clubs';

type Member = {
  id: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
  role: 'owner' | 'admin' | 'member';
  filmCount: number;
};

/**
 * Membership management. The menu only ever offers actions the caller's role can
 * actually perform — and the server re-checks all of them anyway.
 */
export function MemberList({
  clubId,
  viewerId,
  viewerRole,
  members,
}: {
  clubId: string;
  viewerId: string | null;
  viewerRole: 'owner' | 'admin' | 'member' | null;
  members: Member[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);

  function run(userId: string, action: 'promote' | 'demote' | 'remove' | 'ban' | 'transfer') {
    setOpenFor(null);
    startTransition(async () => {
      const result = await moderateMemberAction({ clubId, userId, action });
      if (!result.ok) {
        toast({ message: result.error, tone: 'error' });
        return;
      }
      toast({ message: 'Done', tone: 'success' });
      router.refresh();
    });
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {members.map((member) => {
        const isSelf = member.id === viewerId;
        type Action = 'promote' | 'demote' | 'remove' | 'ban' | 'transfer';
        const canManage: readonly Action[] =
          viewerRole === 'owner' && !isSelf && member.role !== 'owner'
            ? ['promote', 'demote', 'transfer', 'remove', 'ban']
            : viewerRole === 'admin' && !isSelf && member.role === 'member'
              ? ['remove', 'ban']
              : [];

        return (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
            <UserChip
              user={member}
              size="md"
              subtitle={pluralize(member.filmCount, 'film')}
              className="min-w-0 flex-1"
            />
            {member.role !== 'member' ? <Badge tone="iris">{member.role}</Badge> : null}

            {canManage.length ? (
              <div className="relative shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpenFor(openFor === member.id ? null : member.id)}
                  aria-expanded={openFor === member.id}
                  aria-label={`Manage ${member.displayName}`}
                  className="rounded-md px-2 py-1 text-lg leading-none text-dim transition-colors hover:bg-surface-hover hover:text-text"
                >
                  ⋯
                </button>
                {openFor === member.id ? (
                  <div className="animate-rise absolute right-0 top-[calc(100%+0.25rem)] z-20 w-48 overflow-hidden rounded-lg border border-line bg-canvas-raised py-1 shadow-pop">
                    {canManage.includes('promote') && member.role === 'member' ? (
                      <MenuItem onClick={() => run(member.id, 'promote')}>Make admin</MenuItem>
                    ) : null}
                    {canManage.includes('demote') && member.role === 'admin' ? (
                      <MenuItem onClick={() => run(member.id, 'demote')}>Remove admin</MenuItem>
                    ) : null}
                    {canManage.includes('transfer') ? (
                      <MenuItem onClick={() => run(member.id, 'transfer')}>
                        Transfer ownership
                      </MenuItem>
                    ) : null}
                    {canManage.includes('remove') ? (
                      <MenuItem onClick={() => run(member.id, 'remove')}>Remove from club</MenuItem>
                    ) : null}
                    {canManage.includes('ban') ? (
                      <MenuItem danger onClick={() => run(member.id, 'ban')}>
                        Ban from club
                      </MenuItem>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
        danger ? 'text-rose' : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
