/**
 * The states of a row in `osrs_image_cache`. A plain module (no imports) so
 * the Drizzle schema can use it. The CHECK constraint of the column exists
 * only in the migration (CHECKs are deliberately SQL-only, see
 * docs/DATABASE-MIGRATION.md); keep the two in sync.
 */
export const OSRS_IMAGE_CACHE_STATUSES = ["ok", "not_found", "error"] as const
export type OsrsImageCacheStatus = (typeof OSRS_IMAGE_CACHE_STATUSES)[number]
