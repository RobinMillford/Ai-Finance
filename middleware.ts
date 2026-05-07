import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — security headers + per-request CSP nonce.
 *
 * A fresh nonce is generated for every request and forwarded to the
 * app via the `x-nonce` request header.  The root layout reads this
 * header (via `next/headers`) and passes the nonce to ThemeProvider so
 * the blocking inline script it injects is covered by the CSP policy.
 *
 * Why nonces instead of `unsafe-inline` for scripts?
 *   `unsafe-inline` allows ANY inline script to execute, so an XSS
 *   payload injected into the page runs without restriction.  A nonce
 *   allowlists only scripts that were stamped by the server on this
 *   specific request — an attacker cannot know it in advance.
 *
 * `unsafe-eval` is removed entirely; Next.js 13+ does not need it in
 * production.  If you're running a dev server you can add it back
 * conditionally on `process.env.NODE_ENV === 'development'`.
 */
export function middleware(request: NextRequest) {
  // --- nonce -----------------------------------------------------------
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');

  // --- CSP -------------------------------------------------------------
  const isDev = process.env.NODE_ENV === 'development';

  // script-src:
  //   'self'            — same-origin scripts
  //   'nonce-...'       — inline scripts that carry this request's nonce
  //   'strict-dynamic'  — scripts loaded by a nonced script may load others
  //   unsafe-eval       — only in dev (Next.js HMR / fast-refresh needs it)
  //   https://vercel.live — Vercel preview toolbar
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://vercel.live",
  ].join(' ');

  const cspHeader = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,   // unsafe-inline is acceptable for styles
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  // --- Build response --------------------------------------------------
  // Forward nonce to the app so layouts can read it from request headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (no CSP header needed on JSON responses)
     * - _next/static (static assets)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
