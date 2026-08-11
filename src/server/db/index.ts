import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/env';

import * as schema from './schema';

export * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __nitrateSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __nitrateDb: PostgresJsDatabase<typeof schema> | undefined;
}

function createClient() {
  // Transaction-pooled connections cannot use prepared statements. Keeping the
  // pool tiny matters on serverless, where every instance holds its own.
  return postgres(env.databaseUrl, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: 'require',
    onnotice: () => {},
  });
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!globalThis.__nitrateDb) {
    globalThis.__nitrateSql = globalThis.__nitrateSql ?? createClient();
    globalThis.__nitrateDb = drizzle(globalThis.__nitrateSql, { schema });
  }
  return globalThis.__nitrateDb;
}

/**
 * Lazily-initialised Drizzle client. Proxied so that importing this module in a
 * build step (or in a route that never touches Postgres) does not open a socket
 * or require DATABASE_URL to be present.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Db = PostgresJsDatabase<typeof schema>;
/** A transaction handle, structurally compatible with `db` for helper reuse. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;
