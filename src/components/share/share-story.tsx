'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { createShareSnapshotAction } from '@/server/actions/shares';

type CreateInput =
  | { kind: 'personal_recap'; year: number }
  | { kind: 'club_yearbook'; clubId: string; year: number | null }
  | { kind: 'taste_comparison'; otherUserId: string };

export function ShareStory({ createInput, imageUrl }: { createInput: CreateInput; imageUrl: string }) {
  const toast = useToast();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function imageFile() {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('The image could not be created.');
    return new File([await response.blob()], 'nitrate-story.png', { type: 'image/png' });
  }

  return (
    <div className="mt-5 rounded-lg border border-line p-4">
      <p className="eyebrow">Keep or share this story</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Saving an image stays private. A public link is a separate, revocable snapshot and follows the source privacy rules.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              const file = await imageFile();
              const url = URL.createObjectURL(file);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = file.name;
              anchor.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              toast({ message: error instanceof Error ? error.message : 'Image failed', tone: 'error' });
            }
          })}
        >
          Save PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              const file = await imageFile();
              if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
                await navigator.share({ title: 'My Nitrate story', files: [file] });
              } else {
                toast({ message: 'Use Save PNG, then share it from your device.' });
              }
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError') return;
              toast({ message: 'Sharing is not available on this device.', tone: 'error' });
            }
          })}
        >
          Share image
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await createShareSnapshotAction(createInput);
            if (!result.ok) return toast({ message: result.error, tone: 'error' });
            setPublicUrl(`${window.location.origin}/share/${result.data.token}`);
            toast({ message: 'Revocable public link created', tone: 'success' });
          })}
        >
          Create public link
        </Button>
      </div>
      {publicUrl ? (
        <div className="mt-3 flex gap-2">
          <input value={publicUrl} readOnly aria-label="Public share link" className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs" />
          <Button size="sm" variant="outline" onClick={async () => {
            await navigator.clipboard.writeText(publicUrl);
            toast({ message: 'Link copied', tone: 'success' });
          }}>Copy</Button>
        </div>
      ) : null}
    </div>
  );
}
