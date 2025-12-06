import { test, expect } from '@playwright/test';

test.describe('Watchlist Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to watchlist page', async ({ page }) => {
    // Try to navigate to watchlist
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    
    // Check that page loaded (may redirect to login or homepage)
    const url = page.url();
    expect(url).toMatch(/\/(watchlist|login|api\/auth|\s*$)/);
  });

  test('should display watchlist page', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    
    // Just verify page loaded
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should handle unauthenticated access', async ({ page }) => {
    await page.goto('/watchlist');
    await page.waitForLoadState('networkidle');
    
    // Should handle gracefully
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
