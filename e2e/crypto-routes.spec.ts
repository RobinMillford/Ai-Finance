import { test, expect } from '@playwright/test';

// The proxy (proxy.ts) requires a session for asset detail pages — only the
// market-listing pages (/stocks, /forexs, /cryptos, ...) are public. These
// specs therefore verify that anonymous visitors are bounced to NextAuth's
// sign-in page with a callbackUrl pointing back at the requested route, so
// they land on the right asset page after authenticating.
test.describe('Crypto Routes', () => {
  test('should redirect unauthenticated users to sign-in for /crypto/[symbol]/[currency]', async ({ page }) => {
    await page.goto('/crypto/888/USD');

    // Anonymous access is redirected to /auth/signin?callbackUrl=/crypto/888/USD
    await page.waitForURL(/\/auth\/signin/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/auth/signin');
    expect(url.searchParams.get('callbackUrl')).toBe('/crypto/888/USD');
  });

  test('should redirect unauthenticated users to sign-in for standard crypto route format', async ({ page }) => {
    await page.goto('/crypto/BTC%2FUSD');

    // The URL-encoded path survives the redirect: URLSearchParams decodes the
    // double-encoded %252F back to %2F, so callbackUrl round-trips to the
    // exact requested path.
    await page.waitForURL(/\/auth\/signin/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/auth/signin');
    expect(url.searchParams.get('callbackUrl')).toBe('/crypto/BTC%2FUSD');
  });
});
