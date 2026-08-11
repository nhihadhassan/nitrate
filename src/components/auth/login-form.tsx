'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { loginAction } from '@/server/actions/auth';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError(null);
        setFields({});
        startTransition(async () => {
          const result = await loginAction({
            identifier: String(data.get('identifier') ?? ''),
            password: String(data.get('password') ?? ''),
          });
          if (!result.ok) {
            setError(result.error);
            setFields(result.fields ?? {});
            return;
          }
          router.push(next && next.startsWith('/') ? next : result.data.next);
          router.refresh();
        });
      }}
    >
      <FormError>{error}</FormError>

      <Field label="Email or username" htmlFor="identifier" error={fields.identifier}>
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          required
          autoFocus
          className={inputClass}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={fields.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full justify-center">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
