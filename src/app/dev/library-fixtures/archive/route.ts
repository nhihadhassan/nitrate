import { PassThrough, Readable } from 'node:stream';
import archiver from 'archiver';
import { NextResponse } from 'next/server';

import { NITRATE_EXPORT_VERSION, type ExportManifestV1 } from '@/lib/export';
import { syntheticLibraryState } from '@/test-fixtures/library';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (process.env.ALLOW_SYNTHETIC_FIXTURES !== 'true') return new NextResponse(null, { status: 404 });
  const fixture = syntheticLibraryState(new URL(request.url).searchParams.get('state') ?? 'normal');
  if (fixture.failed) return NextResponse.json({ error: 'Synthetic export failure' }, { status: 503 });
  const output = new PassThrough();
  const zip = archiver('zip');
  zip.pipe(output);
  const manifest: ExportManifestV1 = { schemaVersion: NITRATE_EXPORT_VERSION, product: 'Nitrate', generatedAt: new Date(0).toISOString(), userId: 'synthetic-user', username: 'synthetic', files: [{ path: 'nitrate.json', format: 'json', records: fixture.counts.diary, description: 'Synthetic verification payload.' }], privacy: { otherPeoplePrivateDataIncluded: false, clubDiscussionsIncluded: false }, batching: { strategy: 'cursor', batchSize: 250 } };
  zip.append(JSON.stringify({ fixture, schemaVersion: NITRATE_EXPORT_VERSION }, null, 2), { name: 'nitrate.json' });
  zip.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  void zip.finalize();
  return new Response(Readable.toWeb(output) as ReadableStream, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="nitrate-synthetic.zip"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
