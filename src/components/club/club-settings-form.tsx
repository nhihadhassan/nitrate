'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WeeklyPickSettings } from '@/components/club/weekly-pick-settings';
import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { deleteClubAction, leaveClubAction, updateClubAction } from '@/server/actions/clubs';

export function ClubSettingsForm({
  club,
  isOwner,
}: {
  club: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: 'private' | 'public';
    timezone: string;
    interests: string[];
    imageAssetId: string | null;
    weeklyPickEnabled: boolean;
    weeklyPickDay: number;
    weeklyPickHour: number;
  };
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [visibility, setVisibility] = useState(club.visibility);
  const [timezone, setTimezone] = useState(club.timezone);
  const [interests, setInterests] = useState(club.interests.join(', '));
  const [imageAssetId, setImageAssetId] = useState(club.imageAssetId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-10">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await updateClubAction({
              clubId: club.id,
              name,
              description: description.trim() || null,
              visibility,
              timezone,
              interests: interests
                .split(',')
                .map((i) => i.trim())
                .filter(Boolean)
                .slice(0, 8),
              imageAssetId,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast({ message: 'Club updated', tone: 'success' });
            router.refresh();
          });
        }}
      >
        <h2 className="text-2xl">Club settings</h2>
        <FormError>{error}</FormError>

        <div className="flex gap-4">
          <ImageUpload kind="club_image" value={imageAssetId} onChange={setImageAssetId} shape="square" />
          <div className="min-w-0 flex-1">
            <Field label="Name" htmlFor="settings-name">
              <input
                id="settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <Field label="Description" htmlFor="settings-description" optional>
          <textarea
            id="settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={600}
            className={cn(inputClass, 'resize-y')}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Visibility</legend>
          <div className="flex gap-1.5">
            {(['private', 'public'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVisibility(option)}
                aria-pressed={visibility === option}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors',
                  visibility === option
                    ? 'border-iris/50 bg-iris/12 text-iris'
                    : 'border-line text-muted hover:text-text',
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-dim">
            {visibility === 'private'
              ? 'Invite only. Hidden from search, discovery and non-members.'
              : 'Listed publicly. Anyone with the link can join.'}
          </p>
        </fieldset>

        <Field label="Timezone" htmlFor="settings-timezone">
          <input
            id="settings-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Interests" htmlFor="settings-interests" optional hint="Comma separated.">
          <input
            id="settings-interests"
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" variant="iris" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <WeeklyPickSettings
        clubId={club.id}
        timezone={club.timezone}
        initial={{
          enabled: club.weeklyPickEnabled,
          day: club.weeklyPickDay,
          hour: club.weeklyPickHour,
        }}
      />

      <section className="rounded-lg border border-rose/25 p-4">
        <h2 className="text-lg text-rose">Danger zone</h2>
        {isOwner ? (
          <>
            <p className="mt-1.5 text-sm text-muted">
              Deleting the club hides it for everyone. Screening history stays in members&apos;
              personal diaries.
            </p>
            {confirmDelete ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteClubAction(club.id);
                      if (!result.ok) {
                        toast({ message: result.error, tone: 'error' });
                        return;
                      }
                      router.push('/clubs');
                      router.refresh();
                    })
                  }
                >
                  Yes, delete this club
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmDelete(true)}>
                Delete club
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-muted">
              Leaving removes you from the queue, rounds and discussions.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveClubAction(club.id);
                  if (!result.ok) {
                    toast({ message: result.error, tone: 'error' });
                    return;
                  }
                  router.push('/clubs');
                  router.refresh();
                })
              }
            >
              Leave club
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
