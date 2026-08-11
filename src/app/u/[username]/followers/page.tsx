import { EmptyState } from '@/components/ui/primitives';
import { UserChip } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getFollowList } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile } = await loadProfileContext(username);
  const people = await getFollowList(profile.id, 'followers');

  if (!people.length) {
    return <EmptyState title="No followers yet" description="Taste takes a while to find its people." />;
  }

  return (
    <div>
      <h2 className="mb-4 text-xl">{pluralize(people.length, 'follower')}</h2>
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
