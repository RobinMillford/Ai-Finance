/**
 * Shared API route helpers (Phase 0).
 *
 * Common cross-cutting concerns for data routes:
 *  - session requirement
 *  - provider error → honest HTTP mapping (no silent 200-with-empty-payload)
 *  - symbol validation
 *
 * These complement (not replace) lib/api-middleware.ts `withRateLimit`.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProviderError } from '@/lib/market-data/twelvedata';
import { NextResponse } from 'next/server';

export type SessionUser = { id?: string; email?: string };

/** Require a session; returns the user or a 401 response. */
export async function requireSession(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user || (!user.id && !user.email)) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}

/** Map a thrown error from provider code to an honest HTTP response. */
export function providerErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof ProviderError) {
    const status = error.kind === 'bad_symbol' || error.kind === 'not_found' ? 404 : error.status;
    // Message is provider-derived but non-sensitive (no keys); still, keep it generic.
    return NextResponse.json(
      {
        error: status === 404 ? 'Symbol not found or unsupported' : fallbackMessage,
        kind: error.kind,
      },
      { status }
    );
  }
  if ((error as any)?.kind === 'bad_symbol') {
    return NextResponse.json({ error: 'Symbol not found or unsupported', kind: 'bad_symbol' }, { status: 404 });
  }
  console.error('[api] Unhandled provider error:', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/**
 * Validate a `symbol` query parameter.
 * Alphanumeric plus the separators real tickers need (dots: BRK.B; slashes:
 * BTC/USD; dashes: EUR-USD). Traversal-looking sequences (.., //, leading or
 * trailing separators) are rejected as defense-in-depth even though symbols
 * are only ever sent to the provider as a query parameter, never a path.
 */
export function validateSymbol(symbol: string | null): string | null {
  if (!symbol) return null;
  const trimmed = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9./-]{1,20}$/.test(trimmed)) return null;
  if (trimmed.includes('..') || trimmed.includes('//')) return null;
  if (/^[./-]|[./-]$/.test(trimmed)) return null;
  return trimmed;
}
