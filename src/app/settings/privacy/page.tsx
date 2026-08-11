import type { Metadata } from 'next';

import { PrivacySettingsForm } from '@/components/settings/privacy-settings-form';
import { requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Privacy settings' };
export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const user = await requireUser();
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
