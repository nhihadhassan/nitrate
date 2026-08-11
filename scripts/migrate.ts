/**
 * Applies pending SQL migrations using the session-mode connection.
 *
 * Kept as a script rather than an app-boot side effect: migrations should be a
 * deliberate deploy step, not something a cold serverless invocation races on.
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
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  } catch {
    // Deployed environments provide real env vars.
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL or DATABASE_URL must be set');

  const sql = postgres(url, { max: 1, ssl: 'require', prepare: false, onnotice: () => {} });
  const db = drizzle(sql);
  console.log('Applying migrations…');
  await migrate(db, { migrationsFolder: './drizzle', migrationsSchema: 'nitrate_migrations' });
  console.log('Migrations applied.');
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
