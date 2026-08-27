import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CreateClubForm } from '@/components/club/create-club-form';
import { Container } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Create a club' };
export const dynamic = 'force-dynamic';

export default async function NewClubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/clubs/new');

  return (
    <Container size="narrow" className="py-8">
      <h1 className="text-3xl sm:text-4xl">Start a Movie Club</h1>
      <p className="mt-2 text-sm text-muted">
        You&apos;ll get an invite link straight after. Everything else — Movie Ideas, picks, voting,
        scheduling — is already set up.
      </p>
      <div className="mt-7">
        <CreateClubForm defaultTimezone={user.timezone} />
      </div>
    </Container>
  );
}
