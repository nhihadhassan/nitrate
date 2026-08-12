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

          {/* Four Favourites: the closest thing a profile has to a face. Given
              real size, real captions and the top of the page — a person's
              taste should read before their statistics do. */}
          {favorites.length ? (
            <section className="mt-8">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="eyebrow">Four favourites</h2>
                {access.isSelf ? (
                  <Link
                    href="/settings/favorites"
                    className="text-xs text-dim underline underline-offset-2 transition-colors hover:text-ember"
                  >
                    Change
                  </Link>
                ) : null}
              </div>
              <ul className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {favorites.map((movie) => (
                  <li key={movie.id} className="min-w-0">
                    <Poster
                      film={{
                        slug: movie.slug,
                        title: movie.title,
                        year: movie.year,
                        posterPath: movie.posterPath,
                      }}
                      size="md"
                      className="shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] transition-shadow hover:shadow-[0_16px_36px_-16px_rgba(0,0,0,0.95)]"
                    />
                    <p className="mt-2 truncate text-[0.8125rem] font-medium leading-snug">
                      {movie.title}
                    </p>
                    {movie.year ? (
                      <p className="text-[0.6875rem] text-dim tabular">{movie.year}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : access.isSelf ? (
            <section className="mt-9">
              <h2 className="eyebrow mb-3">Four favourites</h2>
              <Link
                href="/settings/favorites"
                className="flex max-w-4xl flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 py-8 text-center transition-colors hover:border-line-strong"
              >
                <span className="font-display text-lg">
                  Pick the four films that say the most about you
                </span>
                <span className="mt-1 text-xs text-dim">
                  They sit at the top of your profile, where people actually look.
                </span>
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
