'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { respondToListInvitationAction } from '@/server/actions/lists';

export function CollaborationInbox({ invitations }: {
  invitations: Array<{
    id: string;
    listId: string;
    listTitle: string;
    ownerName: string;
    status: string;
    expiresAt: string;
  }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return invitations.length ? (
    <ul className="divide-y divide-line border-y border-line">
      {invitations.map((invite) => (
        <li key={invite.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href={`/list/${invite.listId}`} className="font-medium hover:text-ember">{invite.listTitle}</a>
            <p className="mt-0.5 text-xs text-dim">Invited by {invite.ownerName} · {invite.status === 'pending' ? `expires ${new Date(invite.expiresAt).toLocaleDateString('en-CA')}` : invite.status}</p>
          </div>
          {invite.status === 'pending' ? <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={pending} onClick={() => respond(invite.id, 'accept')}>Accept</Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => respond(invite.id, 'decline')}>Decline</Button>
          </div> : null}
        </li>
      ))}
    </ul>
  ) : <p className="rounded-md border border-line p-4 text-sm text-dim">No collaboration invitations.</p>;

  function respond(id: string, response: 'accept' | 'decline') {
    startTransition(async () => {
      const result = await respondToListInvitationAction(id, response);
      if (!result.ok) return toast({ message: result.error, tone: 'error' });
      toast({ message: response === 'accept' ? 'You can now edit the list' : 'Invitation declined', tone: 'success' });
      router.refresh();
    });
  }
}
