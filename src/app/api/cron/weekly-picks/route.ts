import { NextResponse } from 'next/server';

import { env } from '@/env';
import { pruneExpiredSessions } from '@/server/auth/session';
import { flushEmailQueue } from '@/server/email/queue';
import { pruneRateLimits } from '@/server/rate-limit';
import { dispatchScreeningReminders, openDueWeeklyRounds } from '@/server/services/clubs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily job behind the weekly ritual on Vercel Hobby.
 *
 * `openDueWeeklyRounds` decides what is actually due by local weekday and is
 * safe to call repeatedly. The stored hour remains reserved for an hourly
 * schedule on Vercel Pro. This job also drains the outbox, the retry path
 * for anything a previous run could not deliver, and prunes expired operational
 * records so housekeeping does not depend on user traffic.
 */
export async function GET(request: Request) {
  const secret = env.cronSecret;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else if (env.isProduction) {
    // Refuse to run unauthenticated in production rather than exposing a job.
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const started = Date.now();
  try {
    const opened = await openDueWeeklyRounds();
    const reminders = await dispatchScreeningReminders();
    const mail = await flushEmailQueue(60);
    await Promise.all([pruneExpiredSessions(), pruneRateLimits()]);

    return NextResponse.json({
      ok: true,
      openedRounds: opened.length,
      clubs: opened.map((o) => o.clubName),
      reminders,
      email: mail,
      housekeeping: true,
      ms: Date.now() - started,
    });
  } catch (error) {
    console.error('[cron] weekly-picks failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
