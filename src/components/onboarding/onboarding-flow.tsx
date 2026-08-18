'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Poster } from '@/components/film/poster';
import { StarInput } from '@/components/film/star-input';
import { LikeMark } from '@/components/film/stars';
import { FilmPicker, type PickedFilm } from '@/components/log/film-picker';
import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { CheckIcon, ChevronRightIcon } from '@/components/ui/icons';
import { Container, Field, FormError, inputClass } from '@/components/ui/primitives';
import { Avatar } from '@/components/user/avatar';
import { cn } from '@/lib/utils';
import { joinClubAction } from '@/server/actions/clubs';
import {
  completeOnboardingAction,
  quickRateAction,
  setFavoritesAction,
  trackOnboardingStepAction,
  updateProfileAction,
} from '@/server/actions/profile';
import { toggleFollowAction } from '@/server/actions/social';
import { BRAND } from '@/lib/brand';

type StarterFilm = { slug: string; title: string; year: number | null; posterPath: string | null };

const STEPS = ['Welcome', 'Profile', 'Favourites', 'Taste', 'People', 'Clubs'] as const;

/**
 * Onboarding exists to make the profile non-empty. Every step writes real data
 * (a real avatar, real favourites, real ratings, real follows) and every step
 * after the first can be skipped without breaking anything.
 */
