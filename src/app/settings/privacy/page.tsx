import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PrivacySettingsForm } from '@/components/settings/privacy-settings-form';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Privacy settings' };
export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings/privacy');
  return (
    <PrivacySettingsForm
      settings={{
        profileVisibility: user.profileVisibility,
        defaultEntryVisibility: user.defaultEntryVisibility,
        showWatchlistPublicly: user.showWatchlistPublicly,
        allowFollows: user.allowFollows,
        adultContent: user.adultContent,
      }}
    />
  );
}
