import { test, expect, type Browser, type Page } from "@playwright/test"
import { db } from "../src/server/db"
import { eventParticipants } from "../src/server/db/schema"
import { createUser, seedEvent, signIn } from "./utils/seed-event"

/**
 * Live team draft (#216): two browser contexts, a captain and a watcher. The
 * watcher sees a pick without reloading, recovers from a dropped stream, and
 * a non-captain gets no pick controls. The draft is set up through the real
 * setup form by the manager.
 */

const suffix = Date.now().toString(36)
const names = {
  manager: `drmgr${suffix}`,
  capA: `drcapa${suffix}`,
  capB: `drcapb${suffix}`,
  watcher: `drwatch${suffix}`,
  p1: `drplay1${suffix}`,
  p2: `drplay2${suffix}`,
  p3: `drplay3${suffix}`,
}

let eventId: string

test.describe.configure({ mode: "serial" })
test.setTimeout(120_000)

async function newPage(browser: Browser, username: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:3001" })
  const page = await context.newPage()
  await signIn(page, username)
  return page
}

test.beforeAll(async ({ browser }) => {
  const managerId = await createUser(names.manager)
  const seeded = await seedEvent({
    userId: managerId,
    username: names.manager,
    role: "admin",
    boards: [{ title: "Draft board", rows: 3, columns: 3 }],
  })
  eventId = seeded.eventId
  const others = [
    names.capA,
    names.capB,
    names.watcher,
    names.p1,
    names.p2,
    names.p3,
  ]
  for (const username of others) {
    const userId = await createUser(username)
    await db
      .insert(eventParticipants)
      .values({ eventId, userId, role: "participant" })
  }

  // The manager sets the draft up and starts it.
  const manager = await newPage(browser, names.manager)
  await manager.goto(`/events/${eventId}/draft/setup`)
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

test("the watcher sees a pick without reloading and has no pick controls", async ({
  browser,
}) => {
  const captain = await newPage(browser, names.capA)
  const watcher = await newPage(browser, names.watcher)
  await captain.goto(`/events/${eventId}/draft`)
  await watcher.goto(`/events/${eventId}/draft`)
  await expect(
    captain.getByRole("button", { name: /Connection: Live/ })
  ).toBeVisible()
  await expect(
    watcher.getByRole("button", { name: /Connection: Live/ })
  ).toBeVisible()

  // A non-captain sees no pick controls at all.
  await expect(watcher.getByRole("button", { name: /^Pick/ })).toHaveCount(0)

  // Mark the watcher's document: a reload would lose it.
  await watcher.evaluate(() => {
    ;(window as unknown as { __notReloaded: boolean }).__notReloaded = true
  })

  await captain
    .getByRole("button", { name: "Pick", exact: true })
    .first()
    .click()
  await captain.getByRole("button", { name: "Confirm pick" }).click()

  const log = watcher.getByRole("list", { name: "Pick log" })
  await expect(log).toContainText("picked", { timeout: 5_000 })
  expect(
    await watcher.evaluate(
      () => (window as unknown as { __notReloaded?: boolean }).__notReloaded
    )
  ).toBe(true)
  // The captain's own view settles to the same state.
  await expect(captain.getByRole("list", { name: "Pick log" })).toContainText(
    "picked"
  )
  await captain.context().close()
  await watcher.context().close()
})

test("a dropped stream recovers and loses no pick", async ({ browser }) => {
  const captain = await newPage(browser, names.capB)
  const watcher = await newPage(browser, names.watcher)
  await captain.goto(`/events/${eventId}/draft`)
  await watcher.goto(`/events/${eventId}/draft`)
  const live = watcher.getByRole("button", { name: /Connection: Live/ })
  await expect(live).toBeVisible()

  // Drop the watcher's connection; it must notice.
  await watcher.context().setOffline(true)
  await expect(
    watcher.getByRole("button", { name: /Connection: (Reconnecting|Polling)/ })
  ).toBeVisible({ timeout: 15_000 })

  // A pick is made while the watcher is away.
  await captain
    .getByRole("button", { name: "Pick", exact: true })
    .first()
    .click()
  await captain.getByRole("button", { name: "Confirm pick" }).click()
  await expect(captain.getByRole("list", { name: "Pick log" })).toContainText(
    "#2"
  )

  // Back online: the stream resumes from where it stopped.
  await watcher.context().setOffline(false)
  await expect(watcher.getByRole("list", { name: "Pick log" })).toContainText(
    "#2",
    { timeout: 45_000 }
  )
  await expect(live).toBeVisible({ timeout: 45_000 })
  await captain.context().close()
  await watcher.context().close()
})

test("the page keeps working when the stream is blocked", async ({
  browser,
}) => {
  const watcher = await newPage(browser, names.watcher)
  await watcher.route("**/draft/stream**", (route) => route.abort())
  await watcher.goto(`/events/${eventId}/draft`)
  await expect(
    watcher.getByRole("button", { name: /Connection: (Reconnecting|Polling)/ })
  ).toBeVisible({ timeout: 30_000 })
  // The state is still there, from the server render and the polling.
  await expect(watcher.getByRole("list", { name: "Pick log" })).toContainText(
    "#1"
  )
  await watcher.context().close()
})
