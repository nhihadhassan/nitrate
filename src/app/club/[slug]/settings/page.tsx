import { notFound } from 'next/navigation';
import Link from 'next/link';

import { ClubSettingsForm } from '@/components/club/club-settings-form';
import { PublicJoinSettings } from '@/components/club/public-join-settings';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getClubMembers, getClubPermissions, getMembership } from '@/server/services/clubs';
import { listPendingClubJoinRequests } from '@/server/services/network-clubs';

export const dynamic = 'force-dynamic';

export default async function ClubSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const permissions = user && membership?.status === 'active'
    ? await getClubPermissions(club.id, user.id)
    : new Set();
  if (!membership || membership.status !== 'active' || !permissions.has('manage_club_settings')) {
    return (
      <EmptyState title="Settings permission required" description="The club owner can choose who may change these settings." />
    );
  }
  const canManageJoining = membership.role !== 'member';
  const [requests, members] = await Promise.all([
    club.visibility === 'public' && user && canManageJoining ? listPendingClubJoinRequests(club.id, user.id) : Promise.resolve([]),
    getClubMembers(club.id),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href={`/club/${club.slug}`} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-text">
        <span aria-hidden className="mr-2 text-lg">‹</span>
        Back to club
      </Link>
      <header className="mb-7 mt-2">
        <h1 className="text-3xl sm:text-4xl">Members &amp; club settings</h1>
        <p className="mt-2 text-sm text-muted">People, preferences, and everything in between.</p>
      </header>
      <ClubSettingsForm
        club={{
          id: club.id,
          slug: club.slug,
          name: club.name,
          description: club.description,
          visibility: club.visibility,
          interests: club.interests,
          imageAssetId: club.imageAssetId,
          blindRatingsEnabled: club.blindRatingsEnabled,
          selectionCadence: club.selectionCadence,
          customCadenceDays: club.customCadenceDays,
          weeklyPickEnabled: club.weeklyPickEnabled,
          weeklyPickDay: club.weeklyPickDay,
          weeklyPickHour: club.weeklyPickHour,
        }}
        isOwner={membership.role === 'owner'}
        memberCount={members.length}
      />
      {canManageJoining ? <PublicJoinSettings clubId={club.id} visibility={club.visibility} initialPolicy={club.joinPolicy} requests={requests.map(({request,user})=>({id:request.id,username:user.username,displayName:user.displayName,message:request.message,createdAt:request.createdAt.toISOString()}))}/> : null}
    </div>
  );
}
