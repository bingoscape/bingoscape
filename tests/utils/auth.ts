import { Page } from "@playwright/test"
import { db } from "../../src/server/db"
import { users } from "../../src/server/db/schema"

import { hashPassword } from "../../src/lib/password"

/**
 * Creates a mock user and session directly in the database,
 * bypassing external OAuth providers (Discord) for reliable E2E tests.
 */
export async function setupAuthBypass(page: Page) {
  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword("password123")
  
  // Seed user
  await db.insert(users).values({
    id: userId,
    name: "Playwright Test User",
    email: "e2e@example.com",
    username: "e2escaper",
    runescapeName: "E2EScaper",
    password: passwordHash,
  })

  // Log in via UI
  await page.goto("/sign-in")
  await page.fill('input[id="username"]', "e2escaper")
  await page.fill('input[id="password"]', "password123")
  await page.click('button[type="submit"]')
  
  // Wait for login to complete and redirect to home
  await page.waitForURL("**/")

  return { userId }
}
