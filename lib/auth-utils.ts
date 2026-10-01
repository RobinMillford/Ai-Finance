import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Hash a password-reset token for storage (Phase 0).
 *
 * The database stores only this SHA-256 hash; the raw token is delivered to
 * the user by email and never persisted. SHA-256 is appropriate here because
 * the token is 256 bits of CSPRNG output — high entropy, so key-stretching
 * (bcrypt) adds no practical protection the entropy doesn't already provide.
 *
 * Uses node:crypto directly (crypto.createHash) which is available in the
 * Node.js runtime used by auth routes.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Function to validate email domains
export function isValidEmailDomain(email: string): boolean {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Check for valid domains (common email providers)
  const validDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 
    'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
    'zoho.com', 'yandex.com', 'qq.com', '163.com', '126.com',
    'gmx.com', 'live.com', 'msn.com', 'ymail.com'
  ];
  
  const domain = email.split('@')[1].toLowerCase();
  return validDomains.includes(domain);
}