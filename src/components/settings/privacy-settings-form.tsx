'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { VISIBILITY_HINTS, VISIBILITY_LABELS, type Visibility } from '@/lib/types';
import { cn } from '@/lib/utils';
import { updatePrivacyAction } from '@/server/actions/profile';

type Settings = {
  profileVisibility: Visibility;
  defaultEntryVisibility: Visibility;
  showWatchlistPublicly: boolean;
  allowFollows: boolean;
  adultContent: boolean;
};

export function PrivacySettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-xl space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updatePrivacyAction(value);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast({ message: 'Privacy settings saved', tone: 'success' });
          router.refresh();
        });
      }}
    >
      <div>
        <h2 className="text-2xl">Privacy</h2>
        <p className="mt-1.5 text-sm text-muted">
          Every one of these is enforced on the server. Private content never appears in feeds,
          search or on public pages, no matter how it is requested.
        </p>
      </div>

      <FormError>{error}</FormError>

      <VisibilityChoice
        label="Who can see your profile"
        value={value.profileVisibility}
        onChange={(next) => setValue((v) => ({ ...v, profileVisibility: next }))}
      />

      <VisibilityChoice
        label="Default visibility for new diary entries"
        value={value.defaultEntryVisibility}
        onChange={(next) => setValue((v) => ({ ...v, defaultEntryVisibility: next }))}
        hint="You can still change this per entry when you log."
      />

      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium">Other</legend>
        <Toggle
          label="Show my watchlist on my profile"
          checked={value.showWatchlistPublicly}
          onChange={(checked) => setValue((v) => ({ ...v, showWatchlistPublicly: checked }))}
        />
        <Toggle
          label="Let people follow me"
          hint="Turning this off stops new followers. Existing ones stay."
          checked={value.allowFollows}
          onChange={(checked) => setValue((v) => ({ ...v, allowFollows: checked }))}
        />
        <Toggle
          label="Include adult titles in search and discovery"
          checked={value.adultContent}
          onChange={(checked) => setValue((v) => ({ ...v, adultContent: checked }))}
        />
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save privacy settings'}
        </Button>
      </div>
    </form>
  );
}

function VisibilityChoice({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              'rounded-md border px-3 py-2 text-left transition-colors',
              value === option ? 'border-ember/40 bg-ember/10' : 'border-line hover:border-line-strong',
            )}
          >
            <span className="block text-sm font-medium">{VISIBILITY_LABELS[option]}</span>
            <span className="mt-0.5 block text-[0.6875rem] leading-snug text-dim">
              {VISIBILITY_HINTS[option]}
            </span>
          </button>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-dim">{hint}</p> : null}
    </fieldset>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--ember)]"
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-dim">{hint}</span> : null}
      </span>
    </label>
  );
}
