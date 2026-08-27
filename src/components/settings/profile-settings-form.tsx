'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { changeUsernameAction, updateProfileAction } from '@/server/actions/profile';

export function ProfileSettingsForm({
  user,
  regions,
  resolvedRegion,
}: {
  user: {
    username: string;
    displayName: string;
    bio: string | null;
    location: string | null;
    websiteUrl: string | null;
    pronouns: string | null;
    avatarAssetId: string | null;
    timezone: string;
    watchRegion: string | null;
  };
  /** Full picker list from TMDB; empty when the provider is unreachable. */
  regions: { code: string; name: string }[];
  /** What "Automatic" currently resolves to, so the honest source is visible even when nothing is chosen. */
  resolvedRegion: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [location, setLocation] = useState(user.location ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl ?? '');
  const [pronouns, setPronouns] = useState(user.pronouns ?? '');
  const [timezone, setTimezone] = useState(user.timezone);
  const [watchRegion, setWatchRegion] = useState(user.watchRegion ?? '');
  const [avatarAssetId, setAvatarAssetId] = useState(user.avatarAssetId);
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-xl space-y-10">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await updateProfileAction({
              displayName,
              bio: bio.trim() || null,
              location: location.trim() || null,
              websiteUrl: websiteUrl.trim() || null,
              pronouns: pronouns.trim() || null,
              avatarAssetId,
              timezone,
              watchRegion: watchRegion || null,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast({ message: 'Profile saved', tone: 'success' });
            router.refresh();
          });
        }}
      >
        <h2 className="text-2xl">Your profile</h2>
        <FormError>{error}</FormError>

        <div className="flex gap-4">
          <ImageUpload kind="avatar" value={avatarAssetId} onChange={setAvatarAssetId} />
          <div className="min-w-0 flex-1">
            <Field label="Display name" htmlFor="settings-display-name">
              <input
                id="settings-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
                required
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <Field label="Bio" htmlFor="settings-bio" optional>
          <textarea
            id="settings-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
            maxLength={500}
            className={cn(inputClass, 'resize-y')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="settings-location" optional>
            <input
              id="settings-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={60}
              className={inputClass}
            />
          </Field>
          <Field label="Pronouns" htmlFor="settings-pronouns" optional>
            <input
              id="settings-pronouns"
              value={pronouns}
              onChange={(event) => setPronouns(event.target.value)}
              maxLength={30}
              placeholder="they/them"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Link" htmlFor="settings-website" optional hint="Include https://">
          <input
            id="settings-website"
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </Field>

        <Field
          label="Timezone"
          htmlFor="settings-timezone"
          hint="Used for dates in your diary and club reminders."
        >
          <input
            id="settings-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Streaming region"
          htmlFor="settings-watch-region"
          hint={
            watchRegion
              ? 'Decides which providers show up under "Where to watch".'
              : `Automatic — currently ${resolvedRegion}, based on your location. Decides which providers show up under "Where to watch".`
          }
        >
          <select
            id="settings-watch-region"
            value={watchRegion}
            onChange={(event) => setWatchRegion(event.target.value)}
            className={inputClass}
          >
            <option value="">Automatic ({resolvedRegion})</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <form
        className="space-y-4 border-t border-line pt-8"
        onSubmit={(event) => {
          event.preventDefault();
          setFields({});
          startTransition(async () => {
            const result = await changeUsernameAction(username);
            if (!result.ok) {
              setFields(result.fields ?? {});
              toast({ message: result.error, tone: 'error' });
              return;
            }
            toast({ message: 'Username updated', tone: 'success' });
            router.push(`/@${username}`);
            router.refresh();
          });
        }}
      >
        <h2 className="text-2xl">Username</h2>
        <Field
          label="Username"
          htmlFor="settings-username"
          error={fields.username}
          hint={`Your profile lives at /@${username}. Old links stop working when you change it.`}
        >
          <input
            id="settings-username"
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
            minLength={3}
            maxLength={20}
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            disabled={pending || username === user.username || username.length < 3}
          >
            Change username
          </Button>
        </div>
      </form>
    </div>
  );
}
