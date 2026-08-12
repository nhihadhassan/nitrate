'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { signupAction } from '@/server/actions/auth';

export function SignupForm({ inviteCode, next }: { inviteCode?: string; next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [username, setUsername] = useState('');

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError(null);
        setFields({});
        startTransition(async () => {
          const result = await signupAction({
            email: String(data.get('email') ?? ''),
            username: String(data.get('username') ?? ''),
            displayName: String(data.get('displayName') ?? ''),
            password: String(data.get('password') ?? ''),
            inviteCode,
          });
          if (!result.ok) {
            setError(result.error);
            setFields(result.fields ?? {});
            return;
          }
          // A signup that started somewhere specific — the importer, a club
          // invite — should finish there rather than at the default landing.
          router.push(next && next.startsWith('/') ? next : result.data.next);
          router.refresh();
        });
      }}
    >
      <FormError>{error}</FormError>

      <Field label="Display name" htmlFor="displayName" error={fields.displayName}>
        <input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          maxLength={50}
          autoFocus
          placeholder="Ada Lovelace"
          className={inputClass}
        />
      </Field>

      <Field
        label="Username"
        htmlFor="username"
        error={fields.username}
        hint={username ? `nitrate.app/@${username}` : 'Letters, numbers and underscores.'}
      >
        <input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
          placeholder="ada"
          className={inputClass}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fields.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={fields.password}
        hint="At least 10 characters. A short phrase beats a scrambled word."
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={inputClass}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full justify-center">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
