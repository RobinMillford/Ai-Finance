import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth-utils';
import crypto from 'crypto';

// Simple rate limiting using in-memory store (in production, use Redis)
const resetAttempts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Check rate limit
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = resetAttempts.get(ip);

  if (!attempts) {
    resetAttempts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Reset count if window has passed
  if (now - attempts.timestamp > RATE_LIMIT_WINDOW) {
    resetAttempts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Increment count
  const newCount = attempts.count + 1;
  resetAttempts.set(ip, { count: newCount, timestamp: attempts.timestamp });

  return newCount > MAX_ATTEMPTS;
}

// Generate reset token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    if (isRateLimited(ip)) {
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
    
    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Update user with reset token
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiry = resetTokenExpiry;
    await user.save();
    
    // TODO: Send reset email (implement email service)
    // For now, we'll log the token to the console
    console.log(`Reset token for ${email}: ${resetToken}`);
    
    return NextResponse.json({ 
      message: 'If an account exists with that email, a reset link has been sent.' 
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
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
    
    // Find user with this reset token
    const user = await User.findOne({
      resetPasswordToken: token,
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
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}