/**
 * PostgreSQL connection layer (server-only).
 *
 * Single pg Pool + Drizzle instance, shared across the process:
 *  - the pool is memoized on globalThis so Next.js dev HMR doesn't open a
 *    new pool per code reload (same pattern the previous Mongo client used)
 *  - production containers get one pool per process with a VPS-sized budget
 *  - DATABASE_URL is the ONLY canonical database variable; it is required
 *    and never logged
 *
 * Never import this module from a client component — server-only by design.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __financeaiPool?: Pool;
};

/** VPS-sized default: bounded, reused, released by pg automatically. */
const POOL_MAX = 10;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not defined.\n' +
        'Set it in your environment (e.g. postgresql://financeai:<password>@localhost:5432/financeai).'
    );
  }

  if (!globalForDb.__financeaiPool) {
    globalForDb.__financeaiPool = new Pool({
      connectionString,
      max: POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // An idle-client error event with no listener crashes the process.
    globalForDb.__financeaiPool.on('error', (err) => {
      console.error('[db] idle client error:', err.message);
    });
  }

  return globalForDb.__financeaiPool;
}

/** Shared Drizzle handle (schema-bound for relational queries). */
export function getDb(): Database {
  return drizzle(getPool(), { schema });
}

/** Close the pool (scripts and graceful shutdown only — never per request). */
export async function closePool(): Promise<void> {
  const pool = globalForDb.__financeaiPool;
  if (pool) {
    await pool.end();
    globalForDb.__financeaiPool = undefined;
  }
}

export type { Database };
