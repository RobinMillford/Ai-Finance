import { test, expect } from '@playwright/test';

test.describe('Crypto Routes', () => {
  test('should handle /crypto/[symbol]/[currency] route', async ({ page }) => {
    // Test the nested route pattern /crypto/888/USD
    await page.goto('/crypto/888/USD');
    
    // Wait for the redirect to complete by waiting for the URL change
    await page.waitForURL('**/crypto/888%2FUSD', { timeout: 5000 });
    
    // Check that we were redirected to the correct URL format
    const url = page.url();
    expect(url).toContain('/crypto/888%2FUSD');
  });

  test('should handle standard crypto route format', async ({ page }) => {
    // Test the standard route format with URL-encoded slash
    await page.goto('/crypto/BTC%2FUSD');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the crypto page
    const url = page.url();
    expect(url).toContain('/crypto/BTC%2FUSD');
  });
});
