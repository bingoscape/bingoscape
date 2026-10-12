import type { ShipRule } from "@/server/db/schema"
import type { BattleshipMarkIds } from "@/lib/battleship-marks"

/**
 * What the event workspace needs to know about the active Board when it is a
 * battleship Board. Computed by the Server Component; the client never fetches
 * it. `null`/absent for every other Board.
 */
export interface BattleshipWorkspaceInfo {
  bingoId: string
  /** The fleet every team has to place (merged by length). */
  rules: ShipRule[]
  /** The Event has started: ships and rules are locked for good. */
  started: boolean
  /** The Team the viewer leads in this Event, if any. */
  ledTeamId: string | null
  /**
   * Hits, misses and sunk ships of the VIEWER's own Team (never an opponent's
   * view, never ship positions). Empty before the start, for managers who are
   * on no Team and for anonymous viewers.
   */
  marks: BattleshipMarkIds
}

/**
 * The Team whose ships the viewer may place from the Board header, or null when
 * the viewer may not place ships at all. Team leaders place their own Team's
 * ships; managers place for the Team they are looking at (or the first one).
 * The placement page and the save action authorize again.
 */
export function placeShipsTeamId({
  isManagement,
  ledTeamId,
  viewedTeamId,
  teamIds,
}: {
  isManagement: boolean
  ledTeamId: string | null
  viewedTeamId: string | undefined
  teamIds: string[]
}): string | null {
  if (isManagement) {
    if (viewedTeamId && teamIds.includes(viewedTeamId)) return viewedTeamId
    return teamIds[0] ?? null
  }
  return ledTeamId
}
