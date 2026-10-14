/**
 * The enumerated values of the draft tables. A plain module (no imports) so
 * the schema, the server and client components share one definition without
 * client code importing the Drizzle schema.
 */

export const DRAFT_STATUSES = [
  "setup",
  // Reserved for a later phase (a lobby where members see the order before
  // the first pick); phase 1 goes from `setup` straight to `in_progress`.
  "open",
  "in_progress",
  "paused",
  "complete",
  "cancelled",
] as const
export type DraftStatus = (typeof DRAFT_STATUSES)[number]

export const DRAFT_ORDER_TYPES = ["linear", "snake", "random_snake"] as const
export type DraftOrderType = (typeof DRAFT_ORDER_TYPES)[number]

export const DRAFT_ON_TIMEOUT = ["auto_pick", "skip", "pause"] as const
export type DraftOnTimeout = (typeof DRAFT_ON_TIMEOUT)[number]

export const DRAFT_AUTO_PICK_RULES = ["best_rated", "random"] as const
export type DraftAutoPickRule = (typeof DRAFT_AUTO_PICK_RULES)[number]

export const DRAFT_POOL_STATUSES = [
  "available",
  "drafted",
  "withdrawn",
] as const
export type DraftPoolStatus = (typeof DRAFT_POOL_STATUSES)[number]
