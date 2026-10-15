import { test, expect } from "@playwright/test"
import { createUser, seedEvent, signIn, type SeededEvent } from "./utils/seed-event"

/**
 * Wiki image cache 3/6 (epic #226): stored header images are wiki URLs, but
 * the browser must only ever talk to our own /api/osrs-image route.
 */

const WIKI_HOST = "oldschool.runescape.wiki"
const HEADER_IMAGE = `https://${WIKI_HOST}/images/thumb/Giant_frog.png/800px-Giant_frog.png?a8fe4`

const suffix = Date.now().toString(36)
let event: SeededEvent

test.beforeAll(async () => {
  const username = `imgadmin${suffix}`
  const userId = await createUser(username)
  event = await seedEvent({
    userId,
    username,
    role: "admin",
    isPublic: true,
    boards: [
      { title: "Frogs", rows: 3, columns: 3, headerImage: HEADER_IMAGE },
    ],
  })
})

test("a board page makes no browser requests to the OSRS wiki", async ({
  page,
}) => {
  const wikiRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === WIKI_HOST) {
      wikiRequests.push(request.url())
    }
  })

  await signIn(page, event.username)
  const board = event.boards[0]!
  await page.goto(`/events/${event.eventId}?board=${board.id}`)
  await expect(page.locator('[role="gridcell"]')).toHaveCount(9)

  // Tile faces use `unoptimized` images: the src is the cache route itself.
  const frogs = page.locator(
    'img[src="/api/osrs-image/thumb/Giant_frog.png/800px-Giant_frog.png"]'
  )
  await expect(frogs.first()).toBeVisible()
  await page.waitForLoadState("networkidle")

  expect(wikiRequests).toEqual([])
})

test("the public Open Graph image renders with wiki tile images", async ({
  request,
}) => {
  const response = await request.get(
    `/public/events/${event.eventId}/opengraph-image`
  )
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("image/png")
})
