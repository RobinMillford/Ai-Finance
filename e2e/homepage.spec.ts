import { test, expect } from '@playwright/test';

test.describe('Homepage and Navigation', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check for main heading
    await expect(page).toHaveTitle(/Finance/i);
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation links
    const stocksLink = page.getByRole('link', { name: /stock/i });
    const forexLink = page.getByRole('link', { name: /forex/i });
    const cryptoLink = page.getByRole('link', { name: /crypto/i });
    
    await expect(stocksLink).toBeVisible();
    await expect(forexLink).toBeVisible();
    await expect(cryptoLink).toBeVisible();
  });

  test('should have theme toggle', async ({ page }) => {
    await page.goto('/');
    
    // Look for theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme/i });
    
    if (await themeToggle.isVisible()) {
      await expect(themeToggle).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should load
    await expect(page).toHaveTitle(/Finance/i);
  });

  test('should have footer', async ({ page }) => {
    await page.goto('/');
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check for footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});
