import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignupForm } from '@/components/auth/signup-form';
import { getCurrentUser } from '@/server/auth/session';
import { getClubPreviewByInvite } from '@/server/services/clubs';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const { invite } = await searchParams;
  const club = invite ? await getClubPreviewByInvite(invite) : null;

  return (
    <div>
      {club ? (
        <div className="mb-6 rounded-lg border border-iris/30 bg-iris/[0.08] px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-iris">You&apos;re invited</p>
          <p className="mt-1 font-display text-xl">{club.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            Create an account and you&apos;ll join the club straight away.
          </p>
        </div>
      ) : null}

      <h1 className="text-center text-3xl">Start your film diary</h1>
      <p className="mt-2 text-center text-sm text-muted">
        Track what you watch, and run movie night properly.
      </p>

      <div className="mt-7">
        <SignupForm inviteCode={invite} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ember hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
