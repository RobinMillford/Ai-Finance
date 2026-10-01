import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration (PostgreSQL dialect).
 *
 * Workflow (Phase 3/22 of the migration spec):
 *   npx drizzle-kit generate   → emits committed SQL migrations
 *   npx drizzle-kit migrate    → applies them (local dev / production step)
 *
 * `drizzle-kit push` is intentionally NOT part of the workflow: production
 * schema changes must always be represented by committed migration SQL.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    // Only used by `migrate`/`studio`; `generate` never connects.
    url: process.env.DATABASE_URL ?? 'postgresql://financeai:financeai@localhost:5432/financeai',
  },
  strict: true,
  verbose: true,
});
