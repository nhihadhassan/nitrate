'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { updateEmailPreferencesAction } from '@/server/actions/profile';

type Preferences = {
  emailMovieNightReminders: boolean;
  emailPicksAndVoting: boolean;
  emailWinnerSelected: boolean;
};

export function NotificationSettingsForm({ preferences }: { preferences: Preferences }) {
  const toast = useToast();
  const [value, setValue] = useState(preferences);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-xl space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateEmailPreferencesAction(value);
          if (!result.ok) return setError(result.error);
          toast({ message: 'Email preferences saved', tone: 'success' });
        });
      }}
    >
      <header>
        <h2 className="text-2xl">Email</h2>
        <p className="mt-1.5 text-sm text-muted">
          In-app club notifications still appear unless you mute that club. These choices only control email.
        </p>
      </header>
      <FormError>{error}</FormError>
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Email preferences</legend>
        <Preference
          label="Movie night reminders"
          hint="One reminder when a scheduled screening is less than 24 hours away."
          checked={value.emailMovieNightReminders}
          onChange={(checked) => setValue((current) => ({ ...current, emailMovieNightReminders: checked }))}
        />
        <Preference
          label="Picks and voting"
          hint="When a club opens picks or needs your vote."
          checked={value.emailPicksAndVoting}
          onChange={(checked) => setValue((current) => ({ ...current, emailPicksAndVoting: checked }))}
        />
        <Preference
          label="Winning film"
          hint="When your club settles on what to watch."
          checked={value.emailWinnerSelected}
          onChange={(checked) => setValue((current) => ({ ...current, emailWinnerSelected: checked }))}
        />
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save email preferences'}
        </Button>
      </div>
    </form>
  );
}

function Preference({ label, hint, checked, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 accent-[var(--ember)]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-dim">{hint}</span>
      </span>
    </label>
  );
}
