/**
 * Fills the summary columns of `bingo_templates` (schema_version, bingo_type,
 * rows, columns, tile_count, tier_count, total_xp, has_pattern_bonuses,
 * has_hidden_tiles) for templates saved before those columns existed.
 *
 * - Idempotent: only rows whose `rows` column is NULL are touched. Re-running
 *   after a partial run (or after new unparsable rows appear) is safe.
 * - Never deletes: rows whose `template_data` cannot be parsed are logged and
 *   skipped, and stay NULL (the gallery falls back to reading their JSON).
 * - Uses the same `parseExportedBingo` + `summarizeTemplate` as the save path.
 *
 * Run (bundles with esbuild, loads .env through env-cmd):
 *   npm run db:backfill-templates              # write
 *   npm run db:backfill-templates -- --dry-run # report only
 *   npm run db:backfill-templates -- --all     # recompute every row
 */
import { and, asc, eq, gt, isNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { bingoTemplates } from "@/server/db/schema"
import { summarizeStoredTemplate } from "@/lib/template-summary"

const BATCH_SIZE = 100

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has("--dry-run")
  const all = args.has("--all")

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  let lastId: string | null = null
  let updated = 0
  let skipped = 0
  let scanned = 0

  try {
    for (;;) {
      // Keyset pagination on id: skipped rows stay NULL, so "WHERE rows IS
      // NULL LIMIT n" alone would return them forever.
      const conditions = [
        ...(all ? [] : [isNull(bingoTemplates.rows)]),
        ...(lastId ? [gt(bingoTemplates.id, lastId)] : []),
      ]
      const batch: { id: string; templateData: string }[] = await db
        .select({
          id: bingoTemplates.id,
          templateData: bingoTemplates.templateData,
        })
        .from(bingoTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(bingoTemplates.id))
        .limit(BATCH_SIZE)

      if (batch.length === 0) break

      for (const row of batch) {
        scanned += 1
        const result = summarizeStoredTemplate(row.templateData)
        if (!result.success) {
          skipped += 1
          console.warn(`SKIP ${row.id}: ${result.error}`)
          continue
        }
        if (!dryRun) {
          await db
            .update(bingoTemplates)
            .set(result.summary)
            .where(eq(bingoTemplates.id, row.id))
        }
        updated += 1
      }

      lastId = batch[batch.length - 1]?.id ?? null
    }
  } finally {
    await client.end()
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}scanned ${scanned}, ${
      dryRun ? "would update" : "updated"
    } ${updated}, skipped ${skipped} unparsable`
  )
}

main().catch((error: unknown) => {
  console.error("Backfill failed:", error)
  process.exit(1)
})
