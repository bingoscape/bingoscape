/**
 * @jest-environment node
 *
 * The super-admin actions on the OSRS image cache (wiki image cache 4/6, #230)
 * on real Postgres, with a temp-dir cache volume and a mocked `fetch`.
 */
import { randomUUID } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

import {
  purgeImage,
  refreshAllImages,
  refreshImage,
} from "@/app/actions/osrs-image-cache"
import { checkSuperAdmin } from "@/lib/super-admin"
import { imageKeySchema } from "@/lib/validation/super-admin"
import { db } from "@/server/db"
import { adminAuditLog, osrsImageCache } from "@/server/db/schema"
import {
  createBulkRefresher,
  countStaleImages,
  getBulkRefresher,
  markAllImagesStale,
  type BulkRefresher,
} from "@/server/osrs-image/bulk-refresh"
import { conditionalRefresh, getCachedImage } from "@/server/osrs-image/cache"
import { PLACEHOLDER_PNG } from "@/server/osrs-image/placeholder"
import { resetRateLimits } from "@/server/rate-limit"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/lib/super-admin", () => ({ checkSuperAdmin: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/headers", () => ({ headers: async () => new Headers() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))
// A bulk run touches every cached image, also those of test files running in
// parallel on the same database: the table-wide parts are scoped to this
// file's keys below (the loop, pacing and SQL are covered in
// src/server/__tests__/osrs-image-bulk-refresh.test.ts).
jest.mock("@/server/osrs-image/bulk-refresh", () => ({
  ...jest.requireActual("@/server/osrs-image/bulk-refresh"),
  getBulkRefresher: jest.fn(),
  markAllImagesStale: jest.fn(),
  countStaleImages: jest.fn(),
}))

const mockCheck = jest.mocked(checkSuperAdmin)
const mockGetRefresher = jest.mocked(getBulkRefresher)
const mockMarkAll = jest.mocked(markAllImagesStale)
const mockCountStale = jest.mocked(countStaleImages)

const PNG = Buffer.from(PLACEHOLDER_PNG)
const PNG_2 = Buffer.concat([PNG, Buffer.from("changed")])

let dir: string
let keys: string[]
let adminId: string
let fetchMock: jest.SpyInstance
let refresher: BulkRefresher

const newKey = () => {
  const key = `Test_${nanoid(12).replace(/[^A-Za-z0-9]/g, "x")}.png`
  keys.push(key)
  return key
}

const png = (bytes: Buffer, headers: Record<string, string> = {}) =>
  new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": "image/png", ...headers },
  })
const notModified = () => new Response(null, { status: 304 })
const missing = () => new Response("nope", { status: 404 })

const row = async (key: string) =>
  (await db.select().from(osrsImageCache).where(eq(osrsImageCache.key, key)))[0]

const fileOf = async (key: string) => {
  const stored = await row(key)
  return stored?.fileName ? path.join(dir, stored.fileName) : null
}

/** Stale `ok` rows among this file's keys. */
async function staleKeys() {
  const rows = await db
    .select({
      key: osrsImageCache.key,
      refreshedAt: osrsImageCache.refreshedAt,
    })
    .from(osrsImageCache)
    .where(
      and(eq(osrsImageCache.status, "ok"), inArray(osrsImageCache.key, keys))
    )
  return rows
    .filter((r) => r.refreshedAt === null)
    .map((r) => r.key)
    .sort()
}

/** Caches `key` through the real read-through path (one wiki request). */
async function seed(key: string, response = png(PNG, { ETag: '"v1"' })) {
  fetchMock.mockResolvedValueOnce(response)
  const result = await getCachedImage(key)
  expect(result.kind).toBe("hit")
}

const signInAsAdmin = () =>
  mockCheck.mockResolvedValue({
    ok: true,
    admin: { adminId, email: "admin@example.com" },
  })

const auditRows = (action: string, key: string) =>
  db
    .select()
    .from(adminAuditLog)
    .where(
      and(eq(adminAuditLog.action, action), eq(adminAuditLog.targetId, key))
    )

