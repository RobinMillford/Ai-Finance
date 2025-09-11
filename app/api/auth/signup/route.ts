import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth-utils';

// Enhanced rate limiting using in-memory store with improved cleanup
class RateLimiter {
  private attempts: Map<string, { count: number; timestamp: number }>;
  private window: number;
  private maxAttempts: number;
  private lastCleanup: number;

  constructor(window: number, maxAttempts: number) {
    this.attempts = new Map();
    this.window = window;
    this.maxAttempts = maxAttempts;
    this.lastCleanup = Date.now();
  }

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    
    // Clean up old entries periodically (every 5 minutes)
    if (now - this.lastCleanup > 5 * 60 * 1000) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    const attempt = this.attempts.get(ip);

    if (!attempt) {
      this.attempts.set(ip, { count: 1, timestamp: now });
      return false;
    }

    // Reset count if window has passed
    if (now - attempt.timestamp > this.window) {
      this.attempts.set(ip, { count: 1, timestamp: now });
      return false;
    }

    // Increment count
    const newCount = attempt.count + 1;
    this.attempts.set(ip, { count: newCount, timestamp: attempt.timestamp });

    return newCount > this.maxAttempts;
  }

  private cleanup(now: number): void {
    // Convert Map to array for iteration to avoid TypeScript issues
    const entries = Array.from(this.attempts.entries());
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.window) {
        this.attempts.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimiter(15 * 60 * 1000, 3); // 15 minutes, 3 attempts

// Enhanced email validation with domain checking
function isValidEmail(email: string): boolean {
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

// Enhanced password validation with stronger requirements
function isValidPassword(password: string): boolean {
  // Password must be at least 12 characters long and contain:
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
  
  // Additional checks for common weak passwords
  const weakPasswords = [
    'password', '12345678', 'qwertyui', 'admin123', 
    'welcome1', 'letmein1', 'password123', '123456789',
    'football', 'iloveyou', '1234567890', 'starwars'
  ];
  
  const lowerPassword = password.toLowerCase();
  const containsWeakPassword = weakPasswords.some(weak => lowerPassword.includes(weak));
  
  // Check for repetitive characters (e.g., aaaa, 1111)
  const hasRepetitiveChars = /(.)\1{3,}/.test(password);
  
  // Check for sequential characters (e.g., abcd, 1234)
  const hasSequentialChars = /(?:abcdefghijklmnopqrstuvwxyz|0123456789)/i.test(
    Array.from({length: password.length - 3}, (_, i) => password.substr(i, 4)).join('')
  );
  
  return passwordRegex.test(password) && 
         !containsWeakPassword && 
         !hasRepetitiveChars && 
         !hasSequentialChars;
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();
    
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    // Check rate limit
    if (rateLimiter.isRateLimited(ip)) {
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
    
    // Validate email format and domain
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address from a recognized provider (e.g., Gmail, Outlook, Yahoo)' },
        { status: 400 }
      );
    }
    
    // Validate password strength
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character. It cannot contain common patterns or dictionary words.' },
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