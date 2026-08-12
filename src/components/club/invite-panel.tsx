'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createInviteAction } from '@/server/actions/clubs';

/**
 * Invites are the club growth loop, so this stays a one-tap affordance: the
 * standing club code is always shareable, and a fresh single-use link is one
 * click away for anywhere more public.
 *
 * The share sheet names the *club*, never the product — someone being invited
 * is being invited to a group, not to a website.
 */
export function ClubInvitePanel({
  clubId,
  clubName,
  inviteCode,
  compact,
}: {
  clubId: string;
  clubName: string;
  inviteCode: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const standingUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/join/${inviteCode}`;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ message: 'Invite link copied', tone: 'success' });
    } catch {
      toast({ message: 'Copy failed — select the link and copy it manually.', tone: 'error' });
    }
  }

  async function share(value: string) {
    if (navigator.share) {
      try {
        await navigator.share({ url: value, title: `Join ${clubName}` });
        return;
      } catch {
        /* dismissed */
      }
    }
    await copy(value);
  }

  return (
    <section className={cn(!compact && 'space-y-3')}>
      {compact ? <p className="eyebrow mb-2">Invite people</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs text-muted">
          {link ?? (standingUrl || `/join/${inviteCode}`)}
        </code>
        <Button variant="iris" size="sm" onClick={() => share(link ?? standingUrl)}>
          Share
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => copy(link ?? standingUrl)}
          className="text-muted underline underline-offset-2 hover:text-iris"
        >
          Copy link
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createInviteAction({ clubId, expiresInDays: 14 });
              if (!result.ok) {
                toast({ message: result.error, tone: 'error' });
                return;
              }
              setLink(result.data.url);
              toast({ message: 'Fresh invite link created', tone: 'success' });
            })
          }
          className="text-muted underline underline-offset-2 hover:text-iris"
        >
          {pending ? 'Creating…' : 'New expiring link'}
        </button>
        <span className="text-dim">
          Code: <span className="tabular">{inviteCode}</span>
        </span>
      </div>
    </section>
  );
}
