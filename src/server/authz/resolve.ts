import "server-only"

import { eq } from "drizzle-orm"

import type { Permission } from "@/lib/authz/permissions"
import type { PolicyResource } from "@/lib/authz/policy"
import { db } from "@/server/db"
import {
  bingos,
  discordWebhooks,
  drafts,
  eventRegistrationRequests,
  goalGroups,
  goals,
  goalValues,
  submissions,
  teams,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import { isUuid } from "./actor"
import { AuthzError } from "./errors"
import { requirePermission, requireSession } from "./guards"

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

export async function eventIdOfDraft(draftId: string): Promise<string> {
  // A malformed id cannot match a draft; the database would reject the cast.
  if (!isUuid(draftId)) throw notFound("Draft")
  const draft = await db.query.drafts.findFirst({
    where: eq(drafts.id, draftId),
    columns: { eventId: true },
  })
  if (!draft) throw notFound("Draft")
  return draft.eventId
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

export async function eventIdOfWebhook(webhookId: string): Promise<string> {
  const webhook = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.id, webhookId),
    columns: { eventId: true },
  })
  if (!webhook) throw notFound("Webhook")
  return webhook.eventId
}

export async function eventIdOfRegistrationRequest(
  requestId: string
): Promise<string> {
  const request = await db.query.eventRegistrationRequests.findFirst({
    where: eq(eventRegistrationRequests.id, requestId),
    columns: { eventId: true },
  })
  if (!request) throw notFound("Registration request")
  return request.eventId
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
// "May the caller do <permission> in the Event that owns X?": resolve the Event
// from X, then require the permission. Each returns the eventId. The session is
// checked first so anonymous callers never reach the database. A missing X is
// NOT_FOUND, a caller without the permission FORBIDDEN.
// ---------------------------------------------------------------------------

async function requireOn(
  resolveEventId: () => Promise<string>,
  permission: Permission,
  resource?: PolicyResource
): Promise<string> {
  await requireSession()
  const eventId = await resolveEventId()
  await requirePermission(eventId, permission, resource)
  return eventId
}

export const requirePermissionForEvent = (
  eventId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(async () => eventId, permission, resource)

export const requirePermissionForBingo = (
  bingoId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfBingo(bingoId), permission, resource)

export const requirePermissionForTile = (
  tileId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfTile(tileId), permission, resource)

export const requirePermissionForGoal = (
  goalId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfGoal(goalId), permission, resource)

export const requirePermissionForGoalGroup = (
  groupId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfGoalGroup(groupId), permission, resource)

export const requirePermissionForGoalValue = (
  goalValueId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfGoalValue(goalValueId), permission, resource)

export const requirePermissionForTeamTileSubmission = (
  teamTileSubmissionId: string,
  permission: Permission,
  resource?: PolicyResource
) =>
  requireOn(
    () => eventIdOfTeamTileSubmission(teamTileSubmissionId),
    permission,
    resource
  )

export const requirePermissionForSubmission = (
  submissionId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfSubmission(submissionId), permission, resource)

export const requirePermissionForTeam = (
  teamId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfTeam(teamId), permission, resource)

export const requirePermissionForWebhook = (
  webhookId: string,
  permission: Permission,
  resource?: PolicyResource
) => requireOn(() => eventIdOfWebhook(webhookId), permission, resource)

export const requirePermissionForRegistrationRequest = (
  requestId: string,
  permission: Permission,
  resource?: PolicyResource
) =>
  requireOn(() => eventIdOfRegistrationRequest(requestId), permission, resource)
