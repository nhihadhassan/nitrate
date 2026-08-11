import { NextResponse } from 'next/server';

import { env } from '@/env';
import { destroyCurrentSession } from '@/server/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  await destroyCurrentSession();
  return NextResponse.redirect(new URL('/login', env.siteUrl), { status: 303 });
}
