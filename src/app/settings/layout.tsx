import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Container } from '@/components/ui/primitives';
import { getCurrentUser } from '@/server/auth/session';

import { SettingsNav } from './settings-nav';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings');

  return (
    <Container size="default" className="py-8 pb-20">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Settings</h1>
        <Link href={`/@${user.username}`} className="text-sm text-muted hover:text-ember">
          View your profile →
        </Link>
      </header>

      <div className="grid gap-8 md:grid-cols-[12rem_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
