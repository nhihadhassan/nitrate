import type { Metadata } from 'next';

import { FollowButton } from '@/components/user/follow-button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { Avatar } from '@/components/user/avatar';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { followingIds } from '@/server/privacy';
import { getSuggestedUsers } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Find people' };
export const dynamic = 'force-dynamic';

export default async function ExplorePeoplePage() {
  const user = await getCurrentUser();
  const [people, following] = await Promise.all([
    getSuggestedUsers(user?.id ?? null, 40),
    user ? followingIds(user.id) : Promise.resolve([]),
  ]);

  const followingSet = new Set(following);

  return (
    <Container size="wide" className="py-8">
      <header className="mb-7 max-w-xl">
        <h1 className="text-3xl sm:text-4xl">Find people</h1>
        <p className="mt-2 text-sm text-muted">
          Members with public profiles, sorted by how much they have logged. Follow a few and your
          feed starts working.
        </p>
      </header>

      {people.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <Avatar user={person} size="lg" />
              <div className="min-w-0 flex-1">
                <a href={`/@${person.username}`} className="block truncate font-medium hover:text-ember">
                  {person.displayName}
                </a>
                <p className="truncate text-xs text-dim">@{person.username}</p>
                <p className="mt-0.5 text-xs text-dim">{pluralize(person.filmCount, 'film')}</p>
              </div>
              <FollowButton
                userId={person.id}
                initialFollowing={followingSet.has(person.id)}
                signedIn={Boolean(user)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nobody to suggest yet"
          description="Invite a friend — or start a Movie Club and bring the whole group."
        />
      )}
    </Container>
  );
}
