/**
 * User repository — PostgreSQL/Drizzle implementation.
 *
 * Replaces all direct User model access (findOne/create/save/findById...).
 * Password hashes and reset-token hashes are never selected into client
 * payloads; repositories return typed rows and callers project explicitly.
 */

import { eq, sql } from 'drizzle-orm';
import { getDb } from '../client';
import {
  users,
  userWatchlistSymbols,
  userTrackedAssets,
  type User,
  type NotificationPreferences,
} from '../schema';

/** User shape safe to return to clients (never includes hashes). */
export type PublicUser = Omit<User, 'passwordHash' | 'emailVerificationToken'>;

export function toPublicUser(row: User): PublicUser {
  const { passwordHash: _ph, emailVerificationToken: _evt, ...rest } = row;
  return rest;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
}): Promise<User> {
  const rows = await getDb()
    .insert(users)
    .values({
      name: input.name,
      // Normalized to lowercase so the exact-match unique index enforces
      // case-insensitive uniqueness (lookups compare lower() = lower()).
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash ?? null,
      image: input.image ?? null,
    })
    .returning();
  return rows[0];
}

/** OAuth sign-in refresh: keep the latest avatar without clobbering anything. */
export async function updateUserImage(id: string, image: string | null): Promise<void> {
  await getDb().update(users).set({ image, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function updateUserProfile(
  id: string,
  patch: { name?: string; isPublic?: boolean }
): Promise<User | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.isPublic !== undefined) set.isPublic = patch.isPublic;
  const rows = await getDb().update(users).set(set).where(eq(users.id, id)).returning();
  return rows[0] ?? null;
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await getDb().update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
}

/** Whole-document preference replace (the API contract, not a merge). */
export async function updateUserNotificationPreferences(
  id: string,
  prefs: NotificationPreferences
): Promise<User | null> {
  const rows = await getDb()
    .update(users)
    .set({ notificationPreferences: prefs, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0] ?? null;
}

// ── flat watchlist symbols (legacy /api/user/watchlist contract) ─────────────

export async function getUserWatchlistSymbols(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ symbol: userWatchlistSymbols.symbol })
    .from(userWatchlistSymbols)
    .where(eq(userWatchlistSymbols.userId, userId))
    .orderBy(userWatchlistSymbols.addedAt);
  return rows.map((r) => r.symbol);
}

/** $addToSet semantics: idempotent insert, ordering preserved by added_at. */
export async function addUserWatchlistSymbol(userId: string, symbol: string): Promise<void> {
  await getDb()
    .insert(userWatchlistSymbols)
    .values({ userId, symbol: symbol.toUpperCase() })
    .onConflictDoNothing();
}

export async function removeUserWatchlistSymbol(userId: string, symbol: string): Promise<void> {
  await getDb()
    .delete(userWatchlistSymbols)
    .where(
      sql`${userWatchlistSymbols.userId} = ${userId} AND ${userWatchlistSymbols.symbol} = ${symbol.toUpperCase()}`
    );
}

// ── tracked assets (richer per-user tracking list) ───────────────────────────

export async function getUserTrackedAssets(userId: string) {
  return getDb()
    .select()
    .from(userTrackedAssets)
    .where(eq(userTrackedAssets.userId, userId))
    .orderBy(userTrackedAssets.addedAt);
}

export async function addUserTrackedAsset(
  userId: string,
  input: { type: 'stock' | 'crypto' | 'forex'; symbol: string }
): Promise<void> {
  await getDb()
    .insert(userTrackedAssets)
    .values({ userId, symbol: input.symbol.toUpperCase(), assetType: input.type })
    .onConflictDoNothing();
}

export async function removeUserTrackedAsset(userId: string, symbol: string): Promise<void> {
  await getDb()
    .delete(userTrackedAssets)
    .where(
      sql`${userTrackedAssets.userId} = ${userId} AND ${userTrackedAssets.symbol} = ${symbol.toUpperCase()}`
    );
}
