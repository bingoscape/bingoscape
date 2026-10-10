import { test, expect, type Page } from "@playwright/test"
import {
  createUser,
  seedEvent,
  signIn,
  type SeededEvent,
} from "./utils/seed-event"

/**
 * Event workspace (/events/[id]): the Board fits the viewport on desktop, the
 * Tile selection lives in the URL, old Board URLs redirect, hidden Tiles do
 * not leak, and the public view is read-only.
 */

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
]

// [rows, columns]: square boards plus wide (4x7) and tall (7x4) ones
const SHAPES: Array<[number, number]> = [
  [3, 3],
  [5, 5],
  [4, 7],
  [7, 4],
  [10, 10],
]

const suffix = Date.now().toString(36)
let admin: SeededEvent
let player: SeededEvent
let publicEvent: SeededEvent

test.describe.configure({ mode: "serial" })
test.setTimeout(180_000)

test.beforeAll(async () => {
  const adminName = `wsadmin${suffix}`
  const adminId = await createUser(adminName)
  admin = await seedEvent({
    userId: adminId,
    username: adminName,
    role: "admin",
    boards: [
      ...SHAPES.map(([rows, columns]) => ({
        title: `Board ${rows}x${columns}`,
        rows,
        columns,
        hidden: rows === 5 ? [3] : [],
      })),
      { title: "Tiered", rows: 3, columns: 4, bingoType: "progression" as const },
    ],
  })

  const playerName = `wsplayer${suffix}`
  const playerId = await createUser(playerName)
  player = await seedEvent({
    userId: playerId,
    username: playerName,
    role: "participant",
    boards: [{ title: "Player board", rows: 5, columns: 5, hidden: [3] }],
  })

  const pubName = `wspub${suffix}`
  const pubId = await createUser(pubName)
  publicEvent = await seedEvent({
    userId: pubId,
    username: pubName,
    role: "admin",
    isPublic: true,
    boards: [
      { title: "Public 5x5", rows: 5, columns: 5, hidden: [3] },
      { title: "Public 3x3", rows: 3, columns: 3 },
    ],
  })
})

async function expectBoardInsideViewport(page: Page) {
  const board = page.locator(".osrs-board-fit").first()
  await expect(board).toBeVisible()
  const box = await board.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 0.5)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 0.5)

  // no page scroll on desktop
  const overflow = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }))
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.innerHeight + 1)
}

test.describe("fit board", () => {
  for (const viewport of VIEWPORTS) {
    for (const [rows, columns] of SHAPES) {
      test(`${rows}x${columns} fits ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport)
        await signIn(page, admin.username)
        const board = admin.boards.find(
          (b) => b.rows === rows && b.columns === columns
        )!
        await page.goto(`/events/${admin.eventId}?board=${board.id}`)
        await expect(page.locator(".osrs-board-fit")).toBeVisible()
        await expectBoardInsideViewport(page)

        // every Tile slot exists and is square
        const cells = page.locator('[role="gridcell"]')
        await expect(cells).toHaveCount(rows * columns)
        const first = await cells.first().boundingBox()
        expect(Math.abs(first!.width - first!.height)).toBeLessThan(1)
      })
    }
  }

  test("tier ladder fits the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)
    const tiered = admin.boards.find((b) => b.title === "Tiered")!
    await page.goto(`/events/${admin.eventId}?board=${tiered.id}`)
    await expect(page.getByRole("columnheader").first()).toBeVisible()
    await expectBoardInsideViewport(page)
  })
})

test.describe("selection lives in the URL", () => {
  test("?tile= opens the panel with the Tile selected", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)
    const board = admin.boards[0]!
    const tileId = admin.firstTileByBoard[board.id]!
    await page.goto(`/events/${admin.eventId}?board=${board.id}&tile=${tileId}`)

    await expect(
      page.getByRole("complementary", { name: "Event details" }).getByRole("heading", { name: "Tile 1" })
    ).toBeVisible()
    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveCount(1)
  })

  test("click selects, Back clears, Board switch updates ?board", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)
    const board = admin.boards[0]!
    await page.goto(`/events/${admin.eventId}?board=${board.id}`)

    await page.locator('[role="gridcell"]').nth(1).click()
    await expect(page).toHaveURL(/tile=/)
    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveCount(1)

    await page.goBack()
    await expect(page).not.toHaveURL(/tile=/)
    await expect(
      page.locator('[role="gridcell"][aria-selected="true"]')
    ).toHaveCount(0)

    const second = admin.boards[1]!
    await page.getByRole("button", { name: second.title }).click()
    await expect(page).toHaveURL(new RegExp(`board=${second.id}`))
  })

  test("keyboard: arrows move, Enter selects, Escape clears", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)
    const board = admin.boards[0]!
    await page.goto(`/events/${admin.eventId}?board=${board.id}`)

    const cells = page.locator('[role="gridcell"]')
    await cells.first().focus()
    await page.keyboard.press("ArrowRight")
    await expect(cells.nth(1)).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(cells.nth(4)).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/tile=/)
    await page.keyboard.press("Escape")
    await expect(page).not.toHaveURL(/tile=/)
  })
})

test.describe("redirects", () => {
  test("old /bingos/[id] URL lands on the workspace Board", async ({ page }) => {
    await signIn(page, admin.username)
    const board = admin.boards[1]!
    await page.goto(`/events/${admin.eventId}/bingos/${board.id}`)
    await expect(page).toHaveURL(
      new RegExp(`/events/${admin.eventId}\\?board=${board.id}`)
    )
    await expect(page.locator(".osrs-board-fit")).toBeVisible()
  })
})

test.describe("hidden Tiles", () => {
  test("players get an empty cell and no hidden data in the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, player.username)
    const board = player.boards[0]!
    await page.goto(`/events/${player.eventId}?board=${board.id}`)
    await expect(page.locator(".osrs-board-fit")).toBeVisible()

    // the hidden cell keeps its place but is aria-hidden and has no name
    await expect(page.locator('[role="gridcell"]')).toHaveCount(24)
    const html = await page.content()
    expect(html).not.toContain("do not leak")
    expect(html).not.toContain("Secret 3")
    // players never see the Board's codephrase-protected admin menu
    await expect(page.getByRole("button", { name: "Board actions" })).toHaveCount(0)
  })

  test("admins see the placeholder", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page, admin.username)
    const board = admin.boards.find((b) => b.rows === 5 && b.columns === 5)!
    await page.goto(`/events/${admin.eventId}?board=${board.id}`)
    await expect(page.getByText("Hidden").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Board actions" })).toBeVisible()
  })
})

test.describe("public view", () => {
  test("is read-only and Board URLs redirect", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const board = publicEvent.boards[1]!
    await page.goto(`/public/events/${publicEvent.eventId}/bingos/${board.id}`)
    await expect(page).toHaveURL(
      new RegExp(`/public/events/${publicEvent.eventId}\\?board=${board.id}`)
    )
    await expect(page.locator(".osrs-board-fit")).toBeVisible()
    await expectBoardInsideViewport(page)

    // no admin or submission affordances, no leaked secrets
    await expect(page.getByRole("button", { name: "Board actions" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /quick submit/i })).toHaveCount(0)
    const html = await page.content()
    expect(html).not.toContain("secret-phrase")

    await page.locator('[role="gridcell"]').first().click()
    await expect(page).toHaveURL(/tile=/)
    await expect(page.getByRole("tab", { name: "Submissions" })).toHaveCount(0)
  })

  test("a non-public event is not reachable", async ({ page }) => {
    const response = await page.goto(`/public/events/${admin.eventId}`)
    expect(response?.status()).toBe(404)
  })
})
