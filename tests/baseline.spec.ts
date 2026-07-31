import { test, expect } from "@playwright/test"
import { setupAuthBypass } from "./utils/auth"

test.describe("Baseline E2E Test", () => {
  test("should bypass auth and load the application", async ({ page }) => {
    // 1. Setup the session directly in the database
    await setupAuthBypass(page)

    // 2. Navigate to the app (should be logged in automatically)
    await page.goto("/")

    // 3. Verify that the UI reflects a logged-in state (e.g., wait for user avatar or specific UI element)
    // Here we'll just check if the page loads without redirecting to /sign-in
    await expect(page).not.toHaveURL(/.*\/sign-in/)

    // Optionally check if we can see the user's name or some element that only exists when logged in
    await expect(page.getByText("E2EScaper")).toBeVisible({ timeout: 5000 })
  })
})
