"use server"

import { eq } from "drizzle-orm"

import {
  imageKeySchema,
  refreshAllImagesSchema,
} from "@/lib/validation/super-admin"
import { checkRateLimit } from "@/server/rate-limit"
import { osrsImageCache, type OsrsImageCacheRow } from "@/server/db/schema"
import {
  conditionalRefresh,
  purgeCachedImage,
  type RefreshOutcome,
} from "@/server/osrs-image/cache"
import {
  countStaleImages,
  getBulkRefresher,
  markAllImagesStale,
} from "@/server/osrs-image/bulk-refresh"
import { revalidateAdmin } from "@/server/super-admin/revalidate"
import {
  AdminActionError,
  adminAction,
  conflictError,
  invalidError,
  notFoundError,
  type AdminHandlerOutput,
  type AdminResult,
  type AdminTx,
} from "@/server/super-admin/admin-action"

/**
 * Super-admin actions on the OSRS Wiki image cache (wiki image cache 4/6, epic
 * #226): refresh one image, refresh all, purge one. Only async functions are
 * exported from this "use server" module; the guard, validation, rate limit,
 * transaction and audit row come from `adminAction`.
 *
 * Every wiki request they cause goes through `conditionalRefresh`, which uses
 * the shared User-Agent and the global upstream concurrency limit. The audit
 * `targetType` is "image" and the target is the cache key.
 */

export type RefreshImageData = { outcome: RefreshOutcome }

const auditSnapshot = (row: OsrsImageCacheRow | undefined) =>
  row
    ? {
        status: row.status,
        bytes: row.bytes,
        fetchedAt: row.fetchedAt?.toISOString() ?? null,
        refreshedAt: row.refreshedAt?.toISOString() ?? null,
      }
    : null

async function selectImage(tx: AdminTx, key: string) {
  const [row] = await tx
    .select()
    .from(osrsImageCache)
    .where(eq(osrsImageCache.key, key))
    .limit(1)
  return row
}

async function limitOrThrow(
  policy: "osrsImageRefresh" | "osrsImageRefreshAll",
  adminId: string,
  what: string
) {
  const limit = await checkRateLimit(policy, `user:${adminId}`)
  if (!limit.allowed) {
    throw new AdminActionError(
      "rate_limited",
      `Too many ${what} in a short time. Try again in ${limit.retryAfterSeconds}s.`
    )
  }
}

const refreshImageAction = adminAction(
  "image.refresh",
  imageKeySchema,
  async ({
    tx,
    admin,
    input,
  }): Promise<AdminHandlerOutput<RefreshImageData>> => {
    await limitOrThrow("osrsImageRefresh", admin.adminId, "refreshes")

    const before = await selectImage(tx, input.key)
    if (!before) throw notFoundError("Cached image")

    // Conditional request (If-None-Match / If-Modified-Since): a 304 keeps the
    // file. It also ignores `retry_after`, so a failed row is retried at once
    // and a fixed image is picked up immediately.
    const outcome = await conditionalRefresh(input.key)
    if (outcome === "not_found") {
      throw conflictError(
        before.status === "ok"
          ? "The wiki no longer has this image. The cached copy was kept."
          : "The wiki still has no such image."
      )
    }
    if (outcome === "error") {
      throw conflictError(
        before.status === "ok"
          ? "The wiki request failed. The cached copy was kept."
          : "The wiki request failed. Try again later."
      )
    }

    const after = await selectImage(tx, input.key)
    return {
      audit: {
        action: "image.refresh",
        targetType: "image",
        targetId: input.key,
        targetLabel: input.key,
        before: auditSnapshot(before),
        after: { outcome, ...auditSnapshot(after) },
      },
      data: { outcome },
    }
  }
)

export async function refreshImage(
  key: string
): Promise<AdminResult<RefreshImageData>> {
  const result = await refreshImageAction({ key })
  if (result.success) revalidateAdmin({ imageCache: true })
  return result
}

const refreshAllImagesAction = adminAction(
  "image.bulk.refresh",
  refreshAllImagesSchema,
  async ({ tx, admin, input }) => {
    await limitOrThrow("osrsImageRefreshAll", admin.adminId, "bulk refreshes")
    if (getBulkRefresher().isRunning()) {
      throw conflictError("A bulk refresh is already running.")
    }

    const resume = input.resume === true
    const images = resume
      ? await countStaleImages(tx)
      : await markAllImagesStale(tx)
    if (images === 0) {
      throw invalidError(
        resume
          ? "No images are waiting for a refresh."
          : "There are no cached images to refresh."
      )
    }

    return {
      audit: {
        action: "image.bulk.refresh",
        targetType: "image" as const,
        targetId: "all",
        targetLabel: "All cached images",
        after: { images, resume },
      },
    }
  }
)

/**
 * Marks every cached image stale and refreshes them in the background at about
 * 1 request/s; with `resume` it only continues with the images that are still
 * stale (after a restart or a run that ended early). Returns as soon as the run
 * is started; the page shows the progress.
 */
export async function refreshAllImages(resume = false): Promise<AdminResult> {
  const result = await refreshAllImagesAction({ resume })
  if (result.success) {
    // After the transaction: the loop must see the committed stale marks.
    getBulkRefresher().start()
    revalidateAdmin({ imageCache: true })
  }
  return result
}

const purgeImageAction = adminAction(
  "image.purge",
  imageKeySchema,
  async ({ tx, input }) => {
    const row = await purgeCachedImage(tx, input.key)
    if (!row) throw notFoundError("Cached image")
    return {
      audit: {
        action: "image.purge",
        targetType: "image" as const,
        targetId: input.key,
        targetLabel: input.key,
        before: auditSnapshot(row),
      },
    }
  }
)

/** Deletes the row and the file; the next request for the key fetches it again. */
export async function purgeImage(key: string): Promise<AdminResult> {
  const result = await purgeImageAction({ key })
  if (result.success) revalidateAdmin({ imageCache: true })
  return result
}
