/**
 * Auth repository — credentials lookup + password-reset token lifecycle.
 *
 * Security invariants (Phase 0, preserved):
 *  - only the SHA-256 HASH of a reset token is stored; the raw token never
 *    touches the database
 *  - tokens expire; a consumed token (used_at set) can never be replayed
 *  - password hashes are write-only from the caller's perspective
 *
 * Consumption of a token (set used_at + update password) happens in ONE
 * database transaction so a partial failure cannot burn the token.
 */

import { and, eq, gt, isNull, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { passwordResetTokens, users } from '../schema';
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserPassword,
  toPublicUser,
  type PublicUser,
} from './users';
import type { User } from '../schema';

export { toPublicUser };
export type { PublicUser };

export async function registerUser(input: {
  name: string;
  email: string;
  /** bcrypt hash, or null for OAuth-only accounts (no local password). */
  passwordHash: string | null;
}): Promise<PublicUser> {
  const user = await createUser(input);
  return toPublicUser(user);
}

/** Credentials authorize() lookup — returns the full row (hash needed). */
export async function findCredentialsUser(email: string): Promise<User | null> {
  return getUserByEmail(email);
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
  const user = await getUserById(id);
  return user ? toPublicUser(user) : null;
}

/** Issue a reset token: store only its hash, replacing any outstanding one. */
export async function issuePasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    // One outstanding token per user keeps the mailbox authoritative.
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  });
}

/**
 * Consume a reset token: validate (hash match + unexpired + unused) and set
 * the new password atomically. Returns null when the token is invalid.
 */
export async function consumePasswordResetToken(
  tokenHash: string,
  newPasswordHash: string
): Promise<boolean> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    const token = rows[0];
    if (!token) return false;

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, token.id));
    // Password update stays inside THIS transaction: the token can never be
    // burned without the new password actually being applied.
    await tx
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, token.userId));
    return true;
  });
}

/** Most recent still-valid token for a user (used by verification tests). */
export async function getActiveResetToken(userId: string) {
  const rows = await getDb()
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
