/**
 * Applies every migration to an explicitly isolated test database.
 *
 * This command deliberately does not fall back to DATABASE_URL. It also
 * compares normalized connection identities without ever logging a URL, so a
 * copied production connection string fails closed and credentials stay out of
 * terminal output and CI logs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

function loadEnvLocal() {
  try {
    const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // CI and local shells may provide variables directly.
  }
}

function identity(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const database = url.pathname.replace(/^\//, '').toLowerCase();
    return `${url.hostname.toLowerCase()}:${url.port || '5432'}/${database}`;
  } catch {
    throw new Error('A database URL is malformed. No connection was attempted.');
  }
}

async function main() {
  loadEnvLocal();
  const testUrl = process.env.TEST_DIRECT_DATABASE_URL?.trim() || process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is required. Point it at an isolated disposable database.');
  }

  const testIdentity = identity(testUrl);
  const forbidden = [
    process.env.DATABASE_URL,
    process.env.DIRECT_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
  ]
    .map(identity)
    .filter(Boolean);

  if (forbidden.includes(testIdentity)) {
    throw new Error(
      'The test database matches a normal application database. Migration refused before connecting.',
    );
  }

  const sql = postgres(testUrl, { max: 1, ssl: 'require', prepare: false, onnotice: () => {} });
  try {
    const database = drizzle(sql);
    console.log('Applying migrations to the isolated test database...');
    await migrate(database, {
      migrationsFolder: './drizzle',
      migrationsSchema: 'nitrate_test_migrations',
    });
    console.log('Test database migrations applied.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Test migration failed.');
  process.exit(1);
});
