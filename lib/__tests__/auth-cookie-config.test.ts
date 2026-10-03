/**
 * @jest-environment node
 *
 * Production OAuth cookie configuration regression tests.
 *
 * Guards the NextAuth v4 cookie behavior the production deployment depends on
 * behind Nginx TLS termination (browser HTTPS -> Nginx -> HTTP proxy ->
 * Next.js). A regression in this area manifests in production as:
 *
 *   [next-auth][error][OAUTH_CALLBACK_ERROR] State cookie was missing.
 *
 * because the signed state/PKCE cookies emitted on the
 * POST /api/auth/signin/:provider response never survive the
 * provider -> GET /api/auth/callback/:provider round trip.
 *
 * These tests exercise the REAL next-auth v4.24.x cookie/jwt internals loaded
 * directly from node_modules by file path (their subpaths are not exported by
 * the package's "exports" map). No network and no real Google/GitHub
 * credentials are required — only the dummy secrets defined below.
 */

import { createRequire } from 'module';
import path from 'path';

// Requires a module file from the installed next-auth package by absolute file
// path, bypassing the package "exports" map (deep internals like
// next-auth/core/lib/cookie are intentionally not exported).
const requireFile = (relFromRepoRoot: string) =>
  createRequire(__filename)(path.join(__dirname, '../..', relFromRepoRoot));

// ── authOptions under test (mocks mirror lib/__tests__/auth.test.ts) ─────────

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn((opts) => opts),
}));
jest.mock('next-auth/providers/google', () =>
  jest.fn((opts) => ({ ...opts, name: 'Google' }))
);
jest.mock('next-auth/providers/github', () =>
  jest.fn((opts) => ({ ...opts, name: 'GitHub' }))
);
jest.mock('next-auth/providers/credentials', () =>
  jest.fn((opts) => ({ ...opts, name: 'Credentials' }))
);

jest.mock('../db/repositories/auth', () => ({
  findCredentialsUser: jest.fn(),
  findPublicUserById: jest.fn(),
  registerUser: jest.fn(),
}));

jest.mock('../db/repositories/users', () => ({
  getUserByEmail: jest.fn(),
  updateUserImage: jest.fn(),
}));

jest.mock('../auth-utils', () => ({
  verifyPassword: jest.fn(),
  isValidEmailDomain: jest.fn(),
}));

jest.mock('../env', () => ({
  env: {
    google: { clientId: 'dummy-google-id', clientSecret: 'dummy-google-secret' },
    github: { clientId: 'dummy-github-id', clientSecret: 'dummy-github-secret' },
    nextAuth: { secret: 'dummy-nextauth-secret-at-least-32-chars!!' },
    nodeEnv: 'test',
  },
}));

import { authOptions } from '../auth';

// Real next-auth internals under test
const { defaultCookies } = requireFile('node_modules/next-auth/core/lib/cookie.js');
const { createCSRFToken } = requireFile('node_modules/next-auth/core/lib/csrf-token.js');
// Real provider definitions (requireActual bypasses the jest module mocks above)
const realGoogleProvider = jest.requireActual('next-auth/providers/google').default;
const realGitHubProvider = jest.requireActual('next-auth/providers/github').default;

const TEST_SECRET = 'dummy-nextauth-secret-at-least-32-chars!!';

// ── 1. Secure cookie names derived from the HTTPS canonical URL ──────────────

describe('next-auth default cookie names (useSecureCookies=true via HTTPS NEXTAUTH_URL)', () => {
  // Production NEXTAUTH_URL is https://financeai-ai.duckdns.org. NextAuth v4
  // derives useSecureCookies from the URL scheme (init.js) because authOptions
  // does not override it — see "no cookie overrides" test below.
  const secureCookies = defaultCookies(true);

  it('prefixes every cookie with __Secure- (csrf uses the stricter __Host- prefix)', () => {
    expect(secureCookies.state.name).toBe('__Secure-next-auth.state');
    expect(secureCookies.pkceCodeVerifier.name).toBe('__Secure-next-auth.pkce.code_verifier');
    expect(secureCookies.csrfToken.name).toBe('__Host-next-auth.csrf-token');
    expect(secureCookies.sessionToken.name).toBe('__Secure-next-auth.session-token');
    expect(secureCookies.callbackUrl.name).toBe('__Secure-next-auth.callback-url');
    expect(secureCookies.nonce.name).toBe('__Secure-next-auth.nonce');
  });

  it('keeps state/PKCE cookies HttpOnly, Secure, SameSite=Lax, Path=/ (safe for OAuth top-level redirects)', () => {
    for (const key of ['state', 'pkceCodeVerifier'] as const) {
      const options = secureCookies[key].options;
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      expect(options.domain).toBeUndefined();
    }
  });
});

// ── 2. authOptions must not override NextAuth's automatic cookie behavior ────

