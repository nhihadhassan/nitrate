import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProfileActions } from '@/components/user/profile-actions';
import { Poster } from '@/components/film/poster';
import { Avatar } from '@/components/user/avatar';
import { Container, EmptyState } from '@/components/ui/primitives';
import { formatCount } from '@/lib/utils';
import { getCurrentUser } from '@/server/auth/session';
import { loadUserByUsername, resolveProfileAccess } from '@/server/privacy';
import { countClubsFor } from '@/server/services/clubs';
import { getFavoriteFilms } from '@/server/services/profile';

import { ProfileTabs } from './profile-tabs';

export const dynamic = 'force-dynamic';

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await loadUserByUsername(decodeURIComponent(username)).catch(() => null);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const viewerRef = viewer ? { id: viewer.id, role: viewer.role } : null;
  const access = await resolveProfileAccess(profile, viewerRef);

  if (!access.canView) {
    return (
      <Container size="narrow" className="py-16">
        <EmptyState
          title={access.reason === 'blocked' ? 'This profile is unavailable' : 'This profile is private'}
          description={
            access.reason === 'followers_only'
              ? `${profile.displayName} only shares with people they follow back.`
              : access.reason === 'blocked'
                ? 'You cannot view this account.'
                : 'This member keeps their profile to themselves.'
          }
        />
      </Container>
    );
  }

  const [favorites, clubCount] = await Promise.all([
    getFavoriteFilms(profile.id),
    countClubsFor(profile.id),
  ]);

  return (
    <div>
      <header className="border-b border-line">
        <Container className="pt-8 sm:pt-10" size="wide">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <Avatar user={profile} size="xl" className="h-20 w-20 sm:h-24 sm:w-24" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl leading-tight sm:text-4xl">{profile.displayName}</h1>
                  <p className="mt-0.5 text-sm text-dim">
                    @{profile.username}
                    {access.isFollowedBy && !access.isSelf ? (
                      <span className="ml-2 rounded-xs border border-line px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted">
                        Follows you
                      </span>
                    ) : null}
                  </p>
                </div>
                <ProfileActions
                  profile={{
                    id: profile.id,
                    username: profile.username,
                    displayName: profile.displayName,
                  }}
                  isSelf={access.isSelf}
                  isFollowing={access.isFollowing}
                  signedIn={Boolean(viewer)}
                />
              </div>

              {profile.bio ? (
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
                  {profile.bio}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-dim">
                {profile.location ? <span>{profile.location}</span> : null}
                {profile.websiteUrl ? (
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener nofollow"
                    className="underline underline-offset-2 hover:text-ember"
                  >
                    {profile.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                ) : null}
                {profile.pronouns ? <span>{profile.pronouns}</span> : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                <Stat value={profile.filmCount} label="films" />
                <Link href={`/@${profile.username}/followers`} className="hover:text-ember">
                  <Stat value={profile.followerCount} label="followers" />
                </Link>
                <Link href={`/@${profile.username}/following`} className="hover:text-ember">
                  <Stat value={profile.followingCount} label="following" />
                </Link>
                {clubCount > 0 ? <Stat value={clubCount} label={clubCount === 1 ? 'club' : 'clubs'} /> : null}
              </div>
            </div>
          </div>

          {favorites.length ? (
            <section className="mt-8">
              <p className="eyebrow mb-2.5">Favourites</p>
              <div className="grid max-w-2xl grid-cols-4 gap-2.5">
                {favorites.map((movie) => (
                  <Poster
                    key={movie.id}
                    film={{
                      slug: movie.slug,
                      title: movie.title,
                      year: movie.year,
                      posterPath: movie.posterPath,
                    }}
                    size="md"
                  />
                ))}
              </div>
            </section>
          ) : access.isSelf ? (
            <section className="mt-8">
              <p className="eyebrow mb-2.5">Favourites</p>
              <Link
                href="/settings/favorites"
                className="flex max-w-2xl items-center justify-center rounded-md border border-dashed border-line px-4 py-6 text-sm text-muted transition-colors hover:border-line-strong hover:text-text"
              >
                Pick the four films that say the most about you →
              </Link>
            </section>
          ) : null}

          <ProfileTabs username={profile.username} isSelf={access.isSelf} />
        </Container>
      </header>

      <Container size="wide" className="py-8">
        {children}
      </Container>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-medium tabular">{formatCount(value)}</span>
      <span className="text-dim">{label}</span>
    </span>
  );
}
