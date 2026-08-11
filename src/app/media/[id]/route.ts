import { eq } from 'drizzle-orm';

import { db } from '@/server/db';
import { mediaAssets } from '@/server/db/schema';

export const runtime = 'nodejs';

/**
 * Serves uploaded avatars and club images straight from Postgres.
 *
 * Deliberate MVP trade-off: these are small, already downscaled client-side, and
 * keeping them in the database means zero object-storage configuration to get a
 * working product. Content is immutable per id, so it caches forever at the edge
 * and only ever costs one query on a cold path.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Not found', { status: 404 });
  }

  const [asset] = await db
    .select({ mime: mediaAssets.mime, data: mediaAssets.data, checksum: mediaAssets.checksum })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);

  if (!asset) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      'content-type': asset.mime,
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${asset.checksum}"`,
    },
  });
}
