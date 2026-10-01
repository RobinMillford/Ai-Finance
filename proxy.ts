import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Next.js 16 proxy (formerly root middleware.ts — the only executed edge layer).
 *
 * Single coherent security-header + auth strategy:
 *  1. nonce + CSP + security headers on every matched request
 *  2. page protection (merged from the dead `app/middleware.ts`, which used
 *     next-auth `withAuth` but was located at `app/middleware.ts` and never
 *     executed). Protection is a manual `getToken` JWT check — the same
 *     mechanism `withAuth` uses — so it works in the proxy layer without the
 *     next-auth middleware convention.
 *
 * API routes are NOT protected here (the matcher excludes `/api`); they
 * enforce their own auth/rate-limit policy per route (see lib/api-helpers.ts,
 * lib/ai/advisor-route.ts).
 */

/**
 * Pages reachable without a session:
 *  - the market-listing pages from the original (dead) middleware matcher
 *  - `/` landing page, `/privacy` legal page, `/contact` form (e2e specs load
 *    `/` anonymously and these are not user-data surfaces)
 * Everything else (advisor pages, dashboards, portfolio, watchlist, asset
 * detail pages) requires a session, matching the dead middleware's intent.
 */
const PUBLIC_PAGES = new Set([
  '/',
  '/choose-market',
  '/news',
  '/stocks',
  '/forexs',
  '/cryptos',
  '/privacy',
  '/contact',
]);

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  // Auth pages (signin/signout/error) must always be reachable.
  return pathname.startsWith('/auth');
}

export async function proxy(request: NextRequest) {
  // --- Page protection (before anything else so redirects skip header work) -
  const { pathname } = request.nextUrl;
  if (!isPublicPage(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // --- nonce -----------------------------------------------------------
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');

  // --- CSP -------------------------------------------------------------
  const isDev = process.env.NODE_ENV === 'development';

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
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  // --- Build response --------------------------------------------------
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
