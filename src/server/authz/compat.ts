import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { isBlindBoard } from "@/server/blind-board"
import {
  goals,
  submissions,
  teamMembers,
  teams,
  tiles,
} from "@/server/db/schema"
import { AuthzError } from "./errors"
import { isEventManager, requireSession } from "./guards"

/**
 * Existing Team, Submission-comment and Tile-readability helpers, kept with
 * their original queries and messages until their call sites move to the
 * policy layer.
 */

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
 * Who may read the review comments of a Submission: the managers of the Event
 * that owns it, and the members of the Team the Submission belongs to (the
 * comments tell them why a Tile was not accepted). The Tile must also be
 * readable for the caller (hidden Tiles, Blind Tiles). Everybody else, other
 * Teams included, gets "not found". Returns whether the caller is a manager.
 */
export async function requireSubmissionCommentReader(
  submissionId: string
): Promise<{ isManager: boolean }> {
  const { userId } = await requireSession()

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true },
    with: {
      teamTileSubmission: {
        columns: { teamId: true, tileId: true },
        with: {
          tile: {
            columns: { id: true },
            with: { bingo: { columns: { eventId: true } } },
          },
        },
      },
    },
  })
  if (!submission) throw new AuthzError("Submission not found")

  const { teamId, tileId, tile } = submission.teamTileSubmission
  if (await isEventManager(tile.bingo.eventId)) return { isManager: true }

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    columns: { id: true },
  })
  if (!membership || !(await canReadTile(tileId))) {
    throw new AuthzError("Submission not found")
  }
  return { isManager: false }
}

/**
 * Whether the caller may read the content of the Tile. Hidden Tiles, and the
 * Tiles of a battleship Board before its Event starts (blind Tiles), are only
 * readable by admin/management of the owning Event. Unknown Tiles are not
 * readable.
 */
export async function canReadTile(tileId: string): Promise<boolean> {
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
    columns: { isHidden: true },
    with: {
      bingo: {
        columns: { eventId: true, bingoType: true },
        with: { event: { columns: { startDate: true } } },
      },
    },
  })
  if (!tile) return false

  const blind = isBlindBoard({
    bingoType: tile.bingo.bingoType,
    startDate: tile.bingo.event.startDate,
    isManager: false,
  })
  if (!tile.isHidden && !blind) return true
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
