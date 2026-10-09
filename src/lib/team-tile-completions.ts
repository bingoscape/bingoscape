import { and, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { db } from "@/server/db"
import {
  bingos,
  teams,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import { LAG, TS_FORMAT, type DropCursor } from "@/lib/team-drops"

export interface TeamTileCompletion {
  id: string
  completedAt: string
  eventId: string
  bingoId: string
  teamId: string
  teamName: string
  tileId: string
  tileTitle: string
  tile: { points: number; tier: number }
}

/**
 * Completed tiles of the given teams after the cursor, ordered (completedAt, id).
 * Includes the caller's own completions. Callers must pass team ids derived from
 * the caller's memberships.
 */
export async function fetchTeamTileCompletions(params: {
  teamIds: string[]
  after: DropCursor
  limit: number
}): Promise<{ completions: TeamTileCompletion[]; hasMore: boolean }> {
  const { teamIds, after, limit } = params
  if (teamIds.length === 0) return { completions: [], hasMore: false }

  const rows = await db
    .select({
      id: teamTileSubmissions.id,
      completedAt: sql<string>`to_char(${teamTileSubmissions.completedAt}, ${TS_FORMAT})`,
      eventId: bingos.eventId,
      bingoId: bingos.id,
      teamId: teams.id,
      teamName: teams.name,
      tileId: tiles.id,
      tileTitle: tiles.title,
      points: tiles.weight,
      tier: tiles.tier,
    })
    .from(teamTileSubmissions)
    .innerJoin(teams, eq(teams.id, teamTileSubmissions.teamId))
    .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
    .innerJoin(bingos, eq(bingos.id, tiles.bingoId))
    .where(
      and(
        inArray(teamTileSubmissions.teamId, teamIds),
        eq(teamTileSubmissions.status, "completed"),
        isNotNull(teamTileSubmissions.completedAt),
        eq(bingos.visible, true),
        sql`${teamTileSubmissions.completedAt} < now() - ${LAG}`,
        sql`(${teamTileSubmissions.completedAt}, ${teamTileSubmissions.id}) > (${after.t}::timestamp, ${after.id}::uuid)`
      )
    )
    .orderBy(teamTileSubmissions.completedAt, teamTileSubmissions.id)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const completions: TeamTileCompletion[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    completedAt: r.completedAt,
    eventId: r.eventId,
    bingoId: r.bingoId,
    teamId: r.teamId,
    teamName: r.teamName,
    tileId: r.tileId,
    tileTitle: r.tileTitle,
    tile: { points: r.points, tier: r.tier },
  }))
  return { completions, hasMore }
}
