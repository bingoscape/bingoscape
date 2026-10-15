/**
 * @jest-environment node
 *
 * The read-through OSRS Wiki image cache (wiki image cache 2/6, #228) on real
 * Postgres with a temp-dir cache and a mocked `fetch`. Several cache instances
 * stand in for several server processes: they share the database and the
 * directory, but not the in-process state.
 */
import { createHash } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

import { db } from "@/server/db"
import { osrsImageCache } from "@/server/db/schema"
import {
  createOsrsImageCache,
  etagOfRow,
  MAX_IMAGE_BYTES,
  sniffImageType,
} from "@/server/osrs-image/cache"
import { PLACEHOLDER_PNG } from "@/server/osrs-image/placeholder"

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
const PNG_2 = Buffer.concat([PNG, Buffer.from("changed")])
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(20)])
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(20),
])
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
  Buffer.alloc(20),
])

const HOUR = 3_600_000

let dir: string
let keys: string[] = []
let clock: Date

const newKey = () => {
  const key = `Test_${nanoid(12).replace(/[^A-Za-z0-9]/g, "x")}.png`
  keys.push(key)
  return key
}

const image = (
  bytes: Buffer,
  headers: Record<string, string> = {},
  contentType = "image/png"
) =>
  new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": contentType, ...headers },
  })

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type FetchMock = jest.Mock<Promise<Response>, Parameters<typeof fetch>>

function makeFetch(respond: () => Response | Promise<Response>): FetchMock {
  return jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () =>
    respond()
  )
}

function makeCache(fetchMock: FetchMock | jest.Mock) {
  return createOsrsImageCache({
    fetch: fetchMock as unknown as typeof fetch,
    cacheDir: dir,
    now: () => clock,
  })
}

const row = async (key: string) =>
  (await db.select().from(osrsImageCache).where(eq(osrsImageCache.key, key)))[0]

const filesInDir = () => fs.readdir(dir)

const fileNameOf = (key: string, ext: string) =>
  `${createHash("sha256").update(key).digest("hex")}.${ext}`

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "osrs-image-cache-"))
  clock = new Date("2026-03-01T12:00:00.000Z")
  keys = []
})
afterEach(async () => {
  if (keys.length > 0) {
    await db.delete(osrsImageCache).where(inArray(osrsImageCache.key, keys))
  }
  await fs.rm(dir, { recursive: true, force: true })
})

describe("getCachedImage: the first request", () => {
  it("fetches the image, stores it as <sha256(key)>.<ext> and records the row", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() =>
      image(PNG, {
        ETag: '"abc"',
        "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT",
      })
    )
    const result = await makeCache(fetchMock).getCachedImage(key)

    expect(result.kind).toBe("hit")
    if (result.kind !== "hit") return
    const fileName = fileNameOf(key, "png")
    expect(result.image.filePath).toBe(path.join(dir, fileName))
    expect(result.image.contentType).toBe("image/png")
    expect(result.image.bytes).toBe(PNG.length)
    expect(await fs.readFile(result.image.filePath)).toEqual(PNG)
    expect(await filesInDir()).toEqual([fileName])

    const stored = await row(key)
    expect(stored).toMatchObject({
      status: "ok",
      fileName,
      contentType: "image/png",
      bytes: PNG.length,
      etag: '"abc"',
      lastModified: "Wed, 01 Jan 2025 00:00:00 GMT",
      attempts: 0,
      retryAfter: null,
    })
    expect(stored?.fetchedAt).toEqual(clock)
    expect(result.image.etag).toBe(etagOfRow(stored!))
  })

  it("builds the URL from the key, does not follow redirects and identifies itself", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() => image(PNG))
    await makeCache(fetchMock).getCachedImage(key)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`https://oldschool.runescape.wiki/images/${key}`)
    expect(init?.redirect).toBe("manual")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(
      /^Bingoscape\//
    )
  })

  it.each([
    ["gif", GIF, "image/gif"],
    ["jpg", JPEG, "image/jpeg"],
    ["webp", WEBP, "image/webp"],
  ])("accepts %s", async (ext, bytes, contentType) => {
    const key = newKey()
    const result = await makeCache(
      makeFetch(() => image(bytes, {}, contentType))
    ).getCachedImage(key)
    expect(result.kind).toBe("hit")
    expect((await row(key))?.fileName).toBe(fileNameOf(key, ext))
  })

  it("20 concurrent requests for a new key produce one fetch", async () => {
    const key = newKey()
    const fetchMock = makeFetch(async () => {
      await delay(100)
      return image(PNG)
    })
    const cache = makeCache(fetchMock)
    const results = await Promise.all(
      Array.from({ length: 20 }, () => cache.getCachedImage(key))
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r.kind === "hit")).toBe(true)
  })

  it("concurrent requests in several processes produce one fetch (advisory lock)", async () => {
    const key = newKey()
    const fetchMock = makeFetch(async () => {
      await delay(100)
      return image(PNG)
    })
    // Separate instances share no in-process state, only the database.
    const processes = [
      makeCache(fetchMock),
      makeCache(fetchMock),
      makeCache(fetchMock),
    ]
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        processes[i % processes.length]!.getCachedImage(key)
      )
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r.kind === "hit")).toBe(true)
  })

  it("limits the number of concurrent upstream fetches", async () => {
    let active = 0
    let peak = 0
    const fetchMock = makeFetch(async () => {
      active += 1
      peak = Math.max(peak, active)
      await delay(50)
      active -= 1
      return image(PNG)
    })
    const cache = createOsrsImageCache({
      fetch: fetchMock as unknown as typeof fetch,
      cacheDir: dir,
      now: () => clock,
      maxConcurrentFetches: 2,
    })
    await Promise.all(
      Array.from({ length: 6 }, () => cache.getCachedImage(newKey()))
    )
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(peak).toBe(2)
  })
})

