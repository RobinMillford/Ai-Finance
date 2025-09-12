// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export function rateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${ip}`;
  
  const entry = rateLimitMap.get(key);
  
  if (!entry) {
    // First request from this IP
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false; // Not rate limited
  }
  
  // Check if the window has expired
  if (now - entry.timestamp > windowMs) {
    // Reset the count as the window has expired
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false; // Not rate limited
  }
  
  // Increment the count
  const newCount = entry.count + 1;
  
  // Check if we've exceeded the limit
  if (newCount > maxRequests) {
    return true; // Rate limited
  }
  
  // Update the count
  rateLimitMap.set(key, { count: newCount, timestamp: entry.timestamp });
  return false; // Not rate limited
}

// Cleanup function to remove old entries (optional)
export function cleanupRateLimitMap(windowMs: number): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.timestamp > windowMs) {
      rateLimitMap.delete(key);
    }
  }
}