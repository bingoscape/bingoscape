import { sql } from "drizzle-orm"
import { teamTileSubmissions } from "@/server/db/schema"

/**
 * SET-clause value for team_tile_submissions.completed_at when writing status 'completed'.
 * In an UPDATE, column references see the OLD row, so this stamps only on an actual
 * transition (previous status <> 'completed') and keeps the existing stamp otherwise.
 * Uses clock_timestamp() (real wall-clock, not transaction start) so the feed's
 * (completed_at, id) cursor never sees a stamp older than a concurrently committed one's lag window.
 */
export const completedAtOnComplete = sql`CASE WHEN ${teamTileSubmissions.status} <> 'completed' THEN clock_timestamp() ELSE ${teamTileSubmissions.completedAt} END`
