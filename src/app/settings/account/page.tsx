import type { Metadata } from 'next';

import { AccountSettings } from '@/components/settings/account-settings';
import { requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await requireUser();
  return (
    <AccountSettings
      email={user.email}
      username={user.username}
      createdAt={user.createdAt.toISOString()}
    />
  );
}
