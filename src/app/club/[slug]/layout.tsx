import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubTabs } from '@/components/club/club-tabs';
import { ClubActionsMenu } from '@/components/club/club-actions-menu';
import { Badge, Container, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AvatarStack } from '@/components/user/avatar';
import { BRAND } from '@/lib/brand';
import { getCurrentUser } from '@/server/auth/session';
import { getClubBySlug, getClubMembers, getClubPermissions, getMembership } from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

/**
 * A club names the *page*, never the product: the title template still appends
 * the application name, so "Tuesday Horror Club · Nitrate" reads correctly and
 * a club can never be mistaken for the site itself.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return { title: 'Club not found' };
  const isPrivate = club.visibility === 'private';
  return {
    title: club.name,
    description: isPrivate
      ? undefined
      : (club.description ?? `${club.name} — a Movie Club on ${BRAND.name}.`),
    alternates: isPrivate ? undefined : { canonical: `/club/${encodeURIComponent(club.slug)}` },
    // Private clubs must not be indexed or previewed anywhere.
    robots: isPrivate ? { index: false, follow: false } : undefined,
    openGraph: isPrivate
      ? undefined
      : {
          title: club.name,
          description: club.description ?? undefined,
          type: 'website',
          url: `/club/${encodeURIComponent(club.slug)}`,
        },
  };
}

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
  const members = await getClubMembers(club.id);
  const permissions = isMember && user ? await getClubPermissions(club.id, user.id) : new Set();

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
      <header className="border-b border-line bg-canvas-raised/30">
        <Container size="wide" className="pt-5 sm:pt-8">
          <div className="flex items-center gap-3 sm:items-start sm:gap-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-line bg-surface sm:h-20 sm:w-20">
              {club.imageAssetId ? (
                <Image
                  src={`/media/${club.imageAssetId}`}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 48px, 80px"
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
              <div className="flex items-center gap-2">
                <h1 className="line-clamp-2 text-2xl leading-tight sm:text-4xl">{club.name}</h1>
                <Badge tone={club.visibility === 'private' ? 'neutral' : 'iris'}>{club.visibility}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <AvatarStack users={members} max={5} size="sm" />
                {membership && membership.role !== 'member' ? <span className="text-xs capitalize text-iris">{membership.role}</span> : null}
              </div>
              {club.description ? (
                <p className="mt-3 hidden max-w-2xl text-[0.9375rem] leading-relaxed text-muted sm:block">
                  {club.description}
                </p>
              ) : null}
              {club.interests.length ? (
                <ul className="mt-2.5 hidden flex-wrap gap-1.5 sm:flex">
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
            <ClubActionsMenu
              clubId={club.id}
              clubSlug={club.slug}
              clubName={club.name}
              inviteCode={club.inviteCode}
              role={isMember && membership ? membership.role : null}
              canManageSettings={permissions.has('manage_club_settings')}
              signedIn={Boolean(user)}
            />
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
