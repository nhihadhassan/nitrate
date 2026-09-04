'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { CLUB_CADENCE_OPTIONS } from '@/lib/club-cadence';
import type { ClubCadence } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createClubAction } from '@/server/actions/clubs';

const INTERESTS = [
  'Horror',
  'Sci-fi',
  'Documentary',
  'Animation',
  'Comedy',
  'Thriller',
  'World cinema',
  'Classics',
  'A24',
  'Criterion',
  'Blockbusters',
  'Cult',
];

export function CreateClubForm({ defaultTimezone }: { defaultTimezone: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [selectionCadence, setSelectionCadence] = useState<ClubCadence>('monthly');
  const [customCadenceDays, setCustomCadenceDays] = useState(30);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [interests, setInterests] = useState<string[]>([]);
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Default to the browser's zone; screening times are shown in the club's zone.
  useEffect(() => {
    if (defaultTimezone && defaultTimezone !== 'UTC') return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    } catch {
      /* keep the default */
    }
  }, [defaultTimezone]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createClubAction({
            name,
            description: description.trim() || null,
            visibility,
            timezone,
            interests,
            imageAssetId,
            selectionCadence,
            customCadenceDays: selectionCadence === 'custom' ? customCadenceDays : null,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/club/${result.data.slug}?welcome=1`);
          router.refresh();
        });
      }}
    >
      <FormError>{error}</FormError>

      <div className="flex gap-4">
        <ImageUpload kind="club_image" value={imageAssetId} onChange={setImageAssetId} shape="square" />
        <div className="min-w-0 flex-1 space-y-4">
          <Field label="Club name" htmlFor="club-name">
            <input
              id="club-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              autoFocus
              placeholder="Thursday Horror Club"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field label="What is this club about?" htmlFor="club-description" optional>
        <textarea
          id="club-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Four of us, one horror film a month, strong opinions."
          className={cn(inputClass, 'resize-y')}
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">How often will you choose a movie?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CLUB_CADENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selectionCadence === option.value}
              onClick={() => setSelectionCadence(option.value)}
              className={cn(
                'min-h-14 rounded-md border px-3 py-2 text-left transition-colors',
                selectionCadence === option.value
                  ? 'border-iris/50 bg-iris/[0.08]'
                  : 'border-line hover:border-line-strong',
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-dim">{option.detail}</span>
            </button>
          ))}
        </div>
        {selectionCadence === 'custom' ? (
          <div className="mt-3 max-w-xs">
            <Field label="Days between selections" htmlFor="new-club-custom-cadence" hint="Between 2 and 365 days.">
              <input
                id="new-club-custom-cadence"
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
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Who can find it</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <VisibilityCard
            active={visibility === 'private'}
            title="Private"
            body="Invite only. Invisible in search and discovery."
            onClick={() => setVisibility('private')}
          />
          <VisibilityCard
            active={visibility === 'public'}
            title="Public"
            body="Listed on the Clubs page. Anyone with the link can join."
            onClick={() => setVisibility('public')}
          />
        </div>
      </fieldset>

      <Field
        label="Timezone"
        htmlFor="club-timezone"
        hint="Screening times are shown to everyone in this zone."
      >
        <input
          id="club-timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          Interests <span className="font-normal text-dim">Optional</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setInterests((current) =>
                    active
                      ? current.filter((i) => i !== interest)
                      : current.length < 8
                        ? [...current, interest]
                        : current,
                  )
                }
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  active
                    ? 'border-iris/50 bg-iris/12 text-iris'
                    : 'border-line text-muted hover:text-text',
                )}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" variant="iris" size="lg" disabled={pending || name.trim().length < 2}>
          {pending ? 'Creating…' : 'Create club'}
        </Button>
      </div>
    </form>
  );
}

function VisibilityCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-3 py-2.5 text-left transition-colors',
        active ? 'border-iris/50 bg-iris/[0.08]' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-dim">{body}</span>
    </button>
  );
}
