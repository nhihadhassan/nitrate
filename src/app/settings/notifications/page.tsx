import type { Metadata } from 'next';

import { NotificationSettingsForm } from '@/components/settings/notification-settings-form';
import { requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Email settings' };
export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  return (
    <NotificationSettingsForm
      preferences={{
        emailMovieNightReminders: user.emailMovieNightReminders,
        emailPicksAndVoting: user.emailPicksAndVoting,
        emailWinnerSelected: user.emailWinnerSelected,
      }}
    />
  );
}
