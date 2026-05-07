import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter';

export async function requireAuth(request: Request) {
  const ip = getClientIdentifier(request);
  const { limit, windowMs } = RATE_LIMITS.API_DEFAULT;
  if (rateLimiter.isRateLimited(ip, limit, windowMs)) {
    return {
      error: 'Too many requests. Please try again later.',
      status: 429
    };
  }
  
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return {
      error: 'Unauthorized',
      status: 401
    };
  }
  
  return {
    session,
    error: null,
    status: 200
  };
}