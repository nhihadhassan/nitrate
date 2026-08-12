import { notFound } from 'next/navigation';

import { ClubInvitePanel } from '@/components/club/invite-panel';
import { MemberList } from '@/components/club/member-list';
import { SectionHeading } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getClubMembers, getMembership } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';
  const members = await getClubMembers(club.id);

  return (
    <div className="max-w-2xl space-y-8">
      {isMember ? (
        <section>
          <SectionHeading title="Invite someone" />
          <ClubInvitePanel clubId={club.id} clubName={club.name} inviteCode={club.inviteCode} />
        </section>
      ) : null}

      <section>
        <SectionHeading title={`${members.length} members`} />
        <MemberList
          clubId={club.id}
          viewerId={user?.id ?? null}
          viewerRole={isMember ? membership.role : null}
          members={members.map((member) => ({
            id: member.id,
            username: member.username,
            displayName: member.displayName,
            avatarAssetId: member.avatarAssetId,
            role: member.role,
            filmCount: member.filmCount,
          }))}
        />
      </section>
    </div>
  );
}
