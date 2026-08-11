import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Integration tests talk to the real database, so load the same env the app uses.
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
