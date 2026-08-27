import type { Metadata } from 'next';

import { PosterCard, PosterGrid } from '@/components/film/poster';
import { DiscoverySettings } from '@/components/settings/discovery-settings';
import { requireUser } from '@/server/auth/session';
import {
  getFollowedFilmmakers,
  getKnownUpcomingWork,
  getRecommendationFeedbackSettings,
  getTasteCircle,
} from '@/server/services/discovery';
import { getFollowList } from '@/server/services/profile';

export const metadata: Metadata = { title: 'Discovery settings' };
export const dynamic = 'force-dynamic';

export default async function DiscoverySettingsPage() {
  const user = await requireUser();
  const [following, circle, hidden, filmmakers, upcoming] = await Promise.all([
    getFollowList(user.id, 'following'),
    getTasteCircle(user.id),
    getRecommendationFeedbackSettings(user.id),
    getFollowedFilmmakers(user.id),
    getKnownUpcomingWork(user.id),
  ]);
  return (
    <>
      <DiscoverySettings
        following={following.map(({ id, username, displayName }) => ({ id, username, displayName }))}
        circle={circle.map(({ id, username, displayName }) => ({ id, username, displayName }))}
        feedEnabled={user.tasteCircleFeedEnabled}
        hidden={hidden.map((item) => ({ ...item, expiresAt: item.expiresAt?.toISOString() ?? null }))}
        filmmakers={filmmakers.map(({ person }) => ({ providerId: person.providerId, name: person.name }))}
      />
      {upcoming.length ? (
        <section className="mt-10 max-w-2xl border-t border-line pt-8">
          <h2 className="text-2xl">Known upcoming work</h2>
          <p className="mt-1.5 text-sm text-muted">Provider-listed dates can change. This is a quiet reference, not a release alert.</p>
          <PosterGrid className="mt-4">
            {upcoming.map(({ film, person, releaseDate }) => (
              <PosterCard
                key={`${person.id}:${film.id}`}
                film={film}
                size="sm"
                footer={<p className="mt-0.5 truncate text-[0.6875rem] text-dim">{person.name} · {releaseDate ?? 'date unknown'}</p>}
              />
            ))}
          </PosterGrid>
        </section>
      ) : null}
    </>
  );
}
