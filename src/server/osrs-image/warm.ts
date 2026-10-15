/**
 * The logic of the cache warm-up (wiki image cache 6/6, epic #226): which wiki
 * images the app references, which of them the cache still lacks, and the
 * paced loop that fetches them. `scripts/warm-osrs-image-cache.ts` is the thin
 * CLI around it; everything here is database-free and takes its I/O as
 * arguments, so it is unit-testable.
 *
 * Lazy fetching on first view already covers every image; the warm-up only
 * front-loads the cost so no first viewer waits for the wiki.
 */
import { OSRS_FROG_IMAGES } from "@/lib/getRandomFrog"
import getTemplateBoard from "@/lib/getTemplateBoard"
import { parseWikiImageUrl } from "@/lib/osrs-image"
import { getMetricIds, getWikiIconUrl } from "@/lib/osrs-metrics"
import type { OsrsImageCacheStatus } from "@/lib/osrs-image-cache-status"
import type { GetCachedImageResult } from "@/server/osrs-image/cache"

/** One upstream request per second, like the bulk refresh of phase 4. */
export const WARM_INTERVAL_MS = 1_000

/** Every string value anywhere in a parsed JSON document. */
function* stringValues(value: unknown): Generator<string> {
  if (typeof value === "string") {
    yield value
  } else if (Array.isArray(value)) {
    for (const item of value) yield* stringValues(item)
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) yield* stringValues(item)
  }
}

/**
 * The string values of a template's JSON (`bingo_templates.template_data`).
 * Looking at every value instead of naming `headerImage` / `imageUrl` keeps
 * working when the template format grows an image field; only values that are
 * OSRS Wiki image URLs survive `collectWikiKeys` anyway. An unparsable
 * document yields nothing.
 */
export function templateJsonStrings(json: string): string[] {
  try {
    return [...stringValues(JSON.parse(json) as unknown)]
  } catch {
    return []
  }
}

/**
 * The distinct cache keys of the OSRS Wiki image URLs among `urls`, sorted so
 * a run is deterministic. Anything that is not an allowlisted OSRS Wiki image
 * (other hosts, RS3 images, uploads, free text, null) is skipped, and URLs that
 * differ only in `?hash` or percent-encoding collapse to one key.
 */
export function collectWikiKeys(
  urls: Iterable<string | null | undefined>
): string[] {
  const keys = new Set<string>()
  for (const url of urls) {
    if (!url) continue
    const parsed = parseWikiImageUrl(url)
    if (parsed) keys.add(parsed.key)
  }
  return [...keys].sort()
}

/** The wiki image URLs hard-coded in the app: frogs, metric icons, the showcase template. */
export function builtInImageUrls(): string[] {
  return [
    ...OSRS_FROG_IMAGES,
    ...(["skill", "boss", "activity"] as const).flatMap((type) =>
      getMetricIds(type).map(getWikiIconUrl)
    ),
    ...templateJsonStrings(getTemplateBoard()),
  ]
}

export interface CacheRowState {
  key: string
  status: OsrsImageCacheStatus
  retryAfter: Date | null
}

export interface WarmPlan {
  /** Distinct wiki images the app references. */
  total: number
  /** Already in the cache (`ok`); nothing to do. */
  cached: number
  /** Failed before and still inside their `retry_after` backoff; left alone. */
  backingOff: number
  /** Missing, or failed with the backoff over: these are fetched. Sorted. */
  pending: string[]
}

/**
 * Splits the referenced keys by what the cache already knows. Re-running after
 * an interruption just yields a shorter `pending`, which is what makes the
 * warm-up resumable.
 */
export function planWarmUp(
  keys: readonly string[],
  rows: readonly CacheRowState[],
  now: Date
): WarmPlan {
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const pending: string[] = []
  let cached = 0
  let backingOff = 0
  for (const key of keys) {
    const row = byKey.get(key)
    if (row?.status === "ok") cached += 1
    else if (row?.retryAfter && row.retryAfter.getTime() > now.getTime()) {
      backingOff += 1
    } else pending.push(key)
  }
  return { total: keys.length, cached, backingOff, pending }
}