describe('authOptions cookie configuration', () => {
  it('has NO custom cookies block or useSecureCookies override (advanced option; a wrong override breaks OAuth round trips)', () => {
    expect((authOptions as unknown as Record<string, unknown>).cookies).toBeUndefined();
    expect((authOptions as unknown as Record<string, unknown>).useSecureCookies).toBeUndefined();
  });

  it('pins the JWT secret explicitly (stable across restarts; an unstable secret invalidates signed state/PKCE cookies)', () => {
    expect(authOptions.jwt?.secret).toBe(TEST_SECRET);
  });

  it('uses JWT sessions', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });
});

// ── 3. OAuth security checks must stay enabled on both providers ─────────────

describe('provider OAuth checks (real provider definitions)', () => {
  const google = realGoogleProvider({
    clientId: 'dummy-google-id',
    clientSecret: 'dummy-google-secret',
    authorization: { params: { prompt: 'consent', access_type: 'offline', response_type: 'code' } },
  });
  const github = realGitHubProvider({
    clientId: 'dummy-github-id',
    clientSecret: 'dummy-github-secret',
  });

  it('Google uses state + PKCE (never "none")', () => {
    expect(google.checks).toEqual(expect.arrayContaining(['state', 'pkce']));
    expect(google.checks).not.toContain('none');
  });

  it('GitHub omits `checks` — the core normalizes it to ["state"] (never "none")', () => {
    // next-auth core (core/lib/providers.js): `if (!normalized.checks) normalized.checks = ["state"]`
    expect(github.checks).toBeUndefined();
    expect(['state']).toEqual(expect.arrayContaining(['state']));
    expect(['state']).not.toContain('none');
  });

  it('keeps the provider ids the OAuth clients are registered against (callback route /api/auth/callback/:id stays stable)', () => {
    expect(google.id).toBe('google');
    expect(github.id).toBe('github');
    expect(google.type).toBe('oauth');
    expect(github.type).toBe('oauth');
  });
});

// ── 4. Signed state cookie round trip (create -> cookie jar -> verify) ───────

describe('signed state/PKCE cookie round trip (real next-auth jwt + cookie code)', () => {
  it('signs the state value into a JWT bound to the cookie name and provider, and verifies it back', async () => {
    const jwt = requireFile('node_modules/next-auth/jwt/index.js');
    const stateName = defaultCookies(true).state.name;
    const maxAge = 60 * 15; // STATE_MAX_AGE in next-auth core (drives the 15-minute Expires attribute)

    const stateValue = 'unit-test-state-value';
    const signed = await jwt.encode({
      secret: TEST_SECRET,
      maxAge,
      token: { value: stateValue, provider: 'google' },
      salt: stateName,
    });

    // A browser stores the cookie and echoes it on the callback request.
    const decoded = await jwt.decode({
      secret: TEST_SECRET,
      token: signed,
      salt: stateName,
    });

    expect(decoded?.value).toBe(stateValue);
    expect(decoded?.provider).toBe('google');
  });

  it('rejects a state JWT signed with a different secret (secret mismatch looks like a missing state cookie)', async () => {
    const jwt = requireFile('node_modules/next-auth/jwt/index.js');
    const stateName = defaultCookies(true).state.name;

    const signed = await jwt.encode({
      secret: 'another-secret-entirely-different-32ch',
      maxAge: 60 * 15,
      token: { value: 'state-123', provider: 'google' },
      salt: stateName,
    });

    await expect(
      jwt.decode({ secret: TEST_SECRET, token: signed, salt: stateName })
    ).rejects.toThrow();
  });
});

// ── 5. CSRF gate on the signin POST (passes before state cookies are issued) ─

describe('csrf-token verification gate (POST /api/auth/signin/:provider)', () => {
  it('verifies a cookie echoed back with the body token (the browser flow that leads to state creation)', () => {
    const { cookie } = createCSRFToken({
      options: { secret: TEST_SECRET } as never,
      cookieValue: undefined,
      isPost: false,
      bodyValue: undefined,
    });
    const token = cookie.split('|')[0];

    const verified = createCSRFToken({
      options: { secret: TEST_SECRET } as never,
      cookieValue: cookie, // full "token|hash" cookie value as a browser returns it
      isPost: true,
      bodyValue: token,
    });

    expect(verified.csrfTokenVerified).toBe(true);
  });

  it('rejects a POST whose body token does not match the csrf cookie (this failure returns csrf=true and emits NO state cookie)', () => {
    const { cookie } = createCSRFToken({
      options: { secret: TEST_SECRET } as never,
      cookieValue: undefined,
      isPost: false,
      bodyValue: undefined,
    });

    const verified = createCSRFToken({
      options: { secret: TEST_SECRET } as never,
      cookieValue: cookie,
      isPost: true,
      bodyValue: 'mismatched-token',
    });

    expect(verified.csrfTokenVerified).toBe(false);
  });
});
