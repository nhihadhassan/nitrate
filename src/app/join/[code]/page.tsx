import type { Metadata } from 'next';
import Link from 'next/link';

import { JoinClubForm } from '@/components/club/join-club-form';
import { Button } from '@/components/ui/button';
import { Container, EmptyState } from '@/components/ui/primitives';
import { pluralize } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { getClubPreviewByInvite } from '@/server/services/clubs';

export const metadata: Metadata = { title: 'Club invite' };
export const dynamic = 'force-dynamic';

/**
 * The growth loop's landing pad. A signed-out visitor is sent to signup with the
 * code attached so they land straight in the club after onboarding.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [user, club] = await Promise.all([getCurrentUser(), getClubPreviewByInvite(code)]);

  if (!club) {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState
          title="That invite is not valid"
          description="It may have expired, been revoked, or already been used. Ask for a fresh link."
          action={
            <Button asChild variant="outline">
              <Link href="/clubs">Browse clubs</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  return (
    <Container size="narrow" className="py-16 text-center">
      <p className="eyebrow text-iris">You&apos;re invited to</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">{club.name}</h1>
      {club.description ? (
        <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted">
          {club.description}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-dim">{pluralize(club.memberCount, 'member')}</p>

      <div className="mx-auto mt-9 max-w-sm">
        {user ? (
          <JoinClubForm initialCode={code} />
        ) : (
          <div className="space-y-3">
            <Button asChild variant="iris" size="lg" className="w-full justify-center">
              <Link href={`/signup?invite=${encodeURIComponent(code)}`}>
                Create an account and join
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full justify-center">
              <Link href={`/login?next=/join/${encodeURIComponent(code)}`}>
                I already have an account
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  );
}
