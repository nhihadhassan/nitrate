'use server';

import { createHash } from 'node:crypto';

import { z } from 'zod';

import { requireUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { mediaAssets } from '@/server/db/schema';
import { actionGuard, ValidationError, type ActionResult } from '@/server/errors';
import { consumeRateLimit } from '@/server/rate-limit';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const schema = z.object({
  kind: z.enum(['avatar', 'club_image', 'list_cover']),
  dataUrl: z.string().max(4_000_000),
});

/**
 * Accepts a client-downscaled data URL and stores the bytes.
 *
 * Everything is re-validated here — the mime type is taken from the payload
 * header but checked against an allowlist, and the decoded size is capped
 * regardless of what the client claims.
 */
export async function uploadImageAction(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ assetId: string }>> {
  return actionGuard(async () => {
    const user = await requireUser();
    await consumeRateLimit('upload', user.id);
    const parsed = schema.parse(input);

    const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(parsed.dataUrl);
    if (!match) throw new ValidationError('That image could not be read.');

    const [, mime, base64] = match;
    if (!ALLOWED.has(mime)) throw new ValidationError('Use a JPEG, PNG or WebP image.');

    const data = Buffer.from(base64, 'base64');
    if (data.byteLength === 0) throw new ValidationError('That image is empty.');
    if (data.byteLength > MAX_BYTES) throw new ValidationError('That image is too large.');

    const dimensions = readDimensions(data, mime);
    const checksum = createHash('sha256').update(data).digest('hex').slice(0, 32);

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerUserId: user.id,
        kind: parsed.kind,
        mime,
        width: dimensions.width,
        height: dimensions.height,
        byteSize: data.byteLength,
        checksum,
        data,
      })
      .returning({ id: mediaAssets.id });

    return { assetId: asset.id };
  });
}

/**
 * Minimal header parsing for the three formats we accept. We only need the
 * dimensions for layout hints, so an unreadable header degrades to 0 rather than
 * rejecting an otherwise valid upload.
 */
function readDimensions(data: Buffer, mime: string): { width: number; height: number } {
  try {
    if (mime === 'image/png' && data.length > 24) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset < data.length) {
        if (data[offset] !== 0xff) break;
        const marker = data[offset + 1];
        const length = data.readUInt16BE(offset + 2);
        // SOF0..SOF15, excluding the non-frame markers.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    /* fall through */
  }
  return { width: 0, height: 0 };
}
