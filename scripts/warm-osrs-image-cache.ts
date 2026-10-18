/**
 * Front-loads the OSRS Wiki image cache (wiki image cache 6/6, epic #226).
 *
 * Lazy fetching on first view already fills the cache; this only pays the cost
 * up front, so no viewer waits for the wiki. It collects the distinct wiki
 * image URLs the app references:
 *   - `tiles.header_image`, `item_goals.image_url`
 *   - `bingo_templates.preview_image` and every string in `template_data`
 *   - the hard-coded frog images, metric icons and the showcase template
 * and fetches those the cache lacks through `getCachedImage`, one request per
 * second.
 *
 * - Idempotent and resumable: images already cached are skipped, failed ones
 *   stay inside the backoff the cache recorded, and a run that is interrupted
 *   (Ctrl-C finishes the current image) simply leaves a shorter list for the
 *   next run.
 * - `--dry-run` prints the counts and makes no request, no write.
 * - It writes `osrs_image_cache` rows and files into `OSRS_IMAGE_CACHE_DIR`:
 *   run it where `DATABASE_URL` and `OSRS_IMAGE_CACHE_DIR` point at the
 *   database and the volume you want filled (see docs/OSRS-IMAGE-CACHE.md).
 *
 * Run (bundles with esbuild, loads .env through env-cmd):
 *   npm run images:warm -- --dry-run   # counts only
 *   npm run images:warm                # fetch what is missing
 */
import { asc, gt, isNotNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import {
  bingoTemplates,
  itemGoals,
  osrsImageCache,
  tiles,
} from "@/server/db/schema"
import {
  builtInImageUrls,
  runWarmUp,
  templateJsonStrings,
} from "@/server/osrs-image/warm"

const TEMPLATE_BATCH_SIZE = 100

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run")

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  try {
    const urls: Array<string | null> = builtInImageUrls()

    const headerImages = await db
      .selectDistinct({ url: tiles.headerImage })
      .from(tiles)
      .where(isNotNull(tiles.headerImage))
    urls.push(...headerImages.map((row) => row.url))

    const goalImages = await db
      .selectDistinct({ url: itemGoals.imageUrl })
      .from(itemGoals)
    urls.push(...goalImages.map((row) => row.url))

    // Templates carry a whole JSON document each: keyset pages, not one query.
    let lastId: string | null = null
    for (;;) {
      const batch: {
        id: string
        previewImage: string | null
        templateData: string
      }[] = await db
        .select({
          id: bingoTemplates.id,
          previewImage: bingoTemplates.previewImage,
          templateData: bingoTemplates.templateData,
        })
        .from(bingoTemplates)
        .where(lastId ? gt(bingoTemplates.id, lastId) : undefined)
        .orderBy(asc(bingoTemplates.id))
        .limit(TEMPLATE_BATCH_SIZE)
      if (batch.length === 0) break
      for (const row of batch) {
        urls.push(row.previewImage, ...templateJsonStrings(row.templateData))
      }
      lastId = batch[batch.length - 1]!.id
    }

    const rows = await db
      .select({
        key: osrsImageCache.key,
        status: osrsImageCache.status,
        retryAfter: osrsImageCache.retryAfter,
      })
      .from(osrsImageCache)

    let stop = false
    process.once("SIGINT", () => {
      stop = true
      console.log("\nInterrupted: finishing the current image, then stopping.")
    })

    await runWarmUp({
      urls,
      rows,
      dryRun,
      shouldStop: () => stop,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: (line) => console.log(line),
      loadFetchImage: async () => {
        // The cache module opens its own connection through `@/server/db`,
        // whose env validation needs the app's full env; the script only
        // needs DATABASE_URL, so skip it. Imported late on purpose.
        process.env.SKIP_ENV_VALIDATION ??= "1"
        const { getCachedImage } = await import("@/server/osrs-image/cache")
        return (key) => getCachedImage(key)
      },
    })
  } finally {
    await client.end()
  }
}

main()
  .then(() => process.exit())
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
