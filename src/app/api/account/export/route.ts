import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

import { requireUser } from '@/server/auth/session';
import { createAccountExport } from '@/server/services/account-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const { stream, filename } = await createAccountExport(user.id);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Sign in to export your Nitrate data.' }, { status: 401 });
  }
}
