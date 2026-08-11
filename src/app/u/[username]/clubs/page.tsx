import Link from 'next/link';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { pluralize } from '@/lib/utils';
import { loadProfileContext } from '@/server/services/profile-context';
import { getUserClubsForProfile } from '@/server/services/profile';

export const dynamic = 'force-dynamic';

export default async function ProfileClubsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { profile, viewer, access } = await loadProfileContext(username);
  const clubs = await getUserClubsForProfile(profile.id, viewer?.id ?? null);

  if (!clubs.length) {
    return (
      <EmptyState
        title={access.isSelf ? 'You are not in a club yet' : 'No shared clubs'}
        description={
          access.isSelf
            ? 'Clubs are where the arguing gets done. Start one, or join with an invite code.'
            : 'Private clubs stay hidden unless you are a member too.'
        }
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map(({ club, role }) => (
        <li key={club.id}>
          <Link
            href={`/club/${club.slug}`}
            className="block rounded-lg border border-line p-4 transition-colors hover:border-iris/40"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-lg leading-tight">{club.name}</p>
              {role !== 'member' ? <Badge tone="iris">{role}</Badge> : null}
            </div>
            {club.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                {club.description}
              </p>
            ) : null}
            <p className="mt-2.5 text-xs text-dim">
              {pluralize(club.memberCount, 'member')} · {pluralize(club.screeningCount, 'screening')}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
