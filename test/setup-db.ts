import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Integration tests talk to a real database, so load the same env the app
// uses — but only ever as a source for TEST_DATABASE_URL. This file is wired
// up only for `npm run test:integration`; the default `npm test` (and CI)
// never load it, so a missing or misconfigured .env.local cannot make the
// plain unit suite touch a database at all.
try {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
} catch {
  // CI provides real env vars.
}

// Integration tests are opt-in and scoped to a scratch database on purpose —
// `src/server/integration.test.ts` writes and deletes real rows. Requiring a
// separate TEST_DATABASE_URL (rather than reusing DATABASE_URL) means running
// them can never silently point at production, even by a stale .env.local.
const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (testUrl) {
  if (testUrl === process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'TEST_DATABASE_URL is identical to DATABASE_URL. Integration tests would write to that ' +
        'database directly — point TEST_DATABASE_URL at a separate scratch database instead.',
    );
  }
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_DATABASE_URL = process.env.TEST_DIRECT_DATABASE_URL?.trim() || testUrl;
}
