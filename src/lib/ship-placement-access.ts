/**
 * Who may place ships for which team, decided from plain data so it can be
 * tested without a database. The placement page uses it to pick the team and
 * to choose between the page, a 404 and a "no access" message; the server
 * still authorizes with `assertTeamLeaderOrManager` before it reads or writes
 * anything, so this is never the only check.
 */

export type PlacementAccessInput = {
  bingoType: string
  /** The viewer is admin or management of the Event. */
  isManager: boolean
  /** The Team the viewer leads in this Event, if any. */
  ledTeamId: string | null
  /** The Teams of the Event, in display order. */
  teamIds: string[]
  /** `?teamId=` of the request. */
  requestedTeamId: string | null
}

export type PlacementAccess =
  | {
      ok: true
      teamId: string
      /** Managers can switch between the teams of the Event. */
      canSwitchTeam: boolean
    }
  | {
      ok: false
      reason: "not-battleship" | "no-access" | "team-not-found" | "no-team"
    }

export function resolvePlacementAccess(
  input: PlacementAccessInput
): PlacementAccess {
  if (input.bingoType !== "battleship") {
    return { ok: false, reason: "not-battleship" }
  }

  if (input.isManager) {
    if (input.requestedTeamId !== null) {
      return input.teamIds.includes(input.requestedTeamId)
        ? {
            ok: true,
            teamId: input.requestedTeamId,
            canSwitchTeam: input.teamIds.length > 1,
          }
        : { ok: false, reason: "team-not-found" }
    }
    const first = input.teamIds[0]
    return first === undefined
      ? { ok: false, reason: "no-team" }
      : { ok: true, teamId: first, canSwitchTeam: input.teamIds.length > 1 }
  }

  // A leader places their own team's ships, nothing else.
  if (input.ledTeamId === null) return { ok: false, reason: "no-access" }
  if (
    input.requestedTeamId !== null &&
    input.requestedTeamId !== input.ledTeamId
  ) {
    return { ok: false, reason: "no-access" }
  }
  return { ok: true, teamId: input.ledTeamId, canSwitchTeam: false }
}
