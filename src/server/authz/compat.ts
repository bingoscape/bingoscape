import "server-only"

import { eq } from "drizzle-orm"

import { can } from "@/lib/authz/policy"
import { db } from "@/server/db"
import { submissions } from "@/server/db/schema"
import { AuthzError } from "./errors"
import { authorize, requirePermission, requireSession } from "./guards"
import { canReadTile } from "./read"
import { eventIdOfTeam } from "./resolve"

/**
 * Team and Submission-comment guards. Each resolves the Event from the row it
 * is given and asks the policy; the permission map says who gets through.
 */

/**
 * Requires that the caller is a member of the Team, or may access every Team of
 * the Event that owns it (`team:access`). Returns eventId.
 */
export async function requireTeamMemberOrManager(
  teamId: string
): Promise<string> {
  await requireSession()
  const eventId = await eventIdOfTeam(teamId)
  await requirePermission(eventId, "team:access", { teamId })
  return eventId
}

/**
 * Requires that the caller leads the Team, or may lead every Team of the Event
 * that owns it (`team:lead`). Plain Team members and members of other Teams are
 * denied. Returns eventId.
 */
export async function assertTeamLeaderOrManager(
  teamId: string
): Promise<string> {
  await requireSession()
  const eventId = await eventIdOfTeam(teamId)
  await requirePermission(eventId, "team:lead", { teamId })
  return eventId
}

/**
 * Who may read the review comments of a Submission (`submission:read-comments`):
 * the managers of the Event that owns it, and the members of the Team the
 * Submission belongs to (the comments tell them why a Tile was not accepted).
 * The Tile must also be readable for the caller (hidden Tiles, Blind Tiles).
 * Everybody else, other Teams included, gets NOT_FOUND. Returns whether the
 * caller may also write comments (is a manager).
 *
 * Epic decision 7 (managers only, or also the owning Team?) is pending; this
 * keeps what the code did: the owning Team reads, only managers write.
 */
export async function requireSubmissionCommentReader(
  submissionId: string
): Promise<{ isManager: boolean }> {
  await requireSession()

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
  if (!submission) throw new AuthzError("Submission not found", "NOT_FOUND")

  const { teamId, tileId, tile } = submission.teamTileSubmission
  const result = await authorize(tile.bingo.eventId, "submission:read-comments", {
    teamId,
  })
  if (!result.success) {
    // No enumeration: a forbidden Submission looks like a missing one.
    throw new AuthzError(
      result.code === "UNAUTHENTICATED" ? result.error : "Submission not found",
      result.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "NOT_FOUND"
    )
  }

  const isManager = can(result.actor, "submission:comment")
  if (!isManager && !(await canReadTile(tileId))) {
    throw new AuthzError("Submission not found", "NOT_FOUND")
  }
  return { isManager }
}
