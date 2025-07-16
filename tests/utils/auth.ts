import { Page } from '@playwright/test';

export interface DiscordCredentials {
  email: string;
  password: string;
}

export class DiscordAuth {
  constructor(private page: Page) {}

  async login(credentials: DiscordCredentials) {
    // Navigate to the sign-in page
    await this.page.goto('/sign-in');
    
    // Click Discord OAuth button
    await this.page.click('text="Sign in with Discord"');
    
    // Handle Discord OAuth flow
    await this.handleDiscordOAuth(credentials);
    
    // Wait for redirect back to the app
    await this.page.waitForURL(/\//, { timeout: 10000 });
  }

  private async handleDiscordOAuth(credentials: DiscordCredentials) {
    // Wait for Discord login page to load
    await this.page.waitForURL(/discord\.com\/oauth2\/authorize/, { timeout: 10000 });
    
    // Check if already authorized (skip login if already logged in)
    const authorizeButton = await this.page.locator('button[type="submit"]').first();
    if (await authorizeButton.isVisible()) {
      await authorizeButton.click();
      return;
    }

    // Fill in Discord credentials
    await this.page.fill('input[name="email"]', credentials.email);
    await this.page.fill('input[name="password"]', credentials.password);
    
    // Submit login form
    await this.page.click('button[type="submit"]');
    
    // Wait for authorization page and authorize the app
    await this.page.waitForURL(/discord\.com\/oauth2\/authorize/, { timeout: 10000 });
    
    // Click authorize button
    const finalAuthorizeButton = await this.page.locator('button[type="submit"]').first();
    await finalAuthorizeButton.click();
  }

  async logout() {
    // Navigate to profile or wherever logout is available
    await this.page.goto('/profile');
    
    // Click logout button (adjust selector based on your UI)
    await this.page.click('text="Sign out"');
    
    // Wait for redirect to sign-in page
    await this.page.waitForURL('/sign-in');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto('/profile');
      // Check if we're redirected to sign-in page
      const currentUrl = this.page.url();
      return !currentUrl.includes('/sign-in');
    } catch {
      return false;
    }
  }
}