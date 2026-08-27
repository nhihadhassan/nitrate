import { notFound } from 'next/navigation';

import { ClubSettingsForm } from '@/components/club/club-settings-form';
import { PublicJoinSettings } from '@/components/club/public-join-settings';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getMembership } from '@/server/services/clubs';
import { listPendingClubJoinRequests } from '@/server/services/network-clubs';

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
  const requests = club.visibility === 'public' && user ? await listPendingClubJoinRequests(club.id,user.id):[];

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
          blindRatingsEnabled: club.blindRatingsEnabled,
          weeklyPickEnabled: club.weeklyPickEnabled,
          weeklyPickDay: club.weeklyPickDay,
          weeklyPickHour: club.weeklyPickHour,
        }}
        isOwner={membership.role === 'owner'}
      />
      <PublicJoinSettings clubId={club.id} visibility={club.visibility} initialPolicy={club.joinPolicy} requests={requests.map(({request,user})=>({id:request.id,username:user.username,displayName:user.displayName,message:request.message,createdAt:request.createdAt.toISOString()}))}/>
    </div>
  );
}
