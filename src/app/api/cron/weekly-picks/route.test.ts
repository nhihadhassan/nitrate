import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openDueWeeklyRounds: vi.fn(),
  dispatchScreeningReminders: vi.fn(),
  flushEmailQueue: vi.fn(),
  pruneExpiredSessions: vi.fn(),
  pruneRateLimits: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/env', () => ({
  env: { cronSecret: 'test-secret', isProduction: true },
}));
vi.mock('@/server/auth/session', () => ({
  pruneExpiredSessions: mocks.pruneExpiredSessions,
}));
vi.mock('@/server/email/queue', () => ({
  flushEmailQueue: mocks.flushEmailQueue,
}));
vi.mock('@/server/rate-limit', () => ({
  pruneRateLimits: mocks.pruneRateLimits,
}));
vi.mock('@/server/services/clubs', () => ({
  openDueWeeklyRounds: mocks.openDueWeeklyRounds,
  dispatchScreeningReminders: mocks.dispatchScreeningReminders,
}));

import { GET } from './route';

describe('weekly picks cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openDueWeeklyRounds.mockResolvedValue([{ clubName: 'Velvet Frame' }]);
    mocks.dispatchScreeningReminders.mockResolvedValue({ sent: 2 });
    mocks.flushEmailQueue.mockResolvedValue({ sent: 3 });
    mocks.pruneExpiredSessions.mockResolvedValue(undefined);
    mocks.pruneRateLimits.mockResolvedValue(undefined);
  });

  it('rejects requests without the configured secret', async () => {
    const response = await GET(new Request('https://nitrate.test/api/cron/weekly-picks'));

    expect(response.status).toBe(401);
    expect(mocks.openDueWeeklyRounds).not.toHaveBeenCalled();
    expect(mocks.pruneExpiredSessions).not.toHaveBeenCalled();
  });

  it('runs the weekly ritual and both housekeeping jobs', async () => {
    const response = await GET(
      new Request('https://nitrate.test/api/cron/weekly-picks', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      openedRounds: 1,
      clubs: ['Velvet Frame'],
      reminders: { sent: 2 },
      email: { sent: 3 },
      housekeeping: true,
    });
    expect(mocks.flushEmailQueue).toHaveBeenCalledWith(60);
    expect(mocks.pruneExpiredSessions).toHaveBeenCalledOnce();
    expect(mocks.pruneRateLimits).toHaveBeenCalledOnce();
  });
});