export function OnboardingFlow({
  user,
  starterFilms,
  suggestedUsers,
  invite,
  initialStep = 0,
  progress,
}: {
  initialStep?: number;
  /** What earlier steps already saved, so a reload does not look like a reset. */
  progress?: {
    favorites: PickedFilm[];
    ratings: Record<string, { rating: number | null; liked: boolean }>;
    following: string[];
  };
  user: { username: string; displayName: string; avatarAssetId: string | null; bio: string | null };
  starterFilms: StarterFilm[];
  suggestedUsers: {
    id: string;
    username: string;
    displayName: string;
    avatarAssetId: string | null;
    filmCount: number;
  }[];
  invite: { code: string; name: string } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarAssetId, setAvatarAssetId] = useState(user.avatarAssetId);

  const [favorites, setFavorites] = useState<PickedFilm[]>(progress?.favorites ?? []);
  const [rated, setRated] = useState<Record<string, { rating: number | null; liked: boolean }>>(
    progress?.ratings ?? {},
  );
  const [followed, setFollowed] = useState<Set<string>>(new Set(progress?.following ?? []));

  /**
   * The step lives in the URL so a refresh comes back to the same place.
   *
   * `history.replaceState` rather than the router: this is the same page with
   * the same data, and a server round-trip on every step would be a stutter for
   * nothing. Replace rather than push, so the browser Back button leaves
   * onboarding instead of walking back through it one step at a time — the
   * in-page Back button is for that.
   */
  function goTo(index: number) {
    const clamped = Math.min(Math.max(index, 0), STEPS.length - 1);
    setStep(clamped);
    setError(null);
    const url = new URL(window.location.href);
    if (clamped === 0) url.searchParams.delete('step');
    else url.searchParams.set('step', String(clamped));
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  function next() {
    void trackOnboardingStepAction(STEPS[step]);
    goTo(step + 1);
  }

  function back() {
    goTo(step - 1);
  }

  function finish(skipped: boolean) {
    startTransition(async () => {
      if (invite) {
        const joined = await joinClubAction(invite.code);
        if (joined.ok) {
          await completeOnboardingAction(skipped);
          router.push(`/club/${joined.data.slug}?welcome=joined`);
          router.refresh();
          return;
        }
      }
      const result = await completeOnboardingAction(skipped);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/@${result.data.username}`);
      router.refresh();
    });
  }

  return (
    <Container size="narrow" className="py-10 pb-24">
      <nav aria-label="Progress" className="mb-8 flex items-center gap-1.5">
        {STEPS.map((label, index) => (
          <span
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index <= step ? 'bg-ember' : 'bg-line',
            )}
          >
            <span className="sr-only">
              {label}
              {index === step ? ' (current)' : ''}
            </span>
          </span>
        ))}
      </nav>

      {/* Sits above the step rather than in each footer, so every step —
          including the last one, which has its own buttons — can go back. */}
      {step > 0 ? (
        <button
          type="button"
          onClick={back}
          disabled={pending}
          className="mb-5 -ml-1 flex items-center gap-1 rounded-md px-1 py-1 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
          Back to {STEPS[step - 1].toLowerCase()}
        </button>
      ) : null}

      <FormError>{error}</FormError>

      {step === 0 ? (
        <section>
          <h1 className="text-4xl leading-tight sm:text-5xl">
            Welcome{invite ? ` to ${invite.name}` : ` to ${BRAND.name}`}
          </h1>
          <ul className="mt-8 space-y-5">
            {[
              ['Track what you watch.', 'A diary that keeps every rewatch, with its own rating.'],
              ['Discover what to watch.', 'Through people whose taste you actually trust.'],
              ['Watch better with friends.', 'Movie Clubs handle the arguing, voting and scheduling.'],
            ].map(([title, body]) => (
              <li key={title}>
                <p className="font-display text-xl">{title}</p>
                <p className="mt-0.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex gap-2">
            {!invite ? (
              <Button asChild variant="primary" size="lg">
                <Link href="/import?returnTo=%2Fonboarding%3Fstep%3D1">Import from Letterboxd</Link>
              </Button>
            ) : null}
            <Button variant={invite ? 'primary' : 'outline'} size="lg" onClick={next}>
              {invite ? "Let's go" : 'Start fresh'}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => finish(true)} disabled={pending}>
              Skip setup
            </Button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section>
          <h1 className="text-3xl sm:text-4xl">Make it yours</h1>
          <p className="mt-2 text-sm text-muted">A photo and a line about your taste. Both optional.</p>

          <div className="mt-7 flex gap-4">
            <ImageUpload kind="avatar" value={avatarAssetId} onChange={setAvatarAssetId} />
            <div className="min-w-0 flex-1 space-y-4">
              <Field label="Display name" htmlFor="onboarding-name">
                <input
                  id="onboarding-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={50}
                  className={inputClass}
                />
              </Field>
              <Field label="Bio" htmlFor="onboarding-bio" optional>
                <textarea
                  id="onboarding-bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Horror apologist. Will defend the 1998 Godzilla."
                  className={cn(inputClass, 'resize-y')}
                />
              </Field>
            </div>
          </div>

          <StepFooter
            pending={pending}
            onSkip={next}
            onNext={() =>
              startTransition(async () => {
                const result = await updateProfileAction({
                  displayName: displayName.trim() || user.username,
                  bio: bio.trim() || null,
                  location: null,
                  websiteUrl: null,
                  pronouns: null,
                  avatarAssetId,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                next();
              })
            }
          />
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <h1 className="text-3xl sm:text-4xl">Pick four favourites</h1>
          <p className="mt-2 text-sm text-muted">
            These sit at the top of your profile. They say more about you than a bio does.
          </p>

          <div className="mt-6 grid grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map((index) => {
              const film = favorites[index];
              return film ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => setFavorites((current) => current.filter((_, i) => i !== index))}
                  className="group relative text-left"
                  aria-label={`Remove ${film.title}`}
                >
                  <Poster
                    film={{
                      slug: film.slug ?? film.providerId ?? '',
                      title: film.title,
                      year: film.year,
                      posterPath: film.posterPath,
                    }}
                    linked={false}
                    size="md"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/70 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Remove
                  </span>
                </button>
              ) : (
                <div
                  key={index}
                  className="flex aspect-[2/3] items-center justify-center rounded-sm border border-dashed border-line text-2xl text-dim"
                >
                  {index + 1}
                </div>
              );
            })}
          </div>

          {favorites.length < 4 ? (
            <div className="mt-5">
              <FilmPicker
                placeholder="Search for a favourite…"
                excludeProviderIds={favorites.map((f) => f.providerId).filter(Boolean) as string[]}
                onPick={(film) => setFavorites((current) => [...current, film].slice(0, 4))}
              />
            </div>
          ) : null}

          <StepFooter
            pending={pending}
            onSkip={next}
            nextLabel={favorites.length ? 'Save favourites' : 'Continue'}
            onNext={() =>
              startTransition(async () => {
                if (favorites.length) {
                  const result = await setFavoritesAction(
                    favorites.map((f) => ({ movieId: f.movieId, providerId: f.providerId })),
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                }
                next();
              })
            }
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <h1 className="text-3xl sm:text-4xl">Rate a few you know</h1>
          <p className="mt-2 text-sm text-muted">
            Each one becomes a real entry on your profile. Skip anything you have not seen.
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {starterFilms.map((film) => {
              const state = rated[film.slug];
              return (
                <li key={film.slug} className="rounded-lg border border-line p-2.5">
                  <Poster film={film} linked={false} size="sm" />
                  <p className="mt-2 truncate text-xs font-medium">{film.title}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <StarInput
                      size="sm"
                      value={state?.rating ?? null}
                      label={`Rate ${film.title}`}
                      onChange={(value) => {
                        setRated((current) => ({
                          ...current,
                          [film.slug]: { rating: value, liked: current[film.slug]?.liked ?? false },
                        }));
                        void quickRateAction({
                          providerId: film.slug,
                          rating: value,
                          liked: rated[film.slug]?.liked ?? false,
                        });
                      }}
                    />
                    <button
                      type="button"
                      aria-pressed={state?.liked ?? false}
                      aria-label={`Like ${film.title}`}
                      onClick={() => {
                        const liked = !(rated[film.slug]?.liked ?? false);
                        setRated((current) => ({
                          ...current,
                          [film.slug]: { rating: current[film.slug]?.rating ?? null, liked },
                        }));
                        void quickRateAction({
                          providerId: film.slug,
                          rating: rated[film.slug]?.rating ?? null,
                          liked,
                        });
                      }}
                      className={cn(
                        'shrink-0 rounded-md p-1 text-sm transition-colors',
                        state?.liked ? 'text-rose' : 'text-dim hover:text-muted',
                      )}
                    >
                      <LikeMark filled={state?.liked ?? false} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <StepFooter pending={pending} onSkip={next} onNext={next} nextLabel="Continue" />
        </section>
      ) : null}

      {step === 4 ? (
        <section>
          <h1 className="text-3xl sm:text-4xl">Follow a few people</h1>
          <p className="mt-2 text-sm text-muted">
            Your feed is only as good as who is in it. You can always change your mind.
          </p>

          {suggestedUsers.length ? (
            <ul className="mt-6 space-y-2">
              {suggestedUsers.map((person) => {
                const isFollowing = followed.has(person.id);
                return (
                  <li
                    key={person.id}
                    className="flex items-center gap-3 rounded-lg border border-line p-3"
                  >
                    <Avatar user={person} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{person.displayName}</p>
                      <p className="truncate text-xs text-dim">
                        @{person.username} · {person.filmCount} films
                      </p>
                    </div>
                    <Button
                      variant={isFollowing ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFollowed((current) => {
                          const nextSet = new Set(current);
                          if (isFollowing) nextSet.delete(person.id);
                          else nextSet.add(person.id);
                          return nextSet;
                        });
                        void toggleFollowAction(person.id);
                      }}
                    >
                      {isFollowing ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5" /> Following
                        </>
                      ) : (
                        'Follow'
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-dim">
              You are early. Invite a friend and their activity will fill your feed.
            </p>
          )}

          <StepFooter pending={pending} onSkip={next} onNext={next} nextLabel="Continue" />
        </section>
      ) : null}

      {step === 5 ? (
        <section>
          <h1 className="text-3xl sm:text-4xl">
            {invite ? `Ready to join ${invite.name}?` : 'One last thing'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {invite
              ? 'We will drop you straight into the club.'
              : 'Movie Clubs are the best part of Nitrate. Start one, or bring your history over first.'}
          </p>

          {!invite ? (
            <div className="mt-7 space-y-3">
              <Link
                href="/clubs/new"
                className="block rounded-lg border border-iris/30 bg-iris/[0.06] p-4 transition-colors hover:border-iris/50"
              >
                <p className="font-display text-xl">Start a Movie Club</p>
                <p className="mt-1 text-sm text-muted">
                  Movie Ideas, simple picks, blind voting, movie nights. Takes thirty seconds.
                </p>
              </Link>
              <Link
                href="/import"
                className="block rounded-lg border border-line p-4 transition-colors hover:border-line-strong"
              >
                <p className="font-display text-xl">Import from Letterboxd</p>
                <p className="mt-1 text-sm text-muted">
                  Bring your diary, ratings, reviews and watchlist across.
                </p>
              </Link>
            </div>
          ) : null}

          <div className="mt-10 flex gap-2">
            <Button variant="primary" size="lg" onClick={() => finish(false)} disabled={pending}>
              {pending ? 'Finishing…' : invite ? 'Join and finish' : 'Finish setup'}
            </Button>
          </div>
        </section>
      ) : null}
    </Container>
  );
}

function StepFooter({
  pending,
  onNext,
  onSkip,
  nextLabel = 'Continue',
}: {
  pending: boolean;
  onNext: () => void;
  onSkip: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="mt-10 flex items-center gap-2">
      <Button variant="primary" size="lg" onClick={onNext} disabled={pending}>
        {pending ? 'Saving…' : nextLabel}
      </Button>
      <Button variant="ghost" size="lg" onClick={onSkip} disabled={pending}>
        Skip
      </Button>
    </div>
  );
}
