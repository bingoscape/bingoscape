import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { analyseDraft, type DraftAnalytics } from "@/lib/draft/analytics"
import {
  compareToOptimum,
  type OptimumComparison,
  type OptimumPlayerMetadata,
} from "@/lib/draft/optimum"
import type { DraftSnapshot } from "@/lib/draft/types"
import { rosterOf } from "@/lib/draft/view"
import { db } from "@/server/db"
import { playerMetadata } from "@/server/db/schema"
import { loadDraftEventsSince } from "./queries"

/**
 * Post-draft analytics for managers (team draft 4/4, #218), computed from a
 * finished draft's snapshot, its log and the players' metadata. No
 * authorization here: the recap page only calls it for `draft:manage`.
 */

export interface DraftAnalyticsReport {
  analytics: DraftAnalytics
  /** Null when there is nothing to compare (fewer than two teams). */
  optimum: OptimumComparison | null
}

export async function loadDraftAnalytics(
  snapshot: DraftSnapshot
): Promise<DraftAnalyticsReport> {
  const { state } = snapshot
  const events = await loadDraftEventsSince(snapshot.draftId, 0)
  const analytics = analyseDraft(state, events)

  // The drafted teams as user ids: captain and picks. A player whose account
  // is gone has no id and cannot be scored.
  const rosters = state.slots.map((slot) =>
    rosterOf(state, slot).flatMap((entry) =>
      entry.userId ? [entry.userId] : []
    )
  )
  const userIds = [...new Set(rosters.flat())]
  const rows =
    userIds.length === 0
      ? []
      : await db
          .select({
            userId: playerMetadata.userId,
            timezone: playerMetadata.timezone,
            ehp: playerMetadata.ehp,
            ehb: playerMetadata.ehb,
            dailyHoursAvailable: playerMetadata.dailyHoursAvailable,
            skillLevel: playerMetadata.skillLevel,
          })
          .from(playerMetadata)
          .where(
            and(
              eq(playerMetadata.eventId, snapshot.eventId),
              inArray(playerMetadata.userId, userIds)
            )
          )
  const metadata = new Map<string, OptimumPlayerMetadata>(
    rows.map((row) => [row.userId, row])
  )
  return { analytics, optimum: compareToOptimum(rosters, metadata) }
}
