'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';

import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { uploadImageAction } from '@/server/actions/media';

const MAX_DIMENSION = 512;

/**
 * Downscales and re-encodes in the browser before upload, so the server only
 * ever receives a small square JPEG regardless of what came off the camera.
 */
async function prepare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process that image.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.86);
}

export function ImageUpload({
  kind,
  value,
  onChange,
  shape = 'circle',
  label = 'Upload image',
}: {
  kind: 'avatar' | 'club_image';
  value: string | null;
  onChange: (assetId: string | null) => void;
  shape?: 'circle' | 'square';
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const src = preview ?? (value ? `/media/${value}` : null);

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={cn(
          'relative flex h-20 w-20 items-center justify-center overflow-hidden border border-line bg-surface text-xs text-dim transition-colors hover:border-line-strong',
          shape === 'circle' ? 'rounded-full' : 'rounded-md',
        )}
        aria-label={label}
      >
        {src ? (
          <Image src={src} alt="" fill sizes="80px" className="object-cover" unoptimized />
        ) : pending ? (
          <span>Saving…</span>
        ) : (
          <span className="px-2 text-center leading-tight">Add photo</span>
        )}
      </button>

      {value || preview ? (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            onChange(null);
          }}
          className="mt-1.5 block w-20 text-center text-[0.6875rem] text-dim hover:text-rose"
        >
          Remove
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) {
            toast({ message: 'That image is too large (8MB max).', tone: 'error' });
            return;
          }
          try {
            const dataUrl = await prepare(file);
            setPreview(dataUrl);
            startTransition(async () => {
              const result = await uploadImageAction({ kind, dataUrl });
              if (!result.ok) {
                setPreview(null);
                toast({ message: result.error, tone: 'error' });
                return;
              }
              onChange(result.data.assetId);
            });
          } catch {
            toast({ message: 'We could not read that image.', tone: 'error' });
          }
        }}
      />
    </div>
  );
}
