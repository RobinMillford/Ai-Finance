/**
 * Phase 0 tests: password-reset token hashing (spec §11, §32).
 *
 * The database stores only a SHA-256 hash of the reset token; the raw token
 * travels to the user by email and is never persisted. These tests pin the
 * hashing contract the reset-password route depends on.
 */

import crypto from 'crypto';
import { hashResetToken } from '@/lib/auth-utils';

describe('hashResetToken', () => {
  it('produces a SHA-256 hex digest of the token', () => {
    const token = 'abc123';
    const expected = crypto.createHash('sha256').update(token).digest('hex');
    expect(hashResetToken(token)).toBe(expected);
  });

  it('returns a 64-character hex string', () => {
    expect(hashResetToken('some-random-token')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same token (required for DB lookup)', () => {
    const token = crypto.randomBytes(32).toString('hex');
    expect(hashResetToken(token)).toBe(hashResetToken(token));
  });

  it('produces different hashes for different tokens', () => {
    const a = hashResetToken(crypto.randomBytes(32).toString('hex'));
    const b = hashResetToken(crypto.randomBytes(32).toString('hex'));
    expect(a).not.toBe(b);
  });

  it('never returns the raw token (stored value must not be reversible/stored raw)', () => {
    const token = 'raw-token-appears-nowhere-in-output';
    const stored = hashResetToken(token);
    expect(stored).not.toContain(token);
    expect(stored).not.toBe(token);
  });

  it('matches what a route-side verification lookup would compute', () => {
    // Simulates the flow: generate raw token -> store hash; later hash the
    // submitted token and compare against the stored hash.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const storedHash = hashResetToken(rawToken);

    const submittedHash = hashResetToken(rawToken); // what PUT would compute
    expect(submittedHash).toBe(storedHash);

    const wrongTokenHash = hashResetToken(rawToken.slice(0, -1) + 'x');
    expect(wrongTokenHash).not.toBe(storedHash);
  });
});
