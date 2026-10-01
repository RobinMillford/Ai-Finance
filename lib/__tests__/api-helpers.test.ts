/**
 * Phase 0 tests: shared API helpers (spec §24, §32).
 *
 * Provider failures must map to honest HTTP codes (never a silent 200 with
 * an empty payload), and user input must be validated server-side.
 */

// Mocks must be applied before importing the module under test —
// api-helpers transitively imports next-auth and next/server, neither of
// which initializes cleanly under jsdom.
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn((opts) => opts),
  getServerSession: jest.fn(async () => null),
}));
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('next/server', () => ({
  NextResponse: {
    // jsdom has no fetch Response — return a minimal structural stand-in.
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { ProviderError } from '@/lib/market-data/twelvedata';
import {
  providerErrorResponse,
  validateSymbol,
} from '@/lib/api-helpers';

function statusOf(res: { status: number }): number {
  return res.status;
}

async function bodyOf(res: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('providerErrorResponse', () => {
  it('maps bad_symbol / not_found to 404 with a generic message', async () => {
    for (const kind of ['bad_symbol', 'not_found'] as const) {
      const res = providerErrorResponse(new ProviderError('x', kind, 404), 'fallback');
      expect(statusOf(res)).toBe(404);
      const body = await bodyOf(res);
      expect(body.error).toBe('Symbol not found or unsupported');
      expect(body.kind).toBe(kind);
    }
  });

  it('maps rate_limited to 429', async () => {
    const res = providerErrorResponse(new ProviderError('x', 'rate_limited', 429), 'fallback');
    expect(statusOf(res)).toBe(429);
    const body = await bodyOf(res);
    expect(body.kind).toBe('rate_limited');
    // fallback message, not provider internals
    expect(body.error).toBe('fallback');
  });

  it('maps unavailable to 502 (provider failure, not client error)', async () => {
    const res = providerErrorResponse(new ProviderError('x', 'unavailable', 502), 'fallback');
    expect(statusOf(res)).toBe(502);
  });

  it('maps duck-typed bad_symbol errors (Object.assign pattern) to 404', async () => {
    const err = Object.assign(new Error('unknown symbol'), { kind: 'bad_symbol' });
    const res = providerErrorResponse(err, 'fallback');
    expect(statusOf(res)).toBe(404);
  });

  it('maps unknown errors to 500 with the fallback message only', async () => {
    const res = providerErrorResponse(new Error('internal stack details'), 'fallback');
    expect(statusOf(res)).toBe(500);
    const body = await bodyOf(res);
    expect(body.error).toBe('fallback');
  });

  it('never leaks the provider error message into the response body', async () => {
    const secretish = 'upstream said: api_key=SK034-xyz invalid';
    const res = providerErrorResponse(new ProviderError(secretish, 'unavailable', 502), 'Provider unavailable');
    const body = await bodyOf(res);
    expect(JSON.stringify(body)).not.toContain('SK034-xyz');
    expect(body.error).toBe('Provider unavailable');
  });
});

describe('validateSymbol', () => {
  it('accepts ordinary tickers and upper-cases them', () => {
    expect(validateSymbol('aapl')).toBe('AAPL');
    expect(validateSymbol('BTC/USD')).toBe('BTC/USD');
    expect(validateSymbol('EUR-USD')).toBe('EUR-USD');
  });

  it('accepts dotted tickers (e.g. BRK.B)', () => {
    expect(validateSymbol('brk.b')).toBe('BRK.B');
  });

  it('rejects empty/null input', () => {
    expect(validateSymbol(null)).toBeNull();
    expect(validateSymbol('')).toBeNull();
    expect(validateSymbol('   ')).toBeNull();
  });

  it('rejects injection attempts and unexpected characters', () => {
    expect(validateSymbol('AAPL; DROP TABLE users')).toBeNull();
    expect(validateSymbol('../../etc/passwd')).toBeNull();
    expect(validateSymbol('<script>')).toBeNull();
    expect(validateSymbol('symbol?x=1')).toBeNull();
  });

  it('rejects symbols longer than 20 characters', () => {
    expect(validateSymbol('A'.repeat(21))).toBeNull();
    expect(validateSymbol('A'.repeat(20))).toBe('A'.repeat(20));
  });
});
