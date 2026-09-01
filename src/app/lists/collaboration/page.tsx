import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CollaborationInbox } from '@/components/list/collaboration-inbox';
import { Container } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getListCollaborationInbox } from '@/server/services/lists';

export const metadata: Metadata = { title: 'List collaborations', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ListCollaborationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/lists/collaboration');
  const invitations = await getListCollaborationInbox(user.id);
  return (
    <Container size="default" className="py-8 pb-20">
      <header className="mb-7 max-w-2xl">
        <p className="eyebrow">Shared curation</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">List invitations</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Owners can invite editors. Editors can curate films and notes; only the owner controls settings, invitations and deletion.</p>
        <Link href="/lists" className="mt-3 inline-block text-sm text-ember hover:underline">Open your list library →</Link>
      </header>
      <CollaborationInbox invitations={invitations.map(({ invitation, list, owner }) => ({
        id: invitation.id,
        listId: list.id,
        listTitle: list.title,
        ownerName: owner.displayName,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      }))} />
    </Container>
  );
}
