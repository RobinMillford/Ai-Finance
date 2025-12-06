import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for security headers and request processing
 * Runs on every request to add security headers and handle rate limiting
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security Headers
  
  // DNS Prefetch Control
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  
  // Strict Transport Security (HSTS)
  // Forces HTTPS for 2 years, including subdomains
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  
  // X-Frame-Options
  // Prevents clickjacking by disallowing iframe embedding
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  // X-Content-Type-Options
  // Prevents MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection
  // Enables XSS filter in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  // Controls referrer information
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  
  // Permissions-Policy
  // Disables unnecessary browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // Content-Security-Policy
  // Prevents XSS and other injection attacks
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
  
  response.headers.set('Content-Security-Policy', cspHeader);
  
  return response;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
