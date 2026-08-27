'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { InstallNitrate } from '@/components/pwa/install-nitrate';
import { Field, FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateOnly } from '@/lib/utils';
import { deleteAccountAction, signOutEverywhereAction } from '@/server/actions/auth';

export function AccountSettings({
  email,
  username,
  createdAt,
}: {
  email: string;
  username: string;
  createdAt: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-xl space-y-10">
      <section>
        <h2 className="text-2xl">Account</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-dim">Email</dt>
            <dd>{email}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-dim">Username</dt>
            <dd>@{username}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-dim">Member since</dt>
            <dd>{formatDateOnly(createdAt.slice(0, 10))}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-xl">Install Nitrate</h2>
        <p className="mt-1.5 text-sm text-muted">
          Add Nitrate to your home screen for a full-screen app experience. Personal data still requires a connection.
        </p>
        <InstallNitrate />
      </section>

      <section>
        <h2 className="text-xl">Sessions</h2>
        <p className="mt-1.5 text-sm text-muted">
          Signs you out on every device, including this one.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await signOutEverywhereAction();
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              router.push('/login');
              router.refresh();
            })
          }
        >
          Sign out everywhere
        </Button>
      </section>

      <section>
        <h2 className="text-xl">Your data</h2>
        <p className="mt-1.5 text-sm text-muted">
          Everything you log is yours. Read how we handle it in the{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ember">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <section className="rounded-lg border border-rose/25 p-4">
        <h2 className="text-xl text-rose">Delete account</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          This removes your profile, name, photo and bio, and signs you out everywhere. Diary
          entries, reviews and club messages are detached from you rather than erased, so shared
          club history and moderation records stay intact. This cannot be undone.
        </p>

        {showDelete ? (
          <div className="mt-4 space-y-3">
            <FormError>{error}</FormError>
            <Field label={`Type "${username}" to confirm`} htmlFor="delete-confirmation">
              <input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </Field>
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={pending || confirmation.toLowerCase() !== username.toLowerCase()}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteAccountAction(confirmation);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    router.push('/');
                    router.refresh();
                  })
                }
              >
                Permanently delete my account
              </Button>
              <Button variant="ghost" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setShowDelete(true)}>
            Delete my account
          </Button>
        )}
      </section>
    </div>
  );
}
