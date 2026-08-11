import 'server-only';

import { env } from '@/env';
import { ProviderError } from '@/server/errors';

import { OfflineProvider } from './offline';
import { createTmdbProvider } from './tmdb';
import type { MovieProvider } from './types';

export * from './types';

const offline = new OfflineProvider();

/**
 * Trips after a run of provider failures so a TMDB outage costs one slow request
 * rather than one per page view. Resets itself after a cool-off.
 */
const breaker = {
  failures: 0,
  openedAt: 0,
  threshold: 4,
  cooldownMs: 60_000,
  get isOpen() {
    if (!this.openedAt) return false;
    if (Date.now() - this.openedAt > this.cooldownMs) {
      this.openedAt = 0;
      this.failures = 0;
      return false;
    }
    return true;
  },
  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = Date.now();
  },
  recordSuccess() {
    this.failures = 0;
    this.openedAt = 0;
  },
};

export function primaryProvider(): MovieProvider {
  if (env.movieProvider === 'offline') return offline;
  return createTmdbProvider() ?? offline;
}

export function fallbackProvider(): MovieProvider {
  return offline;
}

export function providerIsConfigured(): boolean {
  return env.movieProvider === 'tmdb' && Boolean(env.tmdbApiKey);
}

export type ProviderCallResult<T> = { data: T; degraded: boolean };

/**
 * Runs a provider call, transparently falling back to the local catalogue when
 * the upstream is unavailable. `degraded` lets the UI say so honestly instead of
 * pretending the empty-ish result is the whole truth.
 */
export async function withProvider<T>(
  call: (provider: MovieProvider) => Promise<T>,
): Promise<ProviderCallResult<T>> {
  const primary = primaryProvider();
  if (primary.id === 'offline') {
    return { data: await call(offline), degraded: !providerIsConfigured() };
  }
  if (breaker.isOpen) {
    return { data: await call(offline), degraded: true };
  }
  try {
    const data = await call(primary);
    breaker.recordSuccess();
    return { data, degraded: false };
  } catch (error) {
    if (error instanceof ProviderError) {
      breaker.recordFailure();
      console.warn('[movies] provider unavailable, serving local catalogue:', error.message);
      return { data: await call(offline), degraded: true };
    }
    throw error;
  }
}
