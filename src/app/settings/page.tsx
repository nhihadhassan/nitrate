import type { Metadata } from 'next';

import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { requireUser } from '@/server/auth/session';
import { resolveWatchRegion } from '@/server/services/region';
import { getWatchRegions } from '@/server/movies/watch-providers';

export const metadata: Metadata = { title: 'Profile settings' };
export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const [regions, resolvedRegion] = await Promise.all([
    getWatchRegions(),
    resolveWatchRegion(user.watchRegion),
  ]);

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
        watchRegion: user.watchRegion,
        tasteHighlights: user.tasteHighlights,
      }}
      regions={regions}
      resolvedRegion={resolvedRegion}
    />
  );
}
