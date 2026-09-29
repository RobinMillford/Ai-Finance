import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db/repositories/users';
import { registerUser } from '@/lib/db/repositories/auth';
import { hashPassword } from '@/lib/auth-utils';
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter';

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
    
    // Get client IP for rate limiting (namespaced to avoid collision with other endpoints)
    const ip = getClientIdentifier(request);
    const rl = RATE_LIMITS.AUTH_SIGNUP;

    if (rateLimiter.isRateLimited(`auth:signup:${ip}`, rl.limit, rl.windowMs)) {
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
    
    // Check if user already exists (email is case-insensitive unique)
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password and create the user
    const passwordHash = await hashPassword(password);
    
    const user = await registerUser({
      name,
      email,
      passwordHash,
    });
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
