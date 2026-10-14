import {
  DISPLAY_BALANCING_WEIGHTS,
  calculateMean,
  calculatePlayerScore,
} from "@/lib/team-balancing/scoring"

/**
 * Draft rating: the team balancing score (`calculatePlayerScore` with the
 * weights the balance metrics display uses), computed over the pool. It is
 * recorded with each pool entry together with this source tag, so a future
 * change of the formula stays distinguishable from drafts rated today.
 */
export const DRAFT_RATING_SOURCE = "team_balancing_v1"

export interface DraftRatingInput {
  userId: string
  /**
   * The player's Wise Old Man based metadata in this Event, or null when they
   * have none. A player without data (null, or no EHP and no EHB) is unrated.
   */
  metadata: {
    ehp: number | null
    ehb: number | null
    dailyHoursAvailable: number | null
  } | null
}

export interface DraftRating {
  userId: string
  /** 0..1, or null for an unrated player. */
  rating: number | null
}

/**
 * Rates the pool. Missing values of rated players are replaced by the pool
 * mean before the percentile ranking; unrated players get `null` and do not
 * take part in the ranking, so they cannot shift anyone else's rating.
 */
export function rateDraftPool(players: DraftRatingInput[]): DraftRating[] {
  const rated = players.filter(
    (p) =>
      p.metadata !== null &&
      (p.metadata.ehp !== null || p.metadata.ehb !== null)
  )
  const meanEhp = calculateMean(rated.map((p) => p.metadata!.ehp))
  const meanEhb = calculateMean(rated.map((p) => p.metadata!.ehb))
  const meanHours = calculateMean(
    rated.map((p) => p.metadata!.dailyHoursAvailable)
  )

  const imputed = new Map(
    rated.map((p) => [
      p.userId,
      {
        ehp: p.metadata!.ehp ?? meanEhp,
        ehb: p.metadata!.ehb ?? meanEhb,
        dailyHoursAvailable: p.metadata!.dailyHoursAvailable ?? meanHours,
        timezone: null,
      },
    ])
  )
  const all = [...imputed.values()]

  return players.map((p) => {
    const own = imputed.get(p.userId)
    return {
      userId: p.userId,
      rating: own
        ? calculatePlayerScore(own, all, DISPLAY_BALANCING_WEIGHTS).score
        : null,
    }
  })
}
