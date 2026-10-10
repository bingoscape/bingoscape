/**
 * Team leaderboard ranking. XP comes from `getEventStats` (Tile XP plus
 * pattern Bonuses); Teams without any XP yet are still listed.
 */

export interface LeaderboardTeam {
  id: string
  name: string
  memberCount?: number
}

export interface TeamPoints {
  teamId: string
  totalXP: number
  baseXP?: number
  bonusXP?: number
}

export interface LeaderboardRow {
  teamId: string
  name: string
  xp: number
  baseXP: number
  bonusXP: number
  memberCount?: number
  /** 1-based; Teams with equal XP share a rank (1, 1, 3). */
  rank: number
}

export function buildLeaderboard(
  teams: LeaderboardTeam[],
  points: TeamPoints[]
): LeaderboardRow[] {
  const byTeam = new Map(points.map((p) => [p.teamId, p]))

  const rows = teams.map((team) => {
    const p = byTeam.get(team.id)
    const xp = p?.totalXP ?? 0
    return {
      teamId: team.id,
      name: team.name,
      xp,
      baseXP: p?.baseXP ?? xp,
      bonusXP: p?.bonusXP ?? 0,
      memberCount: team.memberCount,
      rank: 0,
    }
  })

  rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))

  rows.forEach((row, index) => {
    const previous = rows[index - 1]
    row.rank = previous && previous.xp === row.xp ? previous.rank : index + 1
  })

  return rows
}
