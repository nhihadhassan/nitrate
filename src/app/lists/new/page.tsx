import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ListBuilder } from '@/components/list/list-builder';
import { Container } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'New list' };
export const dynamic = 'force-dynamic';

export default async function NewListPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/lists/new');

  return (
    <Container size="narrow" className="py-8">
      <h1 className="text-3xl">New list</h1>
      <p className="mt-2 text-sm text-muted">
        Ranked or not, a list is the fastest way to say what you would put on.
      </p>
      <div className="mt-7">
        <ListBuilder />
      </div>
    </Container>
  );
}
