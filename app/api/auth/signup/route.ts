import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth-utils';

// Simple rate limiting using in-memory store (in production, use Redis)
const signupAttempts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function isValidPassword(password: string): boolean {
  // Password must be at least 8 characters long and contain:
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Check rate limit
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = signupAttempts.get(ip);

  if (!attempts) {
    signupAttempts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Reset count if window has passed
  if (now - attempts.timestamp > RATE_LIMIT_WINDOW) {
    signupAttempts.set(ip, { count: 1, timestamp: now });
    return false;
  }

  // Increment count
  const newCount = attempts.count + 1;
  signupAttempts.set(ip, { count: newCount, timestamp: attempts.timestamp });

  return newCount > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();
    
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }
    
    // Validate password strength
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
        { status: 400 }
      );
    }
    
    // Connect to database
    await dbConnect();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      watchlist: [],
      trackedAssets: []
    });
    
    // Return success response (without password)
    const { password: _, ...userWithoutPassword } = user.toObject();
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}