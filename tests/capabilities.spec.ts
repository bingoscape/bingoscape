import { test, expect } from "@playwright/test"
import {
  createUser,
  seedEvent,
  signIn,
  type SeededEvent,
} from "./utils/seed-event"

/**
 * Capabilities (RBAC 6/8): the server computes what each role may do and the
 * UI shows only that. A participant sees no manager page and no manager
 * control, management sees the manager pages and Board controls but not the
 * admin controls, an admin sees everything. These are affordances only; the
 * server guards are covered by the unit tests.
 */

const suffix = Date.now().toString(36)
const BOARDS = [{ title: "Capability board", rows: 3, columns: 3 }]

let admin: SeededEvent
let management: SeededEvent
let participant: SeededEvent

test.describe.configure({ mode: "serial" })
test.setTimeout(120_000)

test.beforeAll(async () => {
  const seed = async (
    prefix: string,
    role: "admin" | "management" | "participant"
  ) => {
    const username = `${prefix}${suffix}`
    return seedEvent({
      userId: await createUser(username),
      username,
      role,
      boards: BOARDS,
    })
  }
  admin = await seed("capadmin", "admin")
  management = await seed("capmgmt", "management")
  participant = await seed("cappart", "participant")
})

test.describe("a participant", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, participant.username)
  })

  test("sees no manager control in the workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`/events/${participant.eventId}`)
    await expect(page.locator(".osrs-board-fit")).toBeVisible()

    await expect(
      page.getByRole("button", { name: "Board actions" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Settings", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Invite", exact: true })
    ).toHaveCount(0)
  })

  for (const path of [
    "participants",
    "teams",
    "admin",
    "registrations",
    "draft/setup",
  ]) {
    test(`is sent back to the Event from /${path}`, async ({ page }) => {
      await page.goto(`/events/${participant.eventId}/${path}`)
      await expect(page).toHaveURL(
        new RegExp(`/events/${participant.eventId}(\\?.*)?$`)
      )
      await expect(page.getByText("Event Participants")).toHaveCount(0)
    })
  }

  test("still opens the pages every member may open", async ({ page }) => {
    const response = await page.goto(`/events/${participant.eventId}/stats`)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/stats$/)
    await expect(page.getByText("Statistics").first()).toBeVisible()
  })

  test("opens the team draft room but has no way to set one up", async ({
    page,
  }) => {
    const response = await page.goto(`/events/${participant.eventId}/draft`)
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { name: "Team draft" })
    ).toBeVisible()
    await expect(page.getByText("This event has no team draft.")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Set up a draft" })
    ).toHaveCount(0)
  })
})

test.describe("management", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, management.username)
  })

  test("opens the participants page and edits Boards", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`/events/${management.eventId}/participants`)
    await expect(page).toHaveURL(/\/participants$/)
    await expect(
      page.getByRole("heading", { name: "Event Participants" })
    ).toBeVisible()

    await page.goto(`/events/${management.eventId}`)
    await expect(
      page.getByRole("button", { name: "Board actions" })
    ).toBeVisible()
  })

  test("does not get the admin only controls", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto(`/events/${management.eventId}`)
    await expect(page.locator(".osrs-board-fit")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Settings", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Invite", exact: true })
    ).toHaveCount(0)

    // Management may set up the team draft.
    await page.goto(`/events/${management.eventId}/draft/setup`)
    await expect(
      page.getByRole("heading", { name: "Set up a team draft" })
    ).toBeVisible()

    // The admin dashboard checks its own permission (a 404 page).
    await page.goto(`/events/${management.eventId}/admin`)
    await expect(page.getByText("This page could not be found.")).toBeVisible()
    await expect(page.getByText("Admin Dashboard")).toHaveCount(0)
  })
})

test.describe("an admin", () => {
  test("sees the manager pages and every control", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)

    await page.goto(`/events/${admin.eventId}/participants`)
    await expect(
      page.getByRole("heading", { name: "Event Participants" })
    ).toBeVisible()

    await page.goto(`/events/${admin.eventId}`)
    await expect(page.locator(".osrs-board-fit")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Board actions" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Settings", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Invite", exact: true })
    ).toBeVisible()
  })
})
