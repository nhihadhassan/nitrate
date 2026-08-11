import { notFound } from 'next/navigation';

import { ClubSettingsForm } from '@/components/club/club-settings-form';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getMembership } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  if (!membership || membership.status !== 'active' || membership.role === 'member') {
    return (
      <EmptyState title="Admins only" description="Only club admins can change these settings." />
    );
  }

  return (
    <div className="max-w-2xl">
      <ClubSettingsForm
        club={{
          id: club.id,
          slug: club.slug,
          name: club.name,
          description: club.description,
          visibility: club.visibility,
          timezone: club.timezone,
          interests: club.interests,
          imageAssetId: club.imageAssetId,
          weeklyPickEnabled: club.weeklyPickEnabled,
          weeklyPickDay: club.weeklyPickDay,
          weeklyPickHour: club.weeklyPickHour,
        }}
        isOwner={membership.role === 'owner'}
      />
    </div>
  );
}
