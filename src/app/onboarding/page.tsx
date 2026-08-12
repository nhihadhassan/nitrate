import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { getCurrentUser } from '@/server/auth/session';
import { getClubPreviewByInvite } from '@/server/services/clubs';
import { getEditorialRails } from '@/server/services/explore';
import { getOnboardingProgress, getSuggestedUsers } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Get set up' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; step?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { invite, step } = await searchParams;
  const [rails, suggested, club] = await Promise.all([
    getEditorialRails(),
    getSuggestedUsers(user.id, 8),
    invite ? getClubPreviewByInvite(invite) : Promise.resolve(null),
  ]);

  // A recognisable spread to rate: broadly popular, well known, poster-first.
  const starters = [...rails.canon, ...rails.trending]
    .filter((film, index, all) => all.findIndex((f) => f.slug === film.slug) === index)
    .slice(0, 18);

  // Read back whatever earlier steps already wrote, so a reload resumes.
  const progress = await getOnboardingProgress(
    user.id,
    starters.map((film) => film.slug),
    suggested.map((person) => person.id),
  );

  return (
    <OnboardingFlow
      initialStep={Number(step) || 0}
      progress={{
        favorites: progress.favorites.map((film) => ({
          movieId: film.id,
          providerId: film.providerId,
          slug: film.slug,
          title: film.title,
          year: film.year,
          posterPath: film.posterPath,
        })),
        ratings: progress.ratings,
        following: progress.following,
      }}
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
