import { notFound, redirect } from 'next/navigation';

import { ThemePicker } from '@/components/club/theme-picker';
import { EmptyState } from '@/components/ui/primitives';
import { CURATED_THEMES } from '@/lib/movie-themes';
import { CLUB_TIME_ZONE } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import {
  getActiveRound,
  getClubBySlug,
  getMembership,
  getThemeSuggestions,
  getThemeThumbnail,
} from '@/server/services/clubs';

export const dynamic = 'force-dynamic';

/**
 * The theme-selection step before a new round's nominations open. Reached
 * only from the "Choose the next movie" action, not a tab, so it behaves
 * like `/reveal/[roundId]` or `/screening/[id]`: a real page, not a modal,
 * that happens not to live in the tab bar.
 */
export default async function NewRoundThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const user = await getCurrentUser();
  const membership = await getMembership(club.id, user?.id ?? null);
  const isAdmin = membership?.status === 'active' && membership.role !== 'member';
  if (!isAdmin) {
    return (
      <EmptyState
        title="Admins only"
        description="An admin can start the club's next round."
      />
    );
  }

  const activeRound = await getActiveRound(club.id);
  if (activeRound) redirect(`/club/${club.slug}`);

  const suggestions = await getThemeSuggestions(club.id);
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, month: 'long' })
    .format(now)
    .toUpperCase();
  const monthShort = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, month: 'long' }).format(now);

  // One representative image per curated theme, for the card thumbnails.
  // Provider-only (no DB write). A bounded, small set (~8) fetched once on
  // this admin-only page, and the provider's own caching keeps repeat visits
  // cheap.
  const imageEntries = await Promise.all(
    CURATED_THEMES.map(async (theme) => [theme.id, await getThemeThumbnail(theme)] as const),
  );
  const imageByThemeId = Object.fromEntries(imageEntries);

  return (
    <ThemePicker
      clubId={club.id}
      clubSlug={club.slug}
      suggestions={suggestions}
      allThemes={CURATED_THEMES}
      monthLabel={monthLabel}
      monthName={monthShort}
      imageByThemeId={imageByThemeId}
    />
  );
}
