import type { DraftPlayerInfo, DraftState } from "./types"

/**
 * Live balance of a draft (team draft 4/4, #218): how even the teams are over
 * the picks made so far. Pure, computed on the client from the same state the
 * room renders, so it updates with every pick.
 *
 * Ratings are the frozen 0..1 snapshots of the pool, shown here out of 100.
 * Captains carry no rating (they are not in the pool), so a team's sum and
 * mean are over its drafted players only; a player without data is
 * "unrated" and is left out of both (counted in `unrated`).
 */

export interface TeamBalance {
  slotId: string
  teamName: string
  /** Captain plus drafted players. */
  size: number
  /** Drafted players with a rating / without. */
  rated: number
  unrated: number
  /** Sum of the drafted players' ratings, out of 100 per player. */
  ratingSum: number
  /** Mean rating of the rated players; null when there is none yet. */
  ratingMean: number | null
  /** Drafted players who are in the pool's top `topK` by rating. */
  topPlayers: number
  timezones: TimezoneCoverage
}

export interface TimezoneCoverage {
  /** Distinct UTC offsets in whole hours among members with a timezone, ascending. */
  offsets: number[]
  /** Labels of `offsets`, e.g. "UTC-5". */
  labels: string[]
  /** Members whose timezone is not known. */
  unknown: number
}

export interface Spread {
  /** Population standard deviation across teams. */
  stdev: number
  /** Highest minus lowest. */
  spread: number
}

export interface DraftBalance {
  teams: TeamBalance[]
  /** How many of the pool's best players count as "top" (2 per team). */
  topK: number
  ratingSum: Spread
  /** Over the teams that have a mean already. */
  ratingMean: Spread
}

const POINTS = 100

/** Standard deviation and range of `values` (0 and 0 for fewer than two). */
export function spreadOf(values: readonly number[]): Spread {
  if (values.length < 2) return { stdev: 0, spread: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return {
    stdev: Math.sqrt(variance),
    spread: Math.max(...values) - Math.min(...values),
  }
}

/** "UTC", "UTC+1", "UTC-5" for a whole-hour offset east of UTC. */
export function offsetLabel(offset: number): string {
  if (offset === 0) return "UTC"
  return `UTC${offset > 0 ? "+" : "-"}${Math.abs(offset)}`
}

export function computeBalance(
  state: Pick<DraftState, "slots" | "pool" | "picks">,
  players: ReadonlyMap<string, DraftPlayerInfo>
): DraftBalance {
  const topK = Math.min(
    state.slots.length * 2,
    state.pool.filter((entry) => entry.rating !== null).length
  )
  // The pool's best players, ties settled by entry id so it is deterministic.
  const top = new Set(
    state.pool
      .filter((entry) => entry.rating !== null)
      .sort(
        (a, b) =>
          b.rating! - a.rating! || a.poolEntryId.localeCompare(b.poolEntryId)
      )
      .slice(0, topK)
      .map((entry) => entry.poolEntryId)
  )
  const ratingOf = new Map(state.pool.map((e) => [e.poolEntryId, e.rating]))

  const teams = state.slots.map((slot): TeamBalance => {
    const picks = state.picks.filter((pick) => pick.slotId === slot.slotId)
    const ratings = picks.flatMap((pick) => {
      const rating = ratingOf.get(pick.poolEntryId)
      return rating === null || rating === undefined ? [] : [rating * POINTS]
    })
    const memberIds = [slot.captainUserId, ...picks.map((pick) => pick.userId)]
    const offsets = new Set<number>()
    let unknown = 0
    for (const id of memberIds) {
      const offset = id ? players.get(id)?.utcOffset : null
      if (offset === null || offset === undefined) unknown += 1
      else offsets.add(Math.round(offset))
    }
    const sorted = [...offsets].sort((a, b) => a - b)
    const ratingSum = ratings.reduce((a, b) => a + b, 0)
    return {
      slotId: slot.slotId,
      teamName: slot.teamName,
      size: 1 + picks.length,
      rated: ratings.length,
      unrated: picks.length - ratings.length,
      ratingSum,
      ratingMean: ratings.length > 0 ? ratingSum / ratings.length : null,
      topPlayers: picks.filter((pick) => top.has(pick.poolEntryId)).length,
      timezones: {
        offsets: sorted,
        labels: sorted.map(offsetLabel),
        unknown,
      },
    }
  })

  return {
    teams,
    topK,
    ratingSum: spreadOf(teams.map((t) => t.ratingSum)),
    ratingMean: spreadOf(
      teams.flatMap((t) => (t.ratingMean === null ? [] : [t.ratingMean]))
    ),
  }
}
