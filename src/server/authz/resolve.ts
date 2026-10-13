import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  goalGroups,
  goals,
  goalValues,
  submissions,
  teams,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import { AuthzError } from "./errors"
import { requireEventManager, requireSession } from "./guards"

/**
 * Resolvers: derive the Event that owns a Board, Tile, Goal, Submission or Team
 * from the database, so callers never trust a client supplied eventId. They
 * throw `AuthzError` (NOT_FOUND) when the row does not exist.
 */

const notFound = (what: string) =>
  new AuthzError(`${what} not found`, "NOT_FOUND")

export async function eventIdOfBingo(bingoId: string): Promise<string> {
  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    columns: { eventId: true },
  })
  if (!bingo) throw notFound("Bingo")
  return bingo.eventId
}

export async function eventIdOfTile(tileId: string): Promise<string> {
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
    columns: { bingoId: true },
    with: { bingo: { columns: { eventId: true } } },
  })
  if (!tile) throw notFound("Tile")
  return tile.bingo.eventId
}

export async function eventIdOfGoal(goalId: string): Promise<string> {
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
  if (!goal) throw notFound("Goal")
  return goal.tile.bingo.eventId
}

export async function eventIdOfGoalGroup(groupId: string): Promise<string> {
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
  if (!group) throw notFound("Goal group")
  return group.tile.bingo.eventId
}

export async function eventIdOfGoalValue(goalValueId: string): Promise<string> {
  const value = await db.query.goalValues.findFirst({
    where: eq(goalValues.id, goalValueId),
    columns: { goalId: true },
  })
  if (!value) throw notFound("Goal value")
  return eventIdOfGoal(value.goalId)
}

export async function eventIdOfTeamTileSubmission(
  teamTileSubmissionId: string
): Promise<string> {
  const record = await db.query.teamTileSubmissions.findFirst({
    where: eq(teamTileSubmissions.id, teamTileSubmissionId),
    columns: { tileId: true },
  })
  if (!record) throw notFound("Team tile submission")
  return eventIdOfTile(record.tileId)
}

export async function eventIdOfSubmission(
  submissionId: string
): Promise<string> {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { teamTileSubmissionId: true },
  })
  if (!submission) throw notFound("Submission")
  return eventIdOfTeamTileSubmission(submission.teamTileSubmissionId)
}

export async function eventIdOfTeam(teamId: string): Promise<string> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { eventId: true },
  })
  if (!team) throw notFound("Team")
  return team.eventId
}

/** Throws unless the Goal belongs to a Tile of the given Event. */
export async function assertGoalInEvent(
  goalId: string,
  eventId: string
): Promise<void> {
  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
    columns: { id: true },
    with: {
      tile: {
        columns: { id: true },
        with: { bingo: { columns: { eventId: true } } },
      },
    },
  })
  if (!goal || goal.tile.bingo.eventId !== eventId) {
    throw notFound("Goal")
  }
}

// ---------------------------------------------------------------------------
// Existing "manager of the Event that owns X" helpers (compatibility shim):
// resolve the Event, then require admin/management. Each returns the eventId.
// The session is checked first so anonymous callers never reach the database.
// ---------------------------------------------------------------------------

async function requireManagerOf(
  resolveEventId: () => Promise<string>
): Promise<string> {
  await requireSession()
  return requireEventManager(await resolveEventId())
}

export const requireBingoAdmin = (bingoId: string) =>
  requireManagerOf(() => eventIdOfBingo(bingoId))

export const requireBingoAdminForTile = (tileId: string) =>
  requireManagerOf(() => eventIdOfTile(tileId))

export const requireBingoAdminForGoal = (goalId: string) =>
  requireManagerOf(() => eventIdOfGoal(goalId))

export const requireBingoAdminForGoalGroup = (groupId: string) =>
  requireManagerOf(() => eventIdOfGoalGroup(groupId))

export const requireBingoAdminForGoalValue = (goalValueId: string) =>
  requireManagerOf(() => eventIdOfGoalValue(goalValueId))

export const requireBingoAdminForTeamTileSubmission = (
  teamTileSubmissionId: string
) => requireManagerOf(() => eventIdOfTeamTileSubmission(teamTileSubmissionId))

export const requireBingoAdminForSubmission = (submissionId: string) =>
  requireManagerOf(() => eventIdOfSubmission(submissionId))
