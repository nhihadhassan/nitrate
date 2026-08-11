import Link from 'next/link';

import { ListCard } from '@/components/list/list-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { loadProfileContext } from '@/server/services/profile-context';
import { getUserLists } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function ProfileListsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);
  const lists = await getUserLists(profile.id, viewer, 40);

  if (!lists.length) {
    return (
      <EmptyState
        title={access.isSelf ? 'No lists yet' : 'No lists'}
        description={
          access.isSelf
            ? 'A list is the fastest way to say “here is what I would put on”. Ranked or not, up to you.'
            : `${profile.displayName} has not published any lists.`
        }
        action={
          access.isSelf ? (
            <Button asChild variant="primary">
              <Link href="/lists/new">Create a list</Link>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div>
      {access.isSelf ? (
        <div className="mb-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/lists/new">New list</Link>
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>
    </div>
  );
}