describe("getCachedImage: later requests", () => {
  it("never fetches a second time", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() => image(PNG))
    const cache = makeCache(fetchMock)
    await cache.getCachedImage(key)
    const second = await cache.getCachedImage(key)
    expect(second.kind).toBe("hit")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("serves from disk and database after a restart (new instance)", async () => {
    const key = newKey()
    await makeCache(makeFetch(() => image(PNG))).getCachedImage(key)

    const afterRestart = makeFetch(() => image(PNG_2))
    const result = await makeCache(afterRestart).getCachedImage(key)
    expect(result.kind).toBe("hit")
    if (result.kind === "hit") {
      expect(await fs.readFile(result.image.filePath)).toEqual(PNG)
    }
    expect(afterRestart).not.toHaveBeenCalled()
  })

  it("does not ask admitMiss for a hit", async () => {
    const key = newKey()
    const cache = makeCache(makeFetch(() => image(PNG)))
    await cache.getCachedImage(key)
    const admitMiss = jest.fn()
    await cache.getCachedImage(key, { admitMiss })
    expect(admitMiss).not.toHaveBeenCalled()
  })

  it("refuses a miss that admitMiss throttles, without contacting the wiki", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() => image(PNG))
    const result = await makeCache(fetchMock).getCachedImage(key, {
      admitMiss: () => ({ allowed: false, retryAfterSeconds: 17 }),
    })
    expect(result).toEqual({ kind: "throttled", retryAfterSeconds: 17 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await row(key)).toBeUndefined()
  })

  it("treats a missing file behind an ok row as a miss and refetches", async () => {
    const key = newKey()
    const first = await makeCache(makeFetch(() => image(PNG))).getCachedImage(
      key
    )
    if (first.kind !== "hit") throw new Error("expected a hit")
    await fs.rm(first.image.filePath)

    const fetchMock = makeFetch(() => image(PNG_2))
    const again = await makeCache(fetchMock).getCachedImage(key)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(again.kind).toBe("hit")
    if (again.kind === "hit") {
      expect(await fs.readFile(again.image.filePath)).toEqual(PNG_2)
    }
  })

  it("never reads a file name that is not <sha256>.<ext>", async () => {
    const key = newKey()
    await db.insert(osrsImageCache).values({
      key,
      status: "ok",
      fileName: "../escape.png",
      contentType: "image/png",
      bytes: 1,
      fetchedAt: clock,
    })
    const escaped = path.join(dir, "..", "escape.png")
    await fs.writeFile(escaped, "x")
    try {
      const fetchMock = makeFetch(() => image(PNG))
      const result = await makeCache(fetchMock).getCachedImage(key)
      // Not served from the escaped path: refetched into the cache dir.
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(
        result.kind === "hit" && result.image.filePath.startsWith(dir)
      ).toBe(true)
    } finally {
      await fs.rm(escaped, { force: true })
    }
  })
})

