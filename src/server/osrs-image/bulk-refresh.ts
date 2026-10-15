/**
 * Bulk refresh of the OSRS Wiki image cache (wiki image cache 4/6, epic #226).
 *
 * "Refresh all" marks every cached image stale (`refreshed_at = NULL`; a fetch
 * and a successful refresh always set it, so NULL on an `ok` row can only mean
 * "stale") and then walks the stale rows in a background loop, one request at
 * a time and at most one per `BULK_REFRESH_INTERVAL_MS` (about 1 request/s),
 * each as a `conditionalRefresh` (a 304 for an unchanged image) that goes
 * through the same User-Agent and the global upstream concurrency limit as
 * every other wiki request.
 *
 * The stale marks live in the database, so a restart loses nothing: the loop
 * stops with the process, and starting it again ("resume") continues with the
 * rows that are still stale. The loop visits each row once per run (it walks
 * the keys in order), so an image whose refresh fails does not hold it up; it
 * stays stale and is picked up by the next run.
 *
 * The run state is kept on `globalThis`: Next.js bundles the server action
 * that starts a run and the page that shows its progress separately, so a
 * module-level variable would not be shared between them. One server process
 * is assumed (like the rate limiter); `conditionalRefresh` still takes the
 * per-key lock, so a second process could only waste requests, not corrupt
 * anything.
 *
 * Not a "use server" module: nothing here is callable from the client.
 */
import { and, count, eq, gt, isNull } from "drizzle-orm"

import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import { osrsImageCache } from "@/server/db/schema"
import {
  conditionalRefresh,
  type RefreshOutcome,
} from "@/server/osrs-image/cache"

/** Minimum time between the starts of two requests of a bulk run. */
export const BULK_REFRESH_INTERVAL_MS = 1_000
const BATCH_SIZE = 25

export type BulkOutcomeCounts = Record<RefreshOutcome, number>

export interface BulkRefreshProgress {
  running: boolean
  startedAt: Date | null
  finishedAt: Date | null
  /** Images processed in the current / last run. */
  processed: number
  outcomes: BulkOutcomeCounts
}

export interface BulkRefresherDeps {
  refresh: (key: string) => Promise<RefreshOutcome>
  /** The next stale keys after `afterKey`, in key order. */
  nextKeys: (afterKey: string, limit: number) => Promise<string[]>
  intervalMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const emptyOutcomes = (): BulkOutcomeCounts => ({
  not_modified: 0,
  replaced: 0,
  fetched: 0,
  not_found: 0,
  error: 0,
})

export function createBulkRefresher(deps: BulkRefresherDeps) {
  const intervalMs = deps.intervalMs ?? BULK_REFRESH_INTERVAL_MS
  const now = deps.now ?? (() => Date.now())
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  let running: Promise<void> | null = null
  let startedAt: Date | null = null
  let finishedAt: Date | null = null
  let processed = 0
  let outcomes = emptyOutcomes()

  async function loop(): Promise<void> {
    let cursor = ""
    let lastRequestAt: number | null = null
    for (;;) {
      const keys = await deps.nextKeys(cursor, BATCH_SIZE)
      if (keys.length === 0) return
      for (const key of keys) {
        cursor = key
        if (lastRequestAt !== null) {
          const wait = lastRequestAt + intervalMs - now()
          if (wait > 0) await sleep(wait)
        }
        lastRequestAt = now()
        let outcome: RefreshOutcome
        try {
          outcome = await deps.refresh(key)
        } catch (error) {
          logger.error(
            { error, key },
            "OSRS image bulk refresh failed for a key"
          )
          outcome = "error"
        }
        processed += 1
        outcomes[outcome] += 1
      }
    }
  }

  return {
    /**
     * Starts a run in the background unless one is running. Returns whether it
     * started; `done` settles when the run ends (for tests, not for callers
     * that must not wait).
     */
    start(): { started: boolean; done: Promise<void> } {
      if (running) return { started: false, done: running }
      startedAt = new Date()
      finishedAt = null
      processed = 0
      outcomes = emptyOutcomes()
      const run: Promise<void> = loop()
        .catch((error: unknown) => {
          logger.error({ error }, "OSRS image bulk refresh stopped")
        })
        .finally(() => {
          finishedAt = new Date()
          if (running === run) running = null
        })
      running = run
      return { started: true, done: run }
    },
    isRunning: () => running !== null,
    progress(): BulkRefreshProgress {
      return {
        running: running !== null,
        startedAt,
        finishedAt,
        processed,
        outcomes: { ...outcomes },
      }
    },
  }
}

export type BulkRefresher = ReturnType<typeof createBulkRefresher>

/** Marks every cached image stale. Returns how many images were marked. */
export async function markAllImagesStale(
  executor: Pick<typeof db, "update">
): Promise<number> {
  const marked = await executor
    .update(osrsImageCache)
    .set({ refreshedAt: null })
    .where(eq(osrsImageCache.status, "ok"))
    .returning({ key: osrsImageCache.key })
  return marked.length
}

/** Cached images still waiting for a refresh. */
export async function countStaleImages(
  executor: Pick<typeof db, "select"> = db
): Promise<number> {
  const [row] = await executor
    .select({ total: count() })
    .from(osrsImageCache)
    .where(
      and(eq(osrsImageCache.status, "ok"), isNull(osrsImageCache.refreshedAt))
    )
  return row?.total ?? 0
}

/** The next stale keys after `afterKey`, in key order. */
export async function nextStaleKeys(
  afterKey: string,
  limit: number,
  executor: Pick<typeof db, "select"> = db
): Promise<string[]> {
  const rows = await executor
    .select({ key: osrsImageCache.key })
    .from(osrsImageCache)
    .where(
      and(
        eq(osrsImageCache.status, "ok"),
        isNull(osrsImageCache.refreshedAt),
        gt(osrsImageCache.key, afterKey)
      )
    )
    .orderBy(osrsImageCache.key)
    .limit(limit)
  return rows.map((row) => row.key)
}

const GLOBAL_KEY = "__osrsImageBulkRefresher__"
type GlobalWithRefresher = typeof globalThis & {
  [GLOBAL_KEY]?: BulkRefresher
}

/** The process-wide bulk refresher (shared between bundles through `globalThis`). */
export function getBulkRefresher(): BulkRefresher {
  const holder = globalThis as GlobalWithRefresher
  holder[GLOBAL_KEY] ??= createBulkRefresher({
    refresh: conditionalRefresh,
    nextKeys: (afterKey, limit) => nextStaleKeys(afterKey, limit),
  })
  return holder[GLOBAL_KEY]
}
