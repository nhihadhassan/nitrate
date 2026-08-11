import type { Metadata } from 'next';

import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Profile settings' };
export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  return (
    <ProfileSettingsForm
      user={{
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        websiteUrl: user.websiteUrl,
        pronouns: user.pronouns,
        avatarAssetId: user.avatarAssetId,
        timezone: user.timezone,
      }}
    />
  );
}