async function waitForIdle(r: BulkRefresher) {
  for (let i = 0; i < 300 && r.isRunning(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(r.isRunning()).toBe(false)
}

beforeEach(() => {
  jest.clearAllMocks()
  return fs
    .mkdtemp(path.join(os.tmpdir(), "osrs-image-admin-"))
    .then((made) => {
      dir = made
      process.env.OSRS_IMAGE_CACHE_DIR = dir
      keys = []
      adminId = randomUUID()
      resetRateLimits()
      signInAsAdmin()
      fetchMock = jest.spyOn(globalThis, "fetch")

      mockMarkAll.mockImplementation(async (tx) => {
        const marked = await tx
          .update(osrsImageCache)
          .set({ refreshedAt: null })
          .where(
            and(
              eq(osrsImageCache.status, "ok"),
              inArray(osrsImageCache.key, keys)
            )
          )
          .returning({ key: osrsImageCache.key })
        return marked.length
      })
      mockCountStale.mockImplementation(async () => (await staleKeys()).length)
      refresher = createBulkRefresher({
        refresh: conditionalRefresh,
        nextKeys: async (after, limit) =>
          (await staleKeys()).filter((key) => key > after).slice(0, limit),
        sleep: async () => undefined,
      })
      mockGetRefresher.mockReturnValue(refresher)
    })
})

afterEach(async () => {
  fetchMock.mockRestore()
  jest.restoreAllMocks()
  if (keys.length > 0) {
    await db.delete(osrsImageCache).where(inArray(osrsImageCache.key, keys))
    await db.delete(adminAuditLog).where(inArray(adminAuditLog.targetId, keys))
  }
  await db.delete(adminAuditLog).where(eq(adminAuditLog.actorId, adminId))
  await fs.rm(dir, { recursive: true, force: true })
  delete process.env.OSRS_IMAGE_CACHE_DIR
})

describe("authorization", () => {
  it("rejects a non-admin on every action and changes nothing", async () => {
    const key = newKey()
    await seed(key)
    const before = await row(key)
    const callsBefore = fetchMock.mock.calls.length
    mockCheck.mockResolvedValue({ ok: false, userId: adminId })

    const results = await Promise.all([
      refreshImage(key),
      purgeImage(key),
      refreshAllImages(),
    ])

    for (const result of results) {
      expect(result).toMatchObject({ success: false, code: "forbidden" })
    }
    expect(fetchMock.mock.calls).toHaveLength(callsBefore)
    expect(await row(key)).toEqual(before)
    expect(await fileOf(key)).not.toBeNull()
    expect(mockMarkAll).not.toHaveBeenCalled()
    expect(refresher.isRunning()).toBe(false)
    // The denied attempt is audited.
    const denied = await auditRows("image.refresh", key)
    expect(denied).toHaveLength(1)
    expect(denied[0]).toMatchObject({ outcome: "denied", targetType: "image" })
  })

  it("rejects an anonymous caller", async () => {
    const key = newKey()
    await seed(key)
    mockCheck.mockResolvedValue({ ok: false, userId: null })
    await expect(purgeImage(key)).resolves.toMatchObject({
      success: false,
      code: "forbidden",
    })
    expect(await row(key)).toBeDefined()
  })

  it("only accepts a wiki image key", () => {
    expect(imageKeySchema.safeParse({ key: "Giant_frog.png" }).success).toBe(
      true
    )
    for (const key of [
      "",
      "../etc/passwd",
      "https://oldschool.runescape.wiki/images/Giant_frog.png",
      "dir/Giant_frog.png",
      "Giant_frog.svg",
    ]) {
      expect(imageKeySchema.safeParse({ key }).success).toBe(false)
    }
    expect(
      imageKeySchema.safeParse({ key: "Giant_frog.png", extra: 1 }).success
    ).toBe(false)
  })
})

describe("refreshImage", () => {
  it("keeps the file on a 304, sends the validators and audits it", async () => {
    const key = newKey()
    await seed(
      key,
      png(PNG, {
        ETag: '"v1"',
        "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT",
      })
    )
    const fileBefore = await fileOf(key)
    const before = await row(key)

    fetchMock.mockResolvedValueOnce(notModified())
    const result = await refreshImage(key)

    expect(result).toEqual({ success: true, data: { outcome: "not_modified" } })
    const [, init] = fetchMock.mock.calls.at(-1)!
    expect(init.headers).toMatchObject({
      "If-None-Match": '"v1"',
      "If-Modified-Since": "Wed, 01 Jan 2025 00:00:00 GMT",
    })
    expect(String(init.headers["User-Agent"])).not.toBe("")
    expect(await fileOf(key)).toBe(fileBefore)
    expect(await fs.readFile(fileBefore!)).toEqual(PNG)
    const after = await row(key)
    expect(after?.fetchedAt).toEqual(before?.fetchedAt)
    expect(after?.etag).toBe('"v1"')
    expect(after!.refreshedAt!.getTime()).toBeGreaterThanOrEqual(
      before!.refreshedAt!.getTime()
    )

    const [audit] = await auditRows("image.refresh", key)
    expect(audit).toMatchObject({
      outcome: "success",
      targetType: "image",
      actorId: adminId,
    })
    expect(audit?.after).toMatchObject({ outcome: "not_modified" })
  })

  it("replaces the file on a 200", async () => {
    const key = newKey()
    await seed(key)
    fetchMock.mockResolvedValueOnce(png(PNG_2, { ETag: '"v2"' }))

    const result = await refreshImage(key)

    expect(result).toEqual({ success: true, data: { outcome: "replaced" } })
    const stored = await row(key)
    expect(stored).toMatchObject({ etag: '"v2"', bytes: PNG_2.length })
    expect(await fs.readFile((await fileOf(key))!)).toEqual(PNG_2)
  })

  it("keeps the copy and reports it when the wiki fails or no longer has the image", async () => {
    const key = newKey()
    await seed(key)

    fetchMock.mockResolvedValueOnce(missing())
    await expect(refreshImage(key)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("cached copy was kept"),
    })
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 503 }))
    await expect(refreshImage(key)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("cached copy was kept"),
    })
    expect(await fs.readFile((await fileOf(key))!)).toEqual(PNG)
    expect((await row(key))?.status).toBe("ok")
  })

  it("retries a failed row at once, ignoring retry_after, and clears it", async () => {
    const key = newKey()
    fetchMock.mockResolvedValueOnce(missing())
    expect((await getCachedImage(key)).kind).toBe("unavailable")
    const failed = await row(key)
    expect(failed?.status).toBe("not_found")
    expect(failed?.retryAfter!.getTime()).toBeGreaterThan(Date.now())

    // The image was fixed on the wiki.
    fetchMock.mockResolvedValueOnce(png(PNG, { ETag: '"fixed"' }))
    const result = await refreshImage(key)

    expect(result).toEqual({ success: true, data: { outcome: "fetched" } })
    expect(await row(key)).toMatchObject({
      status: "ok",
      retryAfter: null,
      attempts: 0,
      etag: '"fixed"',
    })
    // Served from the cache now: no further wiki request.
    const callsBefore = fetchMock.mock.calls.length
    expect((await getCachedImage(key)).kind).toBe("hit")
    expect(fetchMock.mock.calls).toHaveLength(callsBefore)
  })

  it("does not fetch an image that is not in the cache", async () => {
    const result = await refreshImage(newKey())
    expect(result).toMatchObject({ success: false, code: "not_found" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an invalid key without a wiki request", async () => {
    const result = await refreshImage("../../etc/passwd")
    expect(result).toMatchObject({ success: false, code: "invalid" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("limits refreshes per admin", async () => {
    const key = newKey()
    await seed(key)
    fetchMock.mockImplementation(async () => notModified())
    const results = []
    for (let i = 0; i < 21; i += 1) results.push(await refreshImage(key))
    expect(results.slice(0, 20).every((r) => r.success)).toBe(true)
    expect(results[20]).toMatchObject({ success: false, code: "rate_limited" })
  })
})

describe("purgeImage", () => {
  it("deletes the row and the file and forces exactly one new fetch", async () => {
    const key = newKey()
    await seed(key)
    const file = (await fileOf(key))!
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(purgeImage(key)).resolves.toEqual({ success: true })

    expect(await row(key)).toBeUndefined()
    await expect(fs.stat(file)).rejects.toMatchObject({ code: "ENOENT" })
    const [audit] = await auditRows("image.purge", key)
    expect(audit).toMatchObject({ outcome: "success", targetType: "image" })

    fetchMock.mockResolvedValueOnce(png(PNG_2, { ETag: '"v2"' }))
    expect((await getCachedImage(key)).kind).toBe("hit")
    expect((await getCachedImage(key)).kind).toBe("hit")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await fs.readFile((await fileOf(key))!)).toEqual(PNG_2)
  })

  it("purges a failed row so the next request tries again at once", async () => {
    const key = newKey()
    fetchMock.mockResolvedValueOnce(missing())
    await getCachedImage(key)
    await expect(purgeImage(key)).resolves.toEqual({ success: true })

    fetchMock.mockResolvedValueOnce(png(PNG))
    expect((await getCachedImage(key)).kind).toBe("hit")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports a key that is not cached", async () => {
    await expect(purgeImage(newKey())).resolves.toMatchObject({
      success: false,
      code: "not_found",
    })
  })
})

describe("refreshAllImages", () => {
  it("marks the images stale, then refreshes them in the background and records the progress", async () => {
    const [a, b] = [newKey(), newKey()]
    await seed(a)
    await seed(b)
    fetchMock.mockImplementation(async () => notModified())
    const callsBefore = fetchMock.mock.calls.length

    const result = await refreshAllImages()
    expect(result).toEqual({ success: true })
    expect(refresher.progress().startedAt).not.toBeNull()
    await waitForIdle(refresher)

    expect(fetchMock.mock.calls.length - callsBefore).toBe(2)
    for (const call of fetchMock.mock.calls.slice(callsBefore)) {
      expect(call[1].headers).toHaveProperty("If-None-Match", '"v1"')
    }
    expect(await staleKeys()).toEqual([])
    expect(refresher.progress()).toMatchObject({
      running: false,
      processed: 2,
      outcomes: { not_modified: 2 },
    })
    const [audit] = await auditRows("image.bulk.refresh", "all")
    expect(audit).toMatchObject({ outcome: "success", targetType: "image" })
    expect(audit?.after).toMatchObject({ images: 2, resume: false })
  })

  it("resumes with the images that are still stale instead of marking all again", async () => {
    const [a, b] = [newKey(), newKey()]
    await seed(a)
    await seed(b)
    // An interrupted run: only `a` is still waiting.
    await db
      .update(osrsImageCache)
      .set({ refreshedAt: null })
      .where(eq(osrsImageCache.key, a))
    fetchMock.mockImplementation(async () => notModified())
    const callsBefore = fetchMock.mock.calls.length

    await expect(refreshAllImages(true)).resolves.toEqual({ success: true })
    await waitForIdle(refresher)

    expect(mockMarkAll).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.length - callsBefore).toBe(1)
    expect(await staleKeys()).toEqual([])
  })

  it("refuses to resume when nothing is waiting", async () => {
    await seed(newKey())
    await expect(refreshAllImages(true)).resolves.toMatchObject({
      success: false,
      code: "invalid",
    })
    expect(refresher.isRunning()).toBe(false)
  })

  it("refuses to start a second run", async () => {
    await seed(newKey())
    jest.spyOn(refresher, "isRunning").mockReturnValue(true)
    const start = jest.spyOn(refresher, "start")

    await expect(refreshAllImages()).resolves.toMatchObject({
      success: false,
      code: "conflict",
    })
    expect(mockMarkAll).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it("limits how often a run can be started", async () => {
    await seed(newKey())
    fetchMock.mockImplementation(async () => notModified())
    for (let i = 0; i < 3; i += 1) {
      await expect(refreshAllImages()).resolves.toEqual({ success: true })
      await waitForIdle(refresher)
    }
    await expect(refreshAllImages()).resolves.toMatchObject({
      success: false,
      code: "rate_limited",
    })
  })
})
