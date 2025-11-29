/**
 * Simple in-memory rate limiter for API routes
 * Suitable for small-scale applications (100-500 users)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited
   * @param identifier - Unique identifier (IP address, user ID, etc.)
   * @param limit - Maximum number of requests
   * @param windowMs - Time window in milliseconds
   * @returns true if rate limit exceeded, false otherwise
   */
  isRateLimited(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return false;
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return true;
    }

    // Increment count
    entry.count++;
    return false;
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier: string, limit: number): number {
    const entry = this.requests.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return limit;
    }
    return Math.max(0, limit - entry.count);
  }

  /**
   * Get reset time for identifier
   */
  getResetTime(identifier: string): number | null {
    const entry = this.requests.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return null;
    }
    return entry.resetTime;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export { rateLimiter };

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // General API endpoints
  API_DEFAULT: {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  
  // Stock/Forex/Crypto data endpoints
  MARKET_DATA: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // AI/LLM endpoints (more expensive)
  AI_ENDPOINTS: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // News endpoints
  NEWS: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Authentication endpoints
  AUTH: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  
  // Reddit sentiment (external API)
  REDDIT: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (works with most proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback to user agent + accept language (less reliable but better than nothing)
  const userAgent = request.headers.get("user-agent") || "unknown";
  const acceptLanguage = request.headers.get("accept-language") || "unknown";
  
  return `${userAgent}-${acceptLanguage}`;
}
