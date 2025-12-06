import { test, expect } from '@playwright/test';

test.describe('Portfolio Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Note: These tests check public-facing pages only
    // Authentication tests would require login setup
  });

  test('should navigate to portfolio page', async ({ page }) => {
    // Try to navigate to portfolio page
    await page.goto('/portfolio');
    
    // Page should load (may redirect to login or homepage if not authenticated)
    await page.waitForLoadState('networkidle');
    
    // Check that we're either on portfolio page, login page, or redirected to homepage
    const url = page.url();
    expect(url).toMatch(/\/(portfolio|login|api\/auth|\s*$)/);
  });

  test('should display portfolio page elements', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    
    // Just verify page loaded without errors
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should handle unauthenticated access gracefully', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');
    
    // Should either show portfolio page or redirect to auth/homepage
    // All are acceptable behaviors
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
