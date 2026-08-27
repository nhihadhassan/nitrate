import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Integration tests only — `src/server/integration.test.ts` against a real
 * database. Opt-in via `npm run test:integration`. Requires TEST_DATABASE_URL
 * (see test/setup-db.ts, which also refuses to run if it equals
 * DATABASE_URL); without it the suite skips itself entirely rather than
 * running against whatever DATABASE_URL happens to be set to.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-db.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    include: ['src/server/integration.test.ts'],
  },
});
