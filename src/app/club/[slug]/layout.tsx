import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubTabs } from '@/components/club/club-tabs';
import { Badge, Container, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getMembership } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isMember = membership?.status === 'active';

  // Private clubs render nothing but a wall to non-members.
  if (club.visibility === 'private' && !isMember) {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState
          title="This club is private"
          description="You need an invite from a member to see what's inside."
          action={
            <Button asChild variant="outline">
              <Link href="/clubs">Back to clubs</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  return (
    <div>
      <header className="border-b border-line bg-canvas-raised/40">
        <Container size="wide" className="pt-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-surface sm:h-20 sm:w-20">
              {club.imageAssetId ? (
                <Image
                  src={`/media/${club.imageAssetId}`}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full items-center justify-center font-display text-2xl text-iris">
                  {club.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl leading-tight sm:text-4xl">{club.name}</h1>
                <Badge tone={club.visibility === 'private' ? 'neutral' : 'iris'}>
                  {club.visibility}
                </Badge>
                {membership && membership.role !== 'member' ? (
                  <Badge tone="iris">{membership.role}</Badge>
                ) : null}
              </div>
              {club.description ? (
                <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
                  {club.description}
                </p>
              ) : null}
              <p className="mt-2.5 text-xs text-dim">
                {pluralize(club.memberCount, 'member')} ·{' '}
                {pluralize(club.screeningCount, 'screening')} · {club.timezone}
              </p>
              {club.interests.length ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {club.interests.map((interest) => (
                    <li
                      key={interest}
                      className="rounded-xs border border-line px-2 py-0.5 text-[0.6875rem] text-muted"
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {!isMember && club.visibility === 'public' && user ? (
              <Button asChild variant="iris" className="shrink-0">
                <Link href={`/join/${club.inviteCode}`}>Join club</Link>
              </Button>
            ) : null}
          </div>

          <ClubTabs slug={club.slug} isMember={isMember} isAdmin={membership?.role !== 'member' && isMember} />
        </Container>
      </header>

      <Container size="wide" className="py-8 pb-20">
        {children}
      </Container>
    </div>
  );
}
