import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AccountSettings } from '@/components/settings/account-settings';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings/account');
  return (
    <AccountSettings
      email={user.email}
      username={user.username}
      createdAt={user.createdAt.toISOString()}
    />
  );
}
