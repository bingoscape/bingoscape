import { test as setup, expect } from '@playwright/test';
import { DiscordAuth } from './utils/auth';

const authFile = 'tests/.auth/user.json';

setup('authenticate with Discord', async ({ page }) => {
  const discordAuth = new DiscordAuth(page);
  
  const credentials = {
    email: process.env.DISCORD_TEST_EMAIL || '',
    password: process.env.DISCORD_TEST_PASSWORD || ''
  };

  if (!credentials.email || !credentials.password) {
    throw new Error('Discord test credentials not provided. Set DISCORD_TEST_EMAIL and DISCORD_TEST_PASSWORD environment variables.');
  }

  await discordAuth.login(credentials);
  
  // Verify we're logged in
  expect(await discordAuth.isLoggedIn()).toBe(true);
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});