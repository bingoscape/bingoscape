/**
 * Read-through cache of OSRS Wiki images (wiki image cache 2/6, epic #226).
 *
 * `getCachedImage(key)` serves an image from the cache volume and fetches it
 * from the wiki the first time only. The state lives in `osrs_image_cache`
 * (one row per key), the bytes in `<cache dir>/<sha256(key)>.<ext>`.
 *
 * - One fetch per key: requests of this process share one promise, and a
 *   per-key `pg_advisory_xact_lock` serialises processes; whoever gets the
 *   lock re-checks the row first.
 * - The URL is built here from the validated key (`parseWikiImageUrl` /
 *   `normalizeWikiImagePath` in `@/lib/osrs-image`); a caller never supplies
 *   a URL. Redirects are not followed, the body is capped at 2 MB while it is
 *   read, the type must be png/gif/jpeg/webp and match the magic bytes.
 * - A failed fetch is recorded (`not_found` / `error`) with an exponential
 *   backoff in `retry_after`; nothing asks the wiki again before that.
 * - An `ok` row whose file is gone (the volume is not part of the DB backups)
 *   counts as a miss.
 *
 * Not a "use server" module: nothing here is callable from the client.
 */
import { createHash, randomUUID } from "crypto"
import fs from "fs/promises"
import path from "path"
import { eq, sql } from "drizzle-orm"

import { OSRS_WIKI_HOST } from "@/lib/osrs-image"
import {
  getOsrsImageCacheDir,
  wikiRequestHeaders,
} from "@/lib/osrs-wiki-client"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import { osrsImageCache, type OsrsImageCacheRow } from "@/server/db/schema"

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const FETCH_TIMEOUT_MS = 5_000
export const DEFAULT_MAX_CONCURRENT_FETCHES = 4

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** First retry after a `not_found` (the image may be uploaded to the wiki later). */
const NOT_FOUND_BACKOFF_MS = 24 * HOUR
const NOT_FOUND_BACKOFF_MAX_MS = 7 * 24 * HOUR
/** First retry after any other failure; shorter, these are usually transient. */
const ERROR_BACKOFF_MS = 5 * MINUTE
const ERROR_BACKOFF_MAX_MS = 6 * HOUR

const IMAGE_TYPES = {
  "image/png": "png",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const
type ImageType = keyof typeof IMAGE_TYPES

const FILE_NAME = /^[0-9a-f]{64}\.(?:png|gif|jpg|webp)$/

/** A cached image ready to be served. */
export interface CachedImage {
  key: string
  /** Absolute path inside the cache directory. */
  filePath: string
  contentType: string
  bytes: number
  /** Strong ETag of this copy; changes when the file is replaced. */
  etag: string
}

export interface MissAdmission {
  allowed: boolean
  retryAfterSeconds: number
}

export type GetCachedImageResult =
  | { kind: "hit"; image: CachedImage }
  /** The wiki has no usable image and `retry_after` has not passed: serve a placeholder. */
  | {
      kind: "unavailable"
      status: "not_found" | "error"
      retryAfter: Date | null
    }
  /** `admitMiss` refused the request: do not contact the wiki. */
  | { kind: "throttled"; retryAfterSeconds: number }

export interface GetCachedImageOptions {
  /**
   * Called when the request would need the wiki (a cache miss), before
   * anything is fetched. The route uses it for the per-IP rate limit, so
   * cache hits are never limited.
   */
  admitMiss?: () => Promise<MissAdmission> | MissAdmission
}

export type RefreshOutcome =
  /** The wiki answered 304; only `refreshed_at` changed. */
  | "not_modified"
  /** The wiki sent a newer image; the file was replaced. */
  | "replaced"
  /** There was no usable copy, so the image was fetched fresh. */
  | "fetched"
  /** The wiki has no such image (a cached copy, if any, is kept). */
  | "not_found"
  /** The fetch failed (a cached copy, if any, is kept). */
  | "error"

export interface OsrsImageCacheOptions {
  fetch?: typeof fetch
  /** Defaults to `getOsrsImageCacheDir()`, read on every call. */
  cacheDir?: string
  now?: () => Date
  maxConcurrentFetches?: number
}

type Upstream =
  | {
      kind: "image"
      bytes: Buffer
      type: ImageType
      etag: string | null
      lastModified: string | null
    }
  | { kind: "not_modified" }
  | { kind: "not_found" }
  | { kind: "error"; reason: string }

/** Waits for a free slot; the returned function gives it back. */
class Semaphore {
  private readonly waiting: Array<() => void> = []
  private free: number

  constructor(permits: number) {
    this.free = Math.max(1, permits)
  }

  async acquire(): Promise<() => void> {
    if (this.free > 0) {
      this.free -= 1
    } else {
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    }
    let released = false
    return () => {
      if (released) return
      released = true
      const next = this.waiting.shift()
      if (next) next()
      else this.free += 1
    }
  }
}

/** The type of the data by its magic bytes, or null. */
export function sniffImageType(data: Uint8Array): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    data.length >= offset + bytes.length &&
    bytes.every((b, i) => data[offset + i] === b)
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  // "GIF87a" / "GIF89a"
  if (
    startsWith([0x47, 0x49, 0x46, 0x38]) &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    return "image/gif"
  }
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
  // "RIFF" <size> "WEBP"
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp"
  }
  return null
}

