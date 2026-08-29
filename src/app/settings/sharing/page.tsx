import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SharingSettings } from '@/components/settings/sharing-settings';
import { getCurrentUser } from '@/server/auth/session';
import { listShareSnapshots } from '@/server/services/shares';

export const metadata: Metadata = { title: 'Sharing settings' };
export const dynamic = 'force-dynamic';

export default async function SharingSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/settings/sharing');
  const shares = await listShareSnapshots(user.id);
  return <SharingSettings shares={shares.map((share) => ({ ...share, createdAt: share.createdAt.toISOString(), lastAccessedAt: share.lastAccessedAt?.toISOString() ?? null }))} />;
}
