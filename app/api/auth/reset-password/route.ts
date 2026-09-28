import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword, hashResetToken } from '@/lib/auth-utils';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter';
import crypto from 'crypto';

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    const ip = getClientIdentifier(request);
    const rl = RATE_LIMITS.AUTH;

    if (rateLimiter.isRateLimited(`auth:reset:${ip}`, rl.limit, rl.windowMs)) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please try again later.' },
        { status: 429 }
      );
    }
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({ 
        message: 'If an account exists with that email, a reset link has been sent.' 
      });
    }
    
    // Generate reset token. Only the SHA-256 HASH is stored; the raw token
    // goes to the user by email and never touches the database (Phase 0).
    const resetToken = generateResetToken();
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Update user with the token hash
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordTokenExpiry = resetTokenExpiry;
    await user.save();
    
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await sendPasswordResetEmail(email, resetToken, baseUrl);
    
    return NextResponse.json({ 
      message: 'If an account exists with that email, a reset link has been sent.' 
    });
  } catch (error) {
    // Structured context only — no raw error (may embed request body/token data).
    console.error('[Auth:reset-request] Failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }
    
    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Hash the submitted token and match against the stored hash — the raw
    // token is never persisted, so lookup must go through hash(token).
    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordTokenExpiry: { $gt: new Date() }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save();
    
    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    // Structured context only — no raw error (may embed submitted token data).
    console.error('[Auth:reset-confirm] Failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}