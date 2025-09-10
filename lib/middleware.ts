import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function requireAuth(request: Request) {
  // Apply rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (rateLimit(ip, 100, 60000)) { // 100 requests per minute
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