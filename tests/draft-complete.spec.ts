import { test, expect, type Browser, type Page } from "@playwright/test"
import { eq, inArray } from "drizzle-orm"
import { db } from "../src/server/db"
import { eventParticipants, teamMembers, teams } from "../src/server/db/schema"
import { createUser, seedEvent, signIn } from "./utils/seed-event"

/**
 * A whole team draft (#218): the manager sets it up, two captains pick in
 * turn, a watcher follows along (marked "You" in the pool, sees the balance
 * panel and no pick controls), the recap appears for every member with the
 * analytics for the manager only, and the manager applies the teams.
 */

const suffix = Date.now().toString(36)
const names = {
  manager: `dcmgr${suffix}`,
  capA: `dccapa${suffix}`,
  capB: `dccapb${suffix}`,
  watcher: `dcwatch${suffix}`,
  p1: `dcplay1${suffix}`,
  p2: `dcplay2${suffix}`,
  p3: `dcplay3${suffix}`,
}

let eventId: string
const userIds: Record<string, string> = {}

test.describe.configure({ mode: "serial" })
test.setTimeout(180_000)

async function newPage(browser: Browser, username: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:3001" })
  const page = await context.newPage()
  await signIn(page, username)
  return page
}

/** The captain picks the first player of the pool. */
async function pickFirst(page: Page) {
  await page.getByRole("button", { name: "Pick", exact: true }).first().click()
  await page.getByRole("button", { name: "Confirm pick" }).click()
}

test.beforeAll(async ({ browser }) => {
  userIds.manager = await createUser(names.manager)
  const seeded = await seedEvent({
    userId: userIds.manager,
    username: names.manager,
    role: "admin",
    boards: [{ title: "Draft board", rows: 3, columns: 3 }],
  })
  eventId = seeded.eventId
  for (const key of ["capA", "capB", "watcher", "p1", "p2", "p3"] as const) {
    const userId = await createUser(names[key])
    userIds[key] = userId
    await db
      .insert(eventParticipants)
      .values({ eventId, userId, role: "participant" })
  }

  // Two rounds of two captains: four picks.
  const manager = await newPage(browser, names.manager)
  await manager.goto(`/events/${eventId}/draft/setup`)
  await manager.getByLabel("Rounds").fill("2")
  for (const captain of [names.capA, names.capB]) {
    await manager.getByLabel("Add a captain").fill(captain)
    await manager
      .getByRole("listitem")
      .filter({ hasText: captain })
      .getByRole("button", { name: "Add" })
      .click()
  }
  await manager.getByRole("button", { name: "Create draft" }).click()
  await manager.waitForURL(`**/events/${eventId}/draft`)
  await manager.getByRole("button", { name: /Start draft/ }).click()
  await manager.getByRole("button", { name: "Start draft" }).last().click()
  await expect(manager.getByText(/On the clock/).first()).toBeVisible()
  await manager.context().close()
})

