import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The default config — plain unit tests only, no database. `npm run verify`
 * and CI both run this. `src/server/integration.test.ts` writes to a real
 * database and is deliberately excluded here; run it with
 * `npm run test:integration` (see vitest.integration.config.ts), which
 * requires its own TEST_DATABASE_URL and refuses to run against production.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Server modules import this Next.js guard; it is a no-op under Vitest.
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'src/server/integration.test.ts'],
  },
});
