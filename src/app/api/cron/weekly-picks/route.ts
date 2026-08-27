import { NextResponse } from 'next/server';

import { env } from '@/env';
import { flushEmailQueue } from '@/server/email/queue';
import { dispatchScreeningReminders, openDueWeeklyRounds } from '@/server/services/clubs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Hourly job behind the weekly ritual.
 *
 * Runs hourly rather than weekly so each club's slot can land in its own
 * timezone; `openDueWeeklyRounds` decides what is actually due and is safe to
 * call repeatedly. It also drains the outbox, which doubles as the retry path
 * for anything a previous run could not deliver.
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

    return NextResponse.json({
      ok: true,
      openedRounds: opened.length,
      clubs: opened.map((o) => o.clubName),
      reminders,
      email: mail,
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