export interface WarmResult {
  fetched: number
  /** `not_found` / `error`, or throttled: recorded by the cache with a backoff. */
  failed: number
  /** True when `shouldStop` ended the loop early. */
  stopped: boolean
}

export interface WarmOptions {
  /** `getCachedImage`: a hit means the image is cached now. */
  fetchImage: (key: string) => Promise<GetCachedImageResult>
  sleep: (ms: number) => Promise<void>
  intervalMs?: number
  shouldStop?: () => boolean
  onProgress?: (done: number, total: number, key: string, ok: boolean) => void
}

/**
 * Fetches `keys` one at a time with `intervalMs` of pause between two
 * requests, so the wiki sees at most one request per second. A failure is
 * recorded by the cache (backoff) and does not stop the run.
 */
export async function warmUp(
  keys: readonly string[],
  options: WarmOptions
): Promise<WarmResult> {
  const interval = options.intervalMs ?? WARM_INTERVAL_MS
  const result: WarmResult = { fetched: 0, failed: 0, stopped: false }
  for (const [index, key] of keys.entries()) {
    if (options.shouldStop?.()) {
      result.stopped = true
      break
    }
    if (index > 0) await options.sleep(interval)

    let ok = false
    try {
      ok = (await options.fetchImage(key)).kind === "hit"
    } catch {
      ok = false
    }
    if (ok) result.fetched += 1
    else result.failed += 1
    options.onProgress?.(index + 1, keys.length, key, ok)
  }
  return result
}

export interface WarmRunOptions {
  /** Every URL the app references (database values and built-ins). */
  urls: Iterable<string | null | undefined>
  /** The current `osrs_image_cache` rows. */
  rows: readonly CacheRowState[]
  now?: Date
  /** Prints counts and returns without any request or write. */
  dryRun: boolean
  /**
   * Resolves `getCachedImage`. Called only when something is fetched, so a dry
   * run never loads the cache module (and its database connection).
   */
  loadFetchImage: () => Promise<WarmOptions["fetchImage"]>
  sleep: WarmOptions["sleep"]
  shouldStop?: () => boolean
  intervalMs?: number
  log: (line: string) => void
}

/** The whole warm-up: plan, print the counts, and (unless dry) fetch. */
export async function runWarmUp(
  options: WarmRunOptions
): Promise<{ plan: WarmPlan; result: WarmResult | null }> {
  const keys = collectWikiKeys(options.urls)
  const plan = planWarmUp(keys, options.rows, options.now ?? new Date())
  const { log } = options

  log(`Distinct wiki images referenced: ${plan.total}`)
  log(`  already cached:                ${plan.cached}`)
  log(`  failed, still backing off:     ${plan.backingOff}`)
  log(`  to fetch:                      ${plan.pending.length}`)

  if (options.dryRun) {
    log("Dry run: no requests made, nothing written.")
    return { plan, result: null }
  }
  if (plan.pending.length === 0) {
    log("Nothing to fetch.")
    return { plan, result: null }
  }

  const interval = options.intervalMs ?? WARM_INTERVAL_MS
  log(
    `Fetching about 1 image per ${interval / 1000} s ` +
      `(roughly ${Math.ceil((plan.pending.length * interval) / 60_000)} min).`
  )
  const result = await warmUp(plan.pending, {
    fetchImage: await options.loadFetchImage(),
    sleep: options.sleep,
    intervalMs: interval,
    shouldStop: options.shouldStop,
    onProgress: (done, total, key, ok) =>
      log(`[${done}/${total}] ${ok ? "ok    " : "failed"} ${key}`),
  })
  log(
    `Done: ${result.fetched} fetched, ${result.failed} failed` +
      (result.stopped ? ", stopped early (run again to resume)." : ".")
  )
  return { plan, result }
}
