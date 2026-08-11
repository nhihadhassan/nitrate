import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { getCurrentUser } from '@/server/auth/session';
import { getClubPreviewByInvite } from '@/server/services/clubs';
import { getEditorialRails } from '@/server/services/explore';
import { getSuggestedUsers } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Get set up' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { invite } = await searchParams;
  const [rails, suggested, club] = await Promise.all([
    getEditorialRails(),
    getSuggestedUsers(user.id, 8),
    invite ? getClubPreviewByInvite(invite) : Promise.resolve(null),
  ]);

  // A recognisable spread to rate: broadly popular, well known, poster-first.
  const starters = [...rails.topRated, ...rails.trending]
    .filter((film, index, all) => all.findIndex((f) => f.slug === film.slug) === index)
    .slice(0, 18);

  return (
    <OnboardingFlow
      user={{
        username: user.username,
        displayName: user.displayName,
        avatarAssetId: user.avatarAssetId,
        bio: user.bio,
      }}
      starterFilms={starters}
      suggestedUsers={suggested.map((person) => ({
        id: person.id,
        username: person.username,
        displayName: person.displayName,
        avatarAssetId: person.avatarAssetId,
        filmCount: person.filmCount,
      }))}
      invite={club ? { code: invite!, name: club.name } : null}
    />
  );
}