describe("getCachedImage: rejected responses", () => {
  const cases: Array<[string, () => Response]> = [
    [
      "a redirect",
      () =>
        new Response(null, {
          status: 301,
          headers: { Location: "https://evil.example/x.png" },
        }),
    ],
    [
      "an oversized body (declared)",
      () => image(PNG, { "Content-Length": String(MAX_IMAGE_BYTES + 1) }),
    ],
    [
      "an oversized body (streamed, no Content-Length)",
      () => image(Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)])),
    ],
    ["a wrong content type", () => image(PNG, {}, "text/html")],
    [
      "an SVG",
      () =>
        image(
          Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
          {},
          "image/svg+xml"
        ),
    ],
    [
      "a magic byte mismatch",
      () => image(Buffer.from("<html>not a png</html>")),
    ],
    [
      "a content type that disagrees with the bytes",
      () => image(GIF, {}, "image/png"),
    ],
    ["an empty body", () => image(Buffer.alloc(0))],
    ["a server error", () => new Response("boom", { status: 500 })],
  ]

  it.each(cases)(
    "stores nothing for %s and records an error",
    async (_name, respond) => {
      const key = newKey()
      const result = await makeCache(makeFetch(respond)).getCachedImage(key)
      expect(result).toMatchObject({ kind: "unavailable", status: "error" })
      expect(await filesInDir()).toEqual([])
      expect(await row(key)).toMatchObject({
        status: "error",
        fileName: null,
        attempts: 1,
      })
    }
  )

  it("records a network failure as an error", async () => {
    const key = newKey()
    const result = await makeCache(
      jest.fn().mockRejectedValue(new Error("socket hang up"))
    ).getCachedImage(key)
    expect(result).toMatchObject({ kind: "unavailable", status: "error" })
  })

  it("leaves no temp file behind when a stream aborts", async () => {
    const key = newKey()
    const result = await makeCache(
      makeFetch(
        () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(PNG))
                controller.error(new Error("aborted"))
              },
            }),
            { headers: { "Content-Type": "image/png" } }
          )
      )
    ).getCachedImage(key)
    expect(result.kind).toBe("unavailable")
    expect(await filesInDir()).toEqual([])
  })
})

describe("getCachedImage: failures and backoff", () => {
  it("records a 404 as not_found with about 24 h backoff and never refetches before retry_after", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() => new Response("missing", { status: 404 }))
    const cache = makeCache(fetchMock)

    const first = await cache.getCachedImage(key)
    expect(first).toMatchObject({ kind: "unavailable", status: "not_found" })
    const stored = await row(key)
    expect(stored?.status).toBe("not_found")
    expect(stored?.retryAfter?.getTime()).toBe(clock.getTime() + 24 * HOUR)

    clock = new Date(clock.getTime() + 23 * HOUR)
    const second = await cache.getCachedImage(key)
    expect(second.kind).toBe("unavailable")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("refetches after retry_after and doubles the backoff while it keeps failing", async () => {
    const key = newKey()
    const fetchMock = makeFetch(() => new Response("missing", { status: 404 }))
    const cache = makeCache(fetchMock)
    await cache.getCachedImage(key)

    clock = new Date(clock.getTime() + 24 * HOUR + 1)
    await cache.getCachedImage(key)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const stored = await row(key)
    expect(stored?.attempts).toBe(2)
    expect(stored?.retryAfter?.getTime()).toBe(clock.getTime() + 48 * HOUR)
  })

  it("uses a shorter backoff for other errors and recovers when the image appears", async () => {
    const key = newKey()
    let respond: () => Response = () => new Response("down", { status: 503 })
    const fetchMock = makeFetch(() => respond())
    const cache = makeCache(fetchMock)

    await cache.getCachedImage(key)
    expect((await row(key))?.retryAfter?.getTime()).toBe(
      clock.getTime() + 5 * 60_000
    )
    expect((await cache.getCachedImage(key)).kind).toBe("unavailable")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    respond = () => image(PNG)
    clock = new Date(clock.getTime() + 6 * 60_000)
    const result = await cache.getCachedImage(key)
    expect(result.kind).toBe("hit")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await row(key)).toMatchObject({
      status: "ok",
      attempts: 0,
      retryAfter: null,
    })
  })

  it("a failure in one process holds off every other process", async () => {
    const key = newKey()
    const failing = makeFetch(() => new Response("down", { status: 500 }))
    await makeCache(failing).getCachedImage(key)

    const other = makeFetch(() => image(PNG))
    const result = await makeCache(other).getCachedImage(key)
    expect(result.kind).toBe("unavailable")
    expect(other).not.toHaveBeenCalled()
  })
})

