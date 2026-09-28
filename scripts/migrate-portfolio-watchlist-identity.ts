/**
 * Identity Migration Prep (Phase 0 — DO NOT RUN AUTOMATICALLY)
 *
 * PROBLEM (audit finding, spec §9):
 *   `models/Portfolio.ts` and `models/Watchlist.ts` both declare a `userId`
 *   string field, but `app/api/portfolio/route.ts` and
 *   `app/api/watchlist/route.ts` write the user's EMAIL into it. All other
 *   resources (User, notifications, tracked assets) key on the stable Mongo
 *   user id (`session.user.id`).
 *
 * WHY NOT MIGRATED IN PHASE 0:
 *   Switching the routes to `session.user.id` immediately would orphan every
 *   existing portfolio/watchlist row (their `userId` holds an email). A safe
 *   backfill + cutover needs a maintenance window and production data access,
 *   which Phase 0 deliberately avoids (no risky destructive migration).
 *
 * MIGRATION PLAN (run this script manually, once, in a maintenance window):
 *   1. Back up the `portfolios` and `watchlists` collections.
 *   2. Run:  npx tsx scripts/migrate-portfolio-watchlist-identity.ts
 *      It resolves each distinct email in `userId` against the users
 *      collection and rewrites `userId` to the user's `_id` string.
 *      Rows whose email has no matching user are reported, not touched.
 *   3. Verify the script's report: zero unresolved rows, counts unchanged.
 *   4. THEN change the routes to `session.user.id` (small follow-up commit):
 *        - `session.user.email` -> `session.user.id` in both route files
 *      (Before step 4 the routes keep working because ids were written by
 *      this script for all existing rows and new rows still get emails.)
 *   5. Optionally re-run the script after step 4 to convert the few rows
 *      created between steps 2 and 4.
 *
 * COMPATIBILITY PATH until then: new code continues using the existing
 * email-keyed convention for these two collections only. All NEW resources
 * must key on the stable user id (this is already the case for user routes).
 *
 * Usage:
 *   MONGODB_URI=... npx tsx scripts/migrate-portfolio-watchlist-identity.ts
 *
 * The script is idempotent: it skips rows whose `userId` already looks like a
 * Mongo ObjectId (24 hex chars), so running it twice is safe.
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required. Usage: MONGODB_URI=... npx tsx scripts/migrate-portfolio-watchlist-identity.ts');
  process.exit(1);
}

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

async function migrateCollection(db: mongoose.Connection, name: string): Promise<void> {
  const collection = db.collection(name);
  const distinctValues = await collection.distinct('userId');
  const emails = (distinctValues as string[]).filter(
    (v) => typeof v === 'string' && v.includes('@') && !OBJECT_ID_RE.test(v)
  );

  console.log(`\n[${name}] ${emails.length} email-keyed userId value(s) found.`);

  const users = db.collection('users');
  let migrated = 0;
  let unresolved = 0;

  for (const email of emails) {
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) {
      unresolved++;
      console.warn(`[${name}] No user found for email ${email} — row(s) left untouched.`);
      continue;
    }
    const result = await collection.updateMany(
      { userId: email },
      { $set: { userId: user._id.toString() } }
    );
    migrated += result.modifiedCount ?? 0;
  }

  console.log(`[${name}] migrated documents: ${migrated}, unresolved emails: ${unresolved}`);
  if (unresolved > 0) {
    console.warn(
      `[${name}] Unresolved rows remain — investigate before cutting the routes over to user ids.`
    );
  }
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection;

  console.log('Identity migration: rewriting email-keyed userId values to Mongo user ids.');
  console.log('This script is idempotent (already-migrated rows are skipped).');

  await migrateCollection(db, 'portfolios');
  await migrateCollection(db, 'watchlists');

  await mongoose.disconnect();
  console.log('\nDone. Follow the cutover steps in the script header comment.');
}

main().catch(async (err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