test("two captains draft while a watcher follows, then the manager applies the teams", async ({
  browser,
}) => {
  const capA = await newPage(browser, names.capA)
  const capB = await newPage(browser, names.capB)
  const watcher = await newPage(browser, names.watcher)
  for (const page of [capA, capB, watcher]) {
    await page.goto(`/events/${eventId}/draft`)
    await expect(
      page.getByRole("button", { name: /Connection: Live/ })
    ).toBeVisible()
  }

  // The watcher is in the pool: their own row is marked "You". Nothing to
  // pick with, and no recap or balance yet.
  const pool = watcher.getByRole("list", { name: "Available players" })
  await expect(pool.getByText("You", { exact: true })).toHaveCount(1)
  await expect(watcher.getByRole("button", { name: /^Pick/ })).toHaveCount(0)
  await expect(
    watcher.getByRole("region", { name: "Team balance" })
  ).toHaveCount(0)
  await expect(watcher.getByRole("link", { name: "View recap" })).toHaveCount(0)

  // Snake order over two captains: A, B, B, A.
  const log = (page: Page) => page.getByRole("list", { name: "Pick log" })
  await pickFirst(capA)
  await expect(log(watcher)).toContainText("#1", { timeout: 10_000 })
  await expect(
    capB.getByRole("button", { name: "Pick", exact: true }).first()
  ).toBeVisible()

  await pickFirst(capB)
  await expect(log(watcher)).toContainText("#2", { timeout: 10_000 })
  await expect(log(capB)).toContainText("#2")
  await pickFirst(capB)
  await expect(log(watcher)).toContainText("#3", { timeout: 10_000 })
  await expect(log(capA)).toContainText("#3")
  await pickFirst(capA)

  // The balance panel is live for the watcher, who never reloaded.
  const balance = watcher.getByRole("region", { name: "Team balance" })
  await expect(balance).toBeVisible({ timeout: 10_000 })
  await expect(balance.getByRole("row")).toHaveCount(3) // header and two teams

  // The draft is complete: everyone gets the recap link.
  const recapLink = watcher.getByRole("link", { name: "View recap" })
  await expect(recapLink).toBeVisible({ timeout: 10_000 })
  await recapLink.click()
  await watcher.waitForURL(`**/events/${eventId}/draft/recap`)

  const rosters = watcher.getByRole("region", { name: "Final rosters" })
  await expect(rosters).toContainText("Not applied yet")
  await expect(rosters.getByRole("region", { name: /^Team / })).toHaveCount(2)
  const history = watcher.getByRole("region", { name: "Pick history" })
  // Header plus four picks.
  await expect(history.getByRole("row")).toHaveCount(5)
  await expect(
    watcher.getByRole("link", { name: "Share as image" })
  ).toHaveAttribute("href", /\/draft\/recap-image\?download=1$/)
  // Analytics are for managers.
  await expect(
    watcher.getByRole("region", { name: "Draft analytics" })
  ).toHaveCount(0)

  const image = await watcher.request.get(
    `/api/events/${eventId}/draft/recap-image`
  )
  expect(image.status()).toBe(200)
  expect(image.headers()["content-type"]).toBe("image/png")

  await capA.context().close()
  await capB.context().close()
  await watcher.context().close()
})

test("the manager sees the analytics and applies the teams", async ({
  browser,
}) => {
  const manager = await newPage(browser, names.manager)
  await manager.goto(`/events/${eventId}/draft/recap`)
  const analytics = manager.getByRole("region", { name: "Draft analytics" })
  await expect(analytics).toBeVisible()
  await expect(analytics).toContainText("Auto-pick rate")
  await expect(analytics).toContainText("Balance gap to the optimiser")

  await manager.goto(`/events/${eventId}/draft`)
  await manager.getByRole("button", { name: "Apply teams" }).click()
  await manager.getByRole("button", { name: "Apply teams" }).last().click()
  await expect(manager.getByText("Teams applied").first()).toBeVisible()

  // The drafted players are on the teams now: both captains and four players.
  await expect
    .poll(async () => {
      const draftTeams = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.eventId, eventId))
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(
          inArray(
            teamMembers.teamId,
            draftTeams.map((t) => t.id)
          )
        )
      return new Set(members.map((m) => m.userId)).has(userIds.capA!)
    })
    .toBe(true)
  const members = await db
    .select({ userId: teamMembers.userId, isLeader: teamMembers.isLeader })
    .from(teamMembers)
    .where(eq(teamMembers.eventId, eventId))
  // Two captains and four drafted players (the seed's own teams add more).
  expect(members.filter((m) => m.isLeader).length).toBeGreaterThanOrEqual(2)

  await manager.goto(`/events/${eventId}/draft/recap`)
  await expect(
    manager.getByRole("region", { name: "Final rosters" })
  ).toContainText("Applied")
  await manager.context().close()
})
