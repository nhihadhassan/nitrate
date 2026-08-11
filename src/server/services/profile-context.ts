import 'server-only';

import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/server/auth/session';
import type { User } from '@/server/db/schema';
import { loadUserByUsername, resolveProfileAccess, type ProfileAccess, type Viewer } from '@/server/privacy';

export type ProfileContext = {
  profile: User;
  viewer: Viewer;
  access: ProfileAccess;
};

/**
 * Loads and authorises a profile page. Every profile sub-route calls this, so
 * "can this person see this?" is answered in exactly one place.
 */
export async function loadProfileContext(usernameParam: string): Promise<ProfileContext> {
  const profile = await loadUserByUsername(decodeURIComponent(usernameParam)).catch(() => null);
  if (!profile) notFound();

  const current = await getCurrentUser();
  const viewer = current ? { id: current.id, role: current.role } : null;
  const access = await resolveProfileAccess(profile, viewer);
  if (!access.canView) notFound();

  return { profile, viewer, access };
}
