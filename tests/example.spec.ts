import { test, expect } from '@playwright/test';

test.describe('Discord OAuth Authentication', () => {
  test('should be able to access authenticated pages', async ({ page }) => {
    // This test will use the stored authentication state from the setup
    await page.goto('/profile');
    
    // Verify we're on the profile page and not redirected to sign-in
    await expect(page).toHaveURL(/\/profile/);
    
    // Check for authenticated user elements
    await expect(page.locator('text="Profile"')).toBeVisible();
  });

  test('should be able to access events page', async ({ page }) => {
    await page.goto('/events/mine');
    
    // Should be able to access the events page
    await expect(page).toHaveURL(/\/events\/mine/);
  });

  test('should display user information', async ({ page }) => {
    await page.goto('/profile');
    
    // Check that user information is displayed
    // (adjust selectors based on your actual profile page structure)
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });
});