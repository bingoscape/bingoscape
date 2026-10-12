import { and, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getUserRole } from "@/app/actions/events"
import {
  bingos,
  goalGroups,
  goals,
  goalValues,
  submissions,
  teamMembers,
  teams,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"

/**
 * Server-side authorization helpers for Board, Tile and Goal mutations.
 *
 * Rules:
 * - The Event is always derived from the database (from the Tile, Goal, ...
 *   being mutated), never from a client supplied eventId.
 * - "Manager" means the caller holds the `admin` or `management` role for that
 *   Event (see `getUserRole`).
 * - Helpers throw `AuthzError`; server actions convert it into
 *   `{ success: false, error }` via `authzErrorMessage`.
 *
 * This file is intentionally not a "use server" module: the helpers are not
 * callable from the client.
 */

export class AuthzError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthzError"
  }
}

const UNAUTHORIZED = "Unauthorized"
const FORBIDDEN = "Forbidden: admin or management role required"

/** Returns the AuthzError message, or the fallback for any other error. */
export function authzErrorMessage(error: unknown, fallback: string): string {
  return error instanceof AuthzError ? error.message : fallback
}

async function requireSession(): Promise<{ userId: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) throw new AuthzError(UNAUTHORIZED)
  return { userId: session.user.id }
}

/**
 * Requires a signed-in admin/management member of the given Event.
 * Returns the eventId on success.
 */
export async function requireEventManager(eventId: string): Promise<string> {
  await requireSession()
  const role = await getUserRole(eventId)
  if (role !== "admin" && role !== "management") {
    throw new AuthzError(FORBIDDEN)
  }
  return eventId
}

/** True when the signed-in caller manages the Event (admin or management). */
export async function isEventManager(eventId: string): Promise<boolean> {
  const role = await getUserRole(eventId)
  return role === "admin" || role === "management"
}

/** Requires admin/management for the Event that owns the Board. Returns eventId. */
export async function requireBingoAdmin(bingoId: string): Promise<string> {
  await requireSession()

  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    columns: { eventId: true },
  })
  if (!bingo) throw new AuthzError("Bingo not found")

  return requireEventManager(bingo.eventId)
}

/** Requires admin/management for the Event that owns the Tile. Returns eventId. */
export async function requireBingoAdminForTile(
  tileId: string
): Promise<string> {
  await requireSession()

  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
    columns: { bingoId: true },
    with: { bingo: { columns: { eventId: true } } },
  })
  if (!tile) throw new AuthzError("Tile not found")

  return requireEventManager(tile.bingo.eventId)
}

/** Requires admin/management for the Event that owns the Goal. Returns eventId. */
export async function requireBingoAdminForGoal(
  goalId: string
): Promise<string> {
  await requireSession()

  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
    columns: { tileId: true },
    with: {
      tile: {
        columns: { bingoId: true },
        with: { bingo: { columns: { eventId: true } } },
      },
    },
  })
  if (!goal) throw new AuthzError("Goal not found")

  return requireEventManager(goal.tile.bingo.eventId)
}

/** Requires admin/management for the Event that owns the Goal group. Returns eventId. */
export async function requireBingoAdminForGoalGroup(
  groupId: string
): Promise<string> {
  await requireSession()

  const group = await db.query.goalGroups.findFirst({
    where: eq(goalGroups.id, groupId),
    columns: { tileId: true },
    with: {
      tile: {
        columns: { bingoId: true },
        with: { bingo: { columns: { eventId: true } } },
      },
    },
  })
  if (!group) throw new AuthzError("Goal group not found")

  return requireEventManager(group.tile.bingo.eventId)
}

/** Requires admin/management for the Event that owns the Goal value. Returns eventId. */
export async function requireBingoAdminForGoalValue(
  goalValueId: string
): Promise<string> {
  await requireSession()

  const value = await db.query.goalValues.findFirst({
    where: eq(goalValues.id, goalValueId),
    columns: { goalId: true },
  })
  if (!value) throw new AuthzError("Goal value not found")

  return requireBingoAdminForGoal(value.goalId)
}

/**
 * Requires admin/management for the Event that owns a team's Tile
 * submission record (teamTileSubmissions row). Returns eventId.
 */
export async function requireBingoAdminForTeamTileSubmission(
  teamTileSubmissionId: string
): Promise<string> {
  await requireSession()

  const record = await db.query.teamTileSubmissions.findFirst({
    where: eq(teamTileSubmissions.id, teamTileSubmissionId),
    columns: { tileId: true },
  })
  if (!record) throw new AuthzError("Team tile submission not found")

  return requireBingoAdminForTile(record.tileId)
}

/** Requires admin/management for the Event that owns the Submission. Returns eventId. */
export async function requireBingoAdminForSubmission(
  submissionId: string
): Promise<string> {
  await requireSession()

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { teamTileSubmissionId: true },
  })
  if (!submission) throw new AuthzError("Submission not found")

  return requireBingoAdminForTeamTileSubmission(submission.teamTileSubmissionId)
}

/**
 * Requires that the caller is a member of the Team, or admin/management of the
 * Event that owns the Team (derived from the Team row). Returns eventId.
 */
export async function requireTeamMemberOrManager(
  teamId: string
): Promise<string> {
  const { userId } = await requireSession()

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { eventId: true },
  })
  if (!team) throw new AuthzError("Team not found")

  if (await isEventManager(team.eventId)) return team.eventId

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    columns: { id: true },
  })
  if (!membership) throw new AuthzError("Forbidden: not a member of this team")

  return team.eventId
}

/**
 * Requires that the caller leads the Team, or is admin/management of the Event
 * that owns the Team (derived from the Team row). Plain Team members and
 * members of other Teams are denied. Returns eventId.
 */
export async function assertTeamLeaderOrManager(
  teamId: string
): Promise<string> {
  const { userId } = await requireSession()

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { eventId: true },
  })
  if (!team) throw new AuthzError("Team not found")

  if (await isEventManager(team.eventId)) return team.eventId

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    columns: { isLeader: true },
  })
  if (!membership) throw new AuthzError("Forbidden: not a member of this team")
  if (!membership.isLeader) {
    throw new AuthzError(
      "Forbidden: only the team leader or an event manager can do this"
    )
  }

  return team.eventId
}

/**
 * Whether the caller may read the content of the Tile. Hidden Tiles are only
 * readable by admin/management of the owning Event. Unknown Tiles are not
 * readable.
 */
export async function canReadTile(tileId: string): Promise<boolean> {
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
    columns: { isHidden: true },
    with: { bingo: { columns: { eventId: true } } },
  })
  if (!tile) return false
  if (!tile.isHidden) return true
  return isEventManager(tile.bingo.eventId)
}

/** Like canReadTile but starting from a Goal. */
export async function canReadGoal(goalId: string): Promise<boolean> {
  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
    columns: { tileId: true },
  })
  if (!goal) return false
  return canReadTile(goal.tileId)
}
