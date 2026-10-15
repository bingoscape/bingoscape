/**
 * @jest-environment node
 *
 * `GET /api/osrs-image/<key>` (wiki image cache 2/6, #228): the route over the
 * real cache module, with Postgres, a temp-dir cache and a mocked `fetch`.
 */
import fs from "fs/promises"
import os from "os"
import path from "path"
import { inArray } from "drizzle-orm"
import { NextRequest } from "next/server"
import { nanoid } from "nanoid"

import { GET } from "@/app/api/osrs-image/[...key]/route"
import { db } from "@/server/db"
import { osrsImageCache } from "@/server/db/schema"
import { PLACEHOLDER_PNG } from "@/server/osrs-image/placeholder"
import { resetRateLimits, setRateLimitStore } from "@/server/rate-limit"

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

const PNG = Buffer.from(PLACEHOLDER_PNG)

let dir: string
let keys: string[] = []
let fetchMock: jest.Mock
const originalFetch = globalThis.fetch
const originalDir = process.env.OSRS_IMAGE_CACHE_DIR

const newKey = () => {
  const key = `Route_${nanoid(12).replace(/[^A-Za-z0-9]/g, "x")}.png`
  keys.push(key)
  return key
}

const call = (rawPath: string, headers: Record<string, string> = {}) =>
  GET(
    new NextRequest(`http://localhost/api/osrs-image/${rawPath}`, { headers })
  )

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "osrs-image-route-"))
  process.env.OSRS_IMAGE_CACHE_DIR = dir
  keys = []
  resetRateLimits()
  fetchMock = jest.fn(
    async () =>
      new Response(new Uint8Array(PNG), {
        headers: { "Content-Type": "image/png", ETag: '"wiki"' },
      })
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch
})
afterEach(async () => {
  globalThis.fetch = originalFetch
  if (originalDir === undefined) delete process.env.OSRS_IMAGE_CACHE_DIR
  else process.env.OSRS_IMAGE_CACHE_DIR = originalDir
  resetRateLimits()
  if (keys.length > 0) {
    await db.delete(osrsImageCache).where(inArray(osrsImageCache.key, keys))
  }
  await fs.rm(dir, { recursive: true, force: true })
})

describe("GET /api/osrs-image", () => {
  it("serves the image with the cache headers and fetches from the wiki once", async () => {
    const key = newKey()
    const first = await call(key)
    expect(first.status).toBe(200)
    expect(first.headers.get("Content-Type")).toBe("image/png")
    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    )
    expect(first.headers.get("ETag")).toMatch(/^"[0-9a-f]{16}-/)
    expect(first.headers.get("Content-Length")).toBe(String(PNG.length))
    expect(Buffer.from(await first.arrayBuffer())).toEqual(PNG)

    const second = await call(key)
    expect(second.status).toBe(200)
    expect(Buffer.from(await second.arrayBuffer())).toEqual(PNG)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("answers 304 to a matching If-None-Match", async () => {
    const key = newKey()
    const first = await call(key)
    const etag = first.headers.get("ETag")!
    await first.arrayBuffer()

    const revalidated = await call(key, { "If-None-Match": etag })
    expect(revalidated.status).toBe(304)
    expect(revalidated.headers.get("ETag")).toBe(etag)
    expect(await revalidated.text()).toBe("")

    const other = await call(key, { "If-None-Match": '"other"' })
    expect(other.status).toBe(200)
    await other.arrayBuffer()
  })

  it("serves a short-lived placeholder while the image is unavailable", async () => {
    fetchMock.mockImplementation(
      async () => new Response("missing", { status: 404 })
    )
    const key = newKey()
    const first = await call(key)
    expect(first.status).toBe(200)
    expect(first.headers.get("Content-Type")).toBe("image/png")
    expect(first.headers.get("Cache-Control")).toBe("public, max-age=300")
    expect(Buffer.from(await first.arrayBuffer())).toEqual(PNG)

    await call(key)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["a path traversal", "..%2F..%2Fetc%2Fpasswd.png"],
    ["an encoded traversal", "thumb/%2e%2e/x.png/10px-x.png"],
    ["an SVG", "Giant_frog.svg"],
    ["an unknown extension", "Giant_frog.txt"],
    ["a malformed escape", "Giant%ZZfrog.png"],
    ["an encoded slash", "a%2Fb.png"],
    ["too many segments", "a/b/c/d.png"],
  ])("rejects %s without contacting the wiki", async (_name, rawPath) => {
    const response = await call(rawPath)
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts a thumbnail key", async () => {
    const key = "thumb/Route_thumb_test.png/800px-Route_thumb_test.png"
    keys.push(key)
    const response = await call(key)
    expect(response.status).toBe(200)
    await response.arrayBuffer()
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe(
      `https://oldschool.runescape.wiki/images/${key}`
    )
  })

  it("rate limits cache misses per IP but never cache hits", async () => {
    const cached = newKey()
    const warm = await call(cached)
    expect(warm.status).toBe(200)
    await warm.arrayBuffer()

    setRateLimitStore({
      hit: () => ({ allowed: false, retryAfterSeconds: 42 }),
    })
    const fresh = await call(newKey(), { "X-Forwarded-For": "203.0.113.9" })
    expect(fresh.status).toBe(429)
    expect(fresh.headers.get("Retry-After")).toBe("42")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const hit = await call(cached)
    expect(hit.status).toBe(200)
    await hit.arrayBuffer()
  })

  it("counts misses against the last X-Forwarded-For address", async () => {
    const hit = jest
      .fn()
      .mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    setRateLimitStore({ hit })
    const response = await call(newKey(), {
      "X-Forwarded-For": "1.2.3.4, 203.0.113.9",
    })
    await response.arrayBuffer()
    expect(hit).toHaveBeenCalledWith(
      "osrsImageMiss:ip:203.0.113.9",
      expect.any(Number),
      expect.any(Number)
    )
  })
})
