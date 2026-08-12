'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { FormError, inputClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { joinClubAction } from '@/server/actions/clubs';

export function JoinClubForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(initialCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await joinClubAction(code);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast({
            message: result.data.alreadyMember ? 'You are already in this club' : 'Welcome to the club',
            tone: 'success',
          });
          router.push(`/club/${result.data.slug}?welcome=joined`);
          router.refresh();
        });
      }}
    >
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.trim())}
          placeholder="Invite code"
          aria-label="Invite code"
          required
          className={inputClass}
        />
        <Button type="submit" variant="iris" disabled={pending || !code.trim()} className="shrink-0">
          {pending ? 'Joining…' : 'Join'}
        </Button>
      </div>
    </form>
  );
}
