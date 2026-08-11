import { EmptyState } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getFollowList } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile } = await loadProfileContext(username);
  const people = await getFollowList(profile.id, 'following');

  if (!people.length) {
    return (
      <EmptyState
        title="Not following anyone yet"
        description="The feed only gets good once there are people in it."
      />
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl">Following {people.length}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <li key={person.id} className="rounded-lg border border-line p-3">
            <UserChip user={person} size="md" showUsername />
            <p className="mt-2 text-xs text-dim">{pluralize(person.filmCount, 'film')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
