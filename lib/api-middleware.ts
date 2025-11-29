import { NextResponse } from "next/server";
import { rateLimiter, getClientIdentifier, RATE_LIMITS } from "./rate-limiter";

/**
 * Rate limit configuration type
 */
type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

/**
 * Apply rate limiting to an API route handler
 * @param handler - The API route handler function
 * @param config - Rate limit configuration
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  config: RateLimitConfig = RATE_LIMITS.API_DEFAULT
) {
  return async (request: Request): Promise<Response> => {
    const identifier = getClientIdentifier(request);
    
    if (rateLimiter.isRateLimited(identifier, config.limit, config.windowMs)) {
      const resetTime = rateLimiter.getResetTime(identifier);
      const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60;
      
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(resetTime),
          },
        }
      );
    }

    const remaining = rateLimiter.getRemaining(identifier, config.limit);
    const response = await handler(request);
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(config.limit));
    headers.set("X-RateLimit-Remaining", String(remaining - 1));
    
    const resetTime = rateLimiter.getResetTime(identifier);
    if (resetTime) {
      headers.set("X-RateLimit-Reset", String(resetTime));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(vars: string[]): { valid: boolean; missing: string[] } {
  const missing = vars.filter(varName => !process.env[varName]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Parse and validate request body
 */
export async function parseRequestBody<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return body as T;
  } catch (error) {
    return null;
  }
}
