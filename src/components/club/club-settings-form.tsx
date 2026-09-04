'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WeeklyPickSettings } from '@/components/club/weekly-pick-settings';
import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { CLUB_CADENCE_OPTIONS } from '@/lib/club-cadence';
import type { ClubCadence } from '@/lib/types';
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
    blindRatingsEnabled: boolean;
    selectionCadence: ClubCadence;
    customCadenceDays: number | null;
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
  const [blindRatings, setBlindRatings] = useState(club.blindRatingsEnabled);
  const [selectionCadence, setSelectionCadence] = useState(club.selectionCadence);
  const [customCadenceDays, setCustomCadenceDays] = useState(club.customCadenceDays ?? 30);
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
              blindRatingsEnabled: blindRatings,
              selectionCadence,
              customCadenceDays: selectionCadence === 'custom' ? customCadenceDays : null,
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
          <legend className="mb-1.5 text-sm font-medium">Movie selection frequency</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLUB_CADENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectionCadence(option.value)}
                aria-pressed={selectionCadence === option.value}
                className={cn(
                  'min-h-14 rounded-md border px-3 py-2 text-left transition-colors',
                  selectionCadence === option.value
                    ? 'border-iris/50 bg-iris/12 text-text'
                    : 'border-line text-muted hover:border-iris/30 hover:text-text',
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-dim">{option.detail}</span>
              </button>
            ))}
          </div>
          {selectionCadence === 'custom' ? (
            <div className="mt-3 max-w-xs">
              <Field label="Days between selections" htmlFor="custom-cadence-days" hint="Between 2 and 365 days.">
                <input
                  id="custom-cadence-days"
                  type="number"
                  min={2}
                  max={365}
                  required
                  value={customCadenceDays}
                  onChange={(event) => setCustomCadenceDays(Number(event.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-dim">
            Frequency gives each selection its place in the club calendar. Pick deadlines and movie-night dates remain separate.
          </p>
        </fieldset>

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

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Ratings</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2.5">
            <input
              type="checkbox"
              checked={blindRatings}
              onChange={(event) => setBlindRatings(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--iris)]"
            />
            <span className="min-w-0">
              <span className="block text-sm">Rate blind</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-dim">
                Nobody sees the group score — or anyone else&apos;s stars — for a film until they
                have submitted their own. The reveal is the fun part; anchoring is not.
              </span>
            </span>
          </label>
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

      {club.selectionCadence === 'weekly' ? (
        <WeeklyPickSettings
          clubId={club.id}
          timezone={club.timezone}
          initial={{
            enabled: club.weeklyPickEnabled,
            day: club.weeklyPickDay,
            hour: club.weeklyPickHour,
          }}
        />
      ) : null}

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
