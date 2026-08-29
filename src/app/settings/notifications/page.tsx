import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationSettingsForm } from '@/components/settings/notification-settings-form';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Email settings' };
export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings/notifications');
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
