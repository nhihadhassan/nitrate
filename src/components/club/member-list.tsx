'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { moderateMemberAction, setClubMemberPermissionsAction } from '@/server/actions/clubs';

const PERMISSIONS = [
  ['extend_submission_deadline', 'Extend deadline'],
  ['start_wheel', 'Start the wheel'],
  ['submit_picks_for_others', 'Pick for others'],
  ['edit_movie_night', 'Edit movie night'],
  ['invite_members', 'Invite members'],
  ['remove_members', 'Remove members'],
  ['manage_weekly_participation', 'Manage weekly participation'],
] as const;

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
  permissionsByUserId = {},
}: {
  clubId: string;
  viewerId: string | null;
  viewerRole: 'owner' | 'admin' | 'member' | null;
  members: Member[];
  permissionsByUserId?: Record<string, string[]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<string | null>(null);

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
          <Fragment key={member.id}>
          <li className="flex items-center gap-3 px-3 py-2.5">
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
            {viewerRole === 'owner' && member.role !== 'owner' ? (
              <button type="button" className="min-h-11 rounded-md px-2 text-xs text-muted hover:bg-surface-hover hover:text-text" onClick={() => setPermissionsFor(permissionsFor === member.id ? null : member.id)}>
                Permissions
              </button>
            ) : null}
          </li>
          {permissionsFor === member.id && viewerRole === 'owner' ? (
            <li className="border-t border-line bg-surface/40 px-3 py-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSIONS.map(([permission, label]) => {
                  const checked = permissionsByUserId[member.id]?.includes(permission) ?? false;
                  return <label key={permission} className="flex min-h-11 items-center gap-2 text-xs text-muted"><input type="checkbox" defaultChecked={checked} onChange={(event) => { const next = new Set(permissionsByUserId[member.id] ?? []); if (event.target.checked) next.add(permission); else next.delete(permission); startTransition(async () => { const result = await setClubMemberPermissionsAction({ clubId, userId: member.id, permissions: [...next] }); if (!result.ok) toast({ message: result.error, tone: 'error' }); else toast({ message: 'Permissions updated', tone: 'success' }); }); }} className="h-4 w-4 accent-[var(--iris)]" />{label}</label>;
                })}
              </div>
            </li>
          ) : null}
          </Fragment>
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
