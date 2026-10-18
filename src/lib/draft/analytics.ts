import type { DraftLogEvent, DraftState } from "./types"

/**
 * Post-draft analytics for managers (team draft 4/4, #218). Pure: built from
 * the final state and the draft's log events.
 *
 * - **Reach and steal.** Each rated pick is compared with where the player
 *   ranked by rating among the rated pool (rank 1 = best; players with the
 *   same rating share a rank). `delta = pickNo - ratingRank`: strongly
 *   negative means the player went well before their rating suggests (a
 *   *reach*), strongly positive that they lasted well beyond it (a *steal*).
 *   "Strongly" is one full round, i.e. the number of teams (at least 2).
 *   Unrated picks have no rank and no verdict.
 * - **Time per pick.** From the log: the time between the event that started
 *   the turn (draft start, the previous pick or skip, a resume or an undo)
 *   and the pick. Picks the timer made are excluded: they only measure the
 *   timer, not the captain.
 * - **Auto-picks.** Picks made by the timer, as a share of all standing picks.
 */

export type PickVerdict = "reach" | "steal" | "fair"

export interface PickAnalysis {
  pickNo: number
  round: number
  slotId: string
  poolEntryId: string
  userId: string | null
  /** Out of 100; null: unrated. */
  rating: number | null
  /** 1 = best rated of the pool; null for an unrated player. */
  ratingRank: number | null
  /** `pickNo - ratingRank`; null for an unrated player. */
  delta: number | null
  verdict: PickVerdict | null
  /** Seconds the captain took; null when unknown or the timer picked. */
  seconds: number | null
  auto: boolean
  forced: boolean
}

export interface TeamTiming {
  slotId: string
  teamName: string
  picks: number
  averageSeconds: number | null
}

export interface DraftAnalytics {
  picks: PickAnalysis[]
  /** `delta` beyond which a pick counts as a reach or a steal. */
  threshold: number
  /** The biggest reaches / steals, most extreme first. */
  reaches: PickAnalysis[]
  steals: PickAnalysis[]
  timing: {
    /** Picks with a measured time. */
    measured: number
    averageSeconds: number | null
    medianSeconds: number | null
    slowest: { pickNo: number; seconds: number } | null
    perTeam: TeamTiming[]
  }
  autoPicks: {
    count: number
    /** 0..1 of all standing picks; 0 when there are none. */
    rate: number
    /** Turns lost to the timer (`on_timeout: skip`). */
    timerSkips: number
    /** Picks a manager made for a captain. */
    forced: number
  }
}

/** How many reaches and steals the summary lists. */
export const ANALYTICS_HIGHLIGHTS = 3

/** Events that start a turn's clock. */
const TURN_START_TYPES = new Set([
  "started",
  "pick",
  "skipped",
  "resumed",
  "undo",
])

/**
 * Seconds per standing pick number, from the log. A later `pick` event for
 * the same number (after an undo) replaces the earlier one.
 */
export function pickDurations(
  events: readonly DraftLogEvent[]
): Map<number, number> {
  const seconds = new Map<number, number>()
  let turnStart: number | null = null
  for (const event of events) {
    const at = Date.parse(event.at)
    if (event.type === "undo") {
      seconds.delete(event.payload.pickNo)
    }
    if (event.type === "pick") {
      if (turnStart !== null && !event.payload.auto) {
        seconds.set(event.payload.pickNo, Math.max(0, (at - turnStart) / 1000))
      } else {
        seconds.delete(event.payload.pickNo)
      }
    }
    if (TURN_START_TYPES.has(event.type)) turnStart = at
  }
  return seconds
}

const average = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function analyseDraft(
  state: DraftState,
  events: readonly DraftLogEvent[]
): DraftAnalytics {
  const threshold = Math.max(2, state.slots.length)
  const rated = state.pool.flatMap((entry) =>
    entry.rating === null ? [] : [entry.rating]
  )
  const entryOf = new Map(state.pool.map((e) => [e.poolEntryId, e]))
  const durations = pickDurations(events)

  const picks = state.picks.map((pick): PickAnalysis => {
    const rating = entryOf.get(pick.poolEntryId)?.rating ?? null
    const ratingRank =
      rating === null ? null : 1 + rated.filter((r) => r > rating).length
    const delta = ratingRank === null ? null : pick.pickNo - ratingRank
    return {
      pickNo: pick.pickNo,
      round: pick.round,
      slotId: pick.slotId,
      poolEntryId: pick.poolEntryId,
      userId: pick.userId,
      rating: rating === null ? null : Math.round(rating * 100),
      ratingRank,
      delta,
      verdict:
        delta === null
          ? null
          : delta <= -threshold
            ? "reach"
            : delta >= threshold
              ? "steal"
              : "fair",
      seconds: pick.auto ? null : (durations.get(pick.pickNo) ?? null),
      auto: pick.auto,
      forced: pick.forced,
    }
  })

  const withDelta = picks.filter(
    (p): p is PickAnalysis & { delta: number } => p.delta !== null
  )
  const reaches = withDelta
    .filter((p) => p.verdict === "reach")
    .sort((a, b) => a.delta - b.delta || a.pickNo - b.pickNo)
    .slice(0, ANALYTICS_HIGHLIGHTS)
  const steals = withDelta
    .filter((p) => p.verdict === "steal")
    .sort((a, b) => b.delta - a.delta || a.pickNo - b.pickNo)
    .slice(0, ANALYTICS_HIGHLIGHTS)

  const timed = picks.flatMap((p) =>
    p.seconds === null ? [] : [{ pickNo: p.pickNo, seconds: p.seconds }]
  )
  const slowest = timed.reduce<{ pickNo: number; seconds: number } | null>(
    (best, p) => (best === null || p.seconds > best.seconds ? p : best),
    null
  )

  return {
    picks,
    threshold,
    reaches,
    steals,
    timing: {
      measured: timed.length,
      averageSeconds: average(timed.map((p) => p.seconds)),
      medianSeconds: median(timed.map((p) => p.seconds)),
      slowest,
      perTeam: state.slots.map((slot) => {
        const own = picks.filter((p) => p.slotId === slot.slotId)
        return {
          slotId: slot.slotId,
          teamName: slot.teamName,
          picks: own.length,
          averageSeconds: average(
            own.flatMap((p) => (p.seconds === null ? [] : [p.seconds]))
          ),
        }
      }),
    },
    autoPicks: {
      count: picks.filter((p) => p.auto).length,
      rate:
        picks.length === 0
          ? 0
          : picks.filter((p) => p.auto).length / picks.length,
      timerSkips: events.filter(
        (e) => e.type === "skipped" && e.payload.reason === "timer_skip"
      ).length,
      forced: picks.filter((p) => p.forced).length,
    },
  }
}