/** `<sha256(key)>` of a cache key, the stem of its file name. */
function fileStem(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

/** The ETag served for a row: changes whenever the file is replaced. */
export function etagOfRow(row: {
  key: string
  fetchedAt: Date | null
  bytes: number | null
}): string {
  return `"${fileStem(row.key).slice(0, 16)}-${(row.fetchedAt?.getTime() ?? 0).toString(36)}-${(row.bytes ?? 0).toString(36)}"`
}

function backoffMs(status: "not_found" | "error", attempts: number): number {
  const [base, max] =
    status === "not_found"
      ? [NOT_FOUND_BACKOFF_MS, NOT_FOUND_BACKOFF_MAX_MS]
      : [ERROR_BACKOFF_MS, ERROR_BACKOFF_MAX_MS]
  return Math.min(max, base * 2 ** Math.max(0, attempts - 1))
}

async function readCapped(
  response: Response,
  limit: number
): Promise<Buffer | "too_large"> {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined)
    return "too_large"
  }
  if (!response.body) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      return "too_large"
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total)
}

export function createOsrsImageCache(options: OsrsImageCacheOptions = {}) {
  const doFetch: typeof fetch = (input, init) =>
    (options.fetch ?? globalThis.fetch)(input, init)
  const now = options.now ?? (() => new Date())
  const cacheDir = () =>
    path.resolve(options.cacheDir ?? getOsrsImageCacheDir())
  const limiter = new Semaphore(
    options.maxConcurrentFetches ?? DEFAULT_MAX_CONCURRENT_FETCHES
  )
  const inflight = new Map<string, Promise<GetCachedImageResult>>()

  /**
   * The absolute path of a cache file, or null when `fileName` is not one this
   * module writes or would land outside the cache directory.
   */
  function resolveCacheFile(fileName: string): string | null {
    if (!FILE_NAME.test(fileName)) return null
    const dir = cacheDir()
    const resolved = path.resolve(dir, fileName)
    return resolved.startsWith(dir + path.sep) ? resolved : null
  }

  async function fileExists(filePath: string): Promise<boolean> {
    try {
      return (await fs.stat(filePath)).isFile()
    } catch {
      return false
    }
  }

  /** The cached image of an `ok` row, or null when the file is missing. */
  async function imageOfRow(
    row: OsrsImageCacheRow
  ): Promise<CachedImage | null> {
    if (
      row.status !== "ok" ||
      !row.fileName ||
      !row.contentType ||
      row.bytes === null
    ) {
      return null
    }
    const filePath = resolveCacheFile(row.fileName)
    if (!filePath || !(await fileExists(filePath))) return null
    return {
      key: row.key,
      filePath,
      contentType: row.contentType,
      bytes: row.bytes,
      etag: etagOfRow(row),
    }
  }

  /** What the row answers without the wiki: a hit, a placeholder, or null (a miss). */
  async function answerFromRow(
    row: OsrsImageCacheRow | undefined
  ): Promise<GetCachedImageResult | null> {
    if (!row) return null
    if (row.status === "ok") {
      const image = await imageOfRow(row)
      return image ? { kind: "hit", image } : null
    }
    if (row.retryAfter && row.retryAfter.getTime() > now().getTime()) {
      return {
        kind: "unavailable",
        status: row.status === "not_found" ? "not_found" : "error",
        retryAfter: row.retryAfter,
      }
    }
    return null
  }

  async function selectRow(
    executor: Pick<typeof db, "select">,
    key: string
  ): Promise<OsrsImageCacheRow | undefined> {
    const [row] = await executor
      .select()
      .from(osrsImageCache)
      .where(eq(osrsImageCache.key, key))
      .limit(1)
    return row
  }

  /** Asks the wiki for one image. Never throws. */
  async function fetchUpstream(
    key: string,
    validators?: { etag: string | null; lastModified: string | null }
  ): Promise<Upstream> {
    // Built from the validated key only; the host is fixed.
    const url = `https://${OSRS_WIKI_HOST}/images/${key}`
    const headers: Record<string, string> = {
      ...wikiRequestHeaders(),
      Accept: Object.keys(IMAGE_TYPES).join(","),
    }
    if (validators?.etag) headers["If-None-Match"] = validators.etag
    if (validators?.lastModified) {
      headers["If-Modified-Since"] = validators.lastModified
    }

    try {
      // Aborting the signal also aborts reading the body.
      const response = await doFetch(url, {
        method: "GET",
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (response.status === 304 && validators) {
        return { kind: "not_modified" }
      }
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined)
        return { kind: "not_found" }
      }
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        // Redirects land here too: they are never followed.
        return { kind: "error", reason: `status ${response.status}` }
      }

      const declaredType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        ?.trim()
        .toLowerCase()
      if (!declaredType || !(declaredType in IMAGE_TYPES)) {
        await response.body?.cancel().catch(() => undefined)
        return { kind: "error", reason: `content type ${declaredType}` }
      }

      const body = await readCapped(response, MAX_IMAGE_BYTES)
      if (body === "too_large") return { kind: "error", reason: "too large" }
      if (body.length === 0) return { kind: "error", reason: "empty body" }

      const sniffed = sniffImageType(body)
      if (sniffed !== declaredType) {
        return {
          kind: "error",
          reason: `magic bytes ${sniffed ?? "unknown"} do not match ${declaredType}`,
        }
      }

      return {
        kind: "image",
        bytes: body,
        type: sniffed,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      }
    } catch (error) {
      return {
        kind: "error",
        reason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** Writes the bytes to a temp file in the cache dir, then renames it into place. */
  async function storeFile(
    key: string,
    bytes: Buffer,
    type: ImageType
  ): Promise<string> {
    const dir = cacheDir()
    await fs.mkdir(dir, { recursive: true })
    const fileName = `${fileStem(key)}.${IMAGE_TYPES[type]}`
    const target = path.join(dir, fileName)
    const temp = path.join(dir, `.tmp-${randomUUID()}`)
    try {
      await fs.writeFile(temp, bytes, { flag: "wx" })
      await fs.rename(temp, target)
    } catch (error) {
      await fs.rm(temp, { force: true })
      throw error
    }
    return fileName
  }

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

  /** Stores a fetched image and upserts the row. Returns the new row. */
  async function saveImage(
    tx: Tx,
    key: string,
    previous: OsrsImageCacheRow | undefined,
    upstream: Extract<Upstream, { kind: "image" }>
  ): Promise<OsrsImageCacheRow> {
    const fileName = await storeFile(key, upstream.bytes, upstream.type)
    const at = now()
    const values = {
      status: "ok" as const,
      fileName,
      contentType: upstream.type,
      bytes: upstream.bytes.length,
      etag: upstream.etag,
      lastModified: upstream.lastModified,
      fetchedAt: at,
      refreshedAt: at,
      attempts: 0,
      retryAfter: null,
    }
    const [row] = await tx
      .insert(osrsImageCache)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: osrsImageCache.key, set: values })
      .returning()
    if (!row) throw new Error("osrs_image_cache upsert returned no row")

    // The type (and so the extension) can change on a refresh.
    if (previous?.fileName && previous.fileName !== fileName) {
      const old = resolveCacheFile(previous.fileName)
      if (old) await fs.rm(old, { force: true })
    }
    return row
  }

  /** Records a failed fetch with its backoff. Returns the new row. */
  async function saveFailure(
    tx: Tx,
    key: string,
    previous: OsrsImageCacheRow | undefined,
    status: "not_found" | "error"
  ): Promise<OsrsImageCacheRow> {
    const attempts = (previous?.attempts ?? 0) + 1
    const values = {
      status,
      fileName: null,
      contentType: null,
      bytes: null,
      etag: null,
      lastModified: null,
      fetchedAt: null,
      refreshedAt: null,
      attempts,
      retryAfter: new Date(now().getTime() + backoffMs(status, attempts)),
    }
    const [row] = await tx
      .insert(osrsImageCache)
      .values({ key, ...values })
      .onConflictDoUpdate({ target: osrsImageCache.key, set: values })
      .returning()
    if (!row) throw new Error("osrs_image_cache upsert returned no row")
    return row
  }

  async function lockKey(tx: Tx, key: string): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)
  }

  /** The miss path: lock, re-check, fetch, store. */
  async function fetchMissing(key: string): Promise<GetCachedImageResult> {
    const release = await limiter.acquire()
    try {
      return await db.transaction(async (tx) => {
        await lockKey(tx, key)
        const row = await selectRow(tx, key)
        // Another request or process may have fetched it while we waited.
        const answered = await answerFromRow(row)
        if (answered) return answered

        const upstream = await fetchUpstream(key)
        logger.info("OSRS image fetched from the wiki", {
          key,
          result: upstream.kind,
          ...(upstream.kind === "error" ? { reason: upstream.reason } : {}),
        })

        if (upstream.kind === "image") {
          const saved = await saveImage(tx, key, row, upstream)
          const image = await imageOfRow(saved)
          if (!image) throw new Error("stored image is not readable")
          return { kind: "hit", image }
        }
        const status = upstream.kind === "not_found" ? "not_found" : "error"
        const saved = await saveFailure(tx, key, row, status)
        return { kind: "unavailable", status, retryAfter: saved.retryAfter }
      })
    } finally {
      release()
    }
  }

  async function getCachedImage(
    key: string,
    opts: GetCachedImageOptions = {}
  ): Promise<GetCachedImageResult> {
    const answered = await answerFromRow(await selectRow(db, key))
    if (answered) return answered

    if (opts.admitMiss) {
      const admission = await opts.admitMiss()
      if (!admission.allowed) {
        return {
          kind: "throttled",
          retryAfterSeconds: admission.retryAfterSeconds,
        }
      }
    }

    // Requests of this process for the same key share one fetch.
    let pending = inflight.get(key)
    if (!pending) {
      pending = fetchMissing(key).finally(() => inflight.delete(key))
      inflight.set(key, pending)
    }
    return pending
  }

  /**
   * Asks the wiki whether a cached image changed (admin refresh, phase 4):
   * `If-None-Match` / `If-Modified-Since`, so an unchanged image costs a 304.
   * Ignores `retry_after`: an explicit refresh retries a failed key at once.
   * A failed refresh keeps the cached copy.
   */
  async function conditionalRefresh(key: string): Promise<RefreshOutcome> {
    const release = await limiter.acquire()
    try {
      return await db.transaction(async (tx): Promise<RefreshOutcome> => {
        await lockKey(tx, key)
        const row = await selectRow(tx, key)
        const current = row ? await imageOfRow(row) : null

        if (!row || !current) {
          // Nothing usable to validate against: a plain fetch.
          const upstream = await fetchUpstream(key)
          logger.info("OSRS image fetched from the wiki", {
            key,
            result: upstream.kind,
          })
          if (upstream.kind === "image") {
            await saveImage(tx, key, row, upstream)
            return "fetched"
          }
          const status = upstream.kind === "not_found" ? "not_found" : "error"
          await saveFailure(tx, key, row, status)
          return status
        }

        const upstream = await fetchUpstream(key, {
          etag: row.etag,
          lastModified: row.lastModified,
        })
        logger.info("OSRS image refreshed from the wiki", {
          key,
          result: upstream.kind,
        })
        switch (upstream.kind) {
          case "not_modified":
            await tx
              .update(osrsImageCache)
              .set({ refreshedAt: now() })
              .where(eq(osrsImageCache.key, key))
            return "not_modified"
          case "image":
            await saveImage(tx, key, row, upstream)
            return "replaced"
          case "not_found":
            return "not_found"
          default:
            return "error"
        }
      })
    } finally {
      release()
    }
  }

  return { getCachedImage, conditionalRefresh, resolveCacheFile }
}

const defaultCache = createOsrsImageCache()

/** Serves a cached image, fetching it from the wiki the first time only. */
export const getCachedImage = defaultCache.getCachedImage

/** Revalidates a cached image against the wiki with a conditional request. */
export const conditionalRefresh = defaultCache.conditionalRefresh
