/**
 * @jest-environment node
 *
 * The bulk refresh loop of the OSRS image cache (wiki image cache 4/6, #230):
 * pacing (fake timers, no database), and the stale marks on real Postgres.
 */
import { inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

import { db } from "@/server/db"
import { osrsImageCache } from "@/server/db/schema"
import {
  BULK_REFRESH_INTERVAL_MS,
  countStaleImages,
  createBulkRefresher,
  markAllImagesStale,
  nextStaleKeys,
} from "@/server/osrs-image/bulk-refresh"
import type { RefreshOutcome } from "@/server/osrs-image/cache"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

/** A `nextKeys` that always offers every key after the cursor, like a table where nothing ever turns fresh. */
const allKeys = (keys: string[]) => async (after: string, limit: number) =>
  keys.filter((key) => key > after).slice(0, limit)

describe("bulk refresh pacing", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("starts at most one request per interval, one at a time", async () => {
    const keys = ["a.png", "b.png", "c.png", "d.png"]
    const starts: number[] = []
    let inFlight = 0
    let maxInFlight = 0
    const refresh = jest.fn(async (): Promise<RefreshOutcome> => {
      starts.push(Date.now())
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      // A slow request: the next one still starts one interval after this
      // one started, not one interval after it ended.
      await new Promise((resolve) => setTimeout(resolve, 400))
      inFlight -= 1
      return "not_modified"
    })
    const refresher = createBulkRefresher({
      refresh,
      nextKeys: allKeys(keys),
    })

    const { started, done } = refresher.start()
    expect(started).toBe(true)

    await jest.advanceTimersByTimeAsync(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(BULK_REFRESH_INTERVAL_MS - 1)
    expect(refresh).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(refresh).toHaveBeenCalledTimes(2)

    await jest.advanceTimersByTimeAsync(5 * BULK_REFRESH_INTERVAL_MS)
    await done

    expect(refresh).toHaveBeenCalledTimes(4)
    const gaps = starts.slice(1).map((at, i) => at - starts[i]!)
    expect(gaps).toEqual([1000, 1000, 1000])
    expect(maxInFlight).toBe(1)
    expect(refresher.progress()).toMatchObject({
      running: false,
      processed: 4,
      outcomes: { not_modified: 4 },
    })
  })

  it("does not start a second run while one is going", async () => {
    const refresher = createBulkRefresher({
      refresh: async () => "not_modified",
      nextKeys: allKeys(["a.png", "b.png"]),
    })
    const first = refresher.start()
    expect(refresher.isRunning()).toBe(true)
    expect(refresher.start().started).toBe(false)

    await jest.advanceTimersByTimeAsync(2 * BULK_REFRESH_INTERVAL_MS)
    await first.done
    expect(refresher.isRunning()).toBe(false)
  })

  it("visits each key once per run: a failing refresh neither stalls nor repeats", async () => {
    const refresh = jest.fn(async (key: string): Promise<RefreshOutcome> => {
      if (key === "b.png") throw new Error("boom")
      return key === "c.png" ? "error" : "replaced"
    })
    const refresher = createBulkRefresher({
      refresh,
      nextKeys: allKeys(["a.png", "b.png", "c.png"]),
    })
    const { done } = refresher.start()
    await jest.advanceTimersByTimeAsync(5 * BULK_REFRESH_INTERVAL_MS)
    await done

    expect(refresh.mock.calls.map(([key]) => key)).toEqual([
      "a.png",
      "b.png",
      "c.png",
    ])
    expect(refresher.progress().outcomes).toMatchObject({
      replaced: 1,
      error: 2,
    })
  })
})

describe("stale marks", () => {
  const keys: string[] = []
  const newKey = (suffix: string) => {
    const key = `Test_${nanoid(10).replace(/[^A-Za-z0-9]/g, "x")}${suffix}.png`
    keys.push(key)
    return key
  }
  afterEach(async () => {
    if (keys.length > 0) {
      await db.delete(osrsImageCache).where(inArray(osrsImageCache.key, keys))
    }
    keys.length = 0
  })

  const at = new Date("2026-03-01T12:00:00.000Z")

  it("marks only cached (ok) images stale and lists exactly those, in key order", async () => {
    const [a, b, failed] = [newKey("a"), newKey("b"), newKey("c")]
    await db.insert(osrsImageCache).values([
      { key: a, status: "ok", fileName: "x.png", bytes: 1, refreshedAt: at },
      { key: b, status: "ok", fileName: "y.png", bytes: 1, refreshedAt: at },
      {
        key: failed,
        status: "not_found",
        attempts: 1,
        retryAfter: new Date(at.getTime() + 86_400_000),
      },
    ])

    // Rolled back at the end, so other test files never see the marks.
    const rollback = new Error("rollback")
    await expect(
      db.transaction(async (tx) => {
        // Other test files share the table: assert on this test's keys only.
        const beforeList = await nextStaleKeys("", 10_000, tx)
        expect(beforeList.filter((key) => keys.includes(key))).toEqual([])
        const marked = await markAllImagesStale(tx)
        expect(marked).toBeGreaterThanOrEqual(2)
        expect(await countStaleImages(tx)).toBeGreaterThanOrEqual(2)

        const listed = await nextStaleKeys("", 10_000, tx)
        expect(listed.filter((key) => keys.includes(key))).toEqual(
          [a, b].sort()
        )
        expect(listed).not.toContain(failed)
        // Keyset: only keys after the cursor.
        expect(await nextStaleKeys("￿", 10, tx)).toEqual([])
        throw rollback
      })
    ).rejects.toBe(rollback)

    const rows = await db
      .select({
        key: osrsImageCache.key,
        refreshedAt: osrsImageCache.refreshedAt,
      })
      .from(osrsImageCache)
      .where(inArray(osrsImageCache.key, [a, b]))
    expect(
      rows.every((row) => row.refreshedAt?.getTime() === at.getTime())
    ).toBe(true)
  })
})