describe("conditionalRefresh", () => {
  it("keeps the file on a 304 and only updates refreshed_at", async () => {
    const key = newKey()
    await makeCache(
      makeFetch(() =>
        image(PNG, {
          ETag: '"v1"',
          "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT",
        })
      )
    ).getCachedImage(key)
    const before = await row(key)

    clock = new Date(clock.getTime() + HOUR)
    const fetchMock = makeFetch(() => new Response(null, { status: 304 }))
    const outcome = await makeCache(fetchMock).conditionalRefresh(key)

    expect(outcome).toBe("not_modified")
    const headers = fetchMock.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >
    expect(headers["If-None-Match"]).toBe('"v1"')
    expect(headers["If-Modified-Since"]).toBe("Wed, 01 Jan 2025 00:00:00 GMT")
    const after = await row(key)
    expect(after?.refreshedAt).toEqual(clock)
    expect(after).toMatchObject({
      fileName: before?.fileName,
      fetchedAt: before?.fetchedAt,
      etag: '"v1"',
      bytes: PNG.length,
    })
    expect(await fs.readFile(path.join(dir, before!.fileName!))).toEqual(PNG)
  })

  it("replaces the file atomically on a 200 and changes the ETag served", async () => {
    const key = newKey()
    const cache = makeCache(makeFetch(() => image(PNG, { ETag: '"v1"' })))
    const first = await cache.getCachedImage(key)
    if (first.kind !== "hit") throw new Error("expected a hit")

    clock = new Date(clock.getTime() + HOUR)
    const outcome = await makeCache(
      makeFetch(() => image(PNG_2, { ETag: '"v2"' }))
    ).conditionalRefresh(key)

    expect(outcome).toBe("replaced")
    expect(await fs.readFile(first.image.filePath)).toEqual(PNG_2)
    expect(await filesInDir()).toHaveLength(1)
    const after = await row(key)
    expect(after).toMatchObject({
      etag: '"v2"',
      bytes: PNG_2.length,
      attempts: 0,
    })
    expect(after?.fetchedAt).toEqual(clock)
    const again = await cache.getCachedImage(key)
    expect(again.kind === "hit" && again.image.etag).not.toBe(first.image.etag)
  })

  it("removes the old file when the image type changes", async () => {
    const key = newKey()
    await makeCache(makeFetch(() => image(PNG))).getCachedImage(key)
    const outcome = await makeCache(
      makeFetch(() => image(WEBP, {}, "image/webp"))
    ).conditionalRefresh(key)
    expect(outcome).toBe("replaced")
    expect(await filesInDir()).toEqual([fileNameOf(key, "webp")])
  })

  it("keeps the cached copy when the refresh fails", async () => {
    const key = newKey()
    await makeCache(makeFetch(() => image(PNG))).getCachedImage(key)
    const before = await row(key)

    const notFound = await makeCache(
      makeFetch(() => new Response("gone", { status: 404 }))
    ).conditionalRefresh(key)
    const failed = await makeCache(
      makeFetch(() => new Response("down", { status: 500 }))
    ).conditionalRefresh(key)

    expect(notFound).toBe("not_found")
    expect(failed).toBe("error")
    expect(await row(key)).toEqual(before)
    expect(await fs.readFile(path.join(dir, before!.fileName!))).toEqual(PNG)
  })

  it("fetches fresh when there is no usable copy, ignoring retry_after", async () => {
    const key = newKey()
    await makeCache(
      makeFetch(() => new Response("missing", { status: 404 }))
    ).getCachedImage(key)

    const fetchMock = makeFetch(() => image(PNG))
    const outcome = await makeCache(fetchMock).conditionalRefresh(key)
    expect(outcome).toBe("fetched")
    expect(fetchMock.mock.calls[0]![1]?.headers).not.toHaveProperty(
      "If-None-Match"
    )
    expect(await row(key)).toMatchObject({ status: "ok", attempts: 0 })
  })
})

describe("helpers", () => {
  it("the placeholder is a valid PNG", () => {
    expect(sniffImageType(PLACEHOLDER_PNG)).toBe("image/png")
  })

  it("sniffImageType recognises the four types and nothing else", () => {
    expect(sniffImageType(PNG)).toBe("image/png")
    expect(sniffImageType(GIF)).toBe("image/gif")
    expect(sniffImageType(JPEG)).toBe("image/jpeg")
    expect(sniffImageType(WEBP)).toBe("image/webp")
    expect(sniffImageType(Buffer.from("<svg></svg>"))).toBeNull()
    expect(sniffImageType(Buffer.from("RIFF0000WAVE"))).toBeNull()
  })
})
