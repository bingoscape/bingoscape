import "server-only"

import { and, eq } from "drizzle-orm"

import type { db } from "@/server/db"
import {
  goals,
  submissions,
  teamGoalProgress,
  teamTileSubmissions,
} from "@/server/db/schema"
import { checkAndAutoCompleteTile } from "@/server/tile-completion"

/**
 * Re-derives a Team's progress on a Goal from its approved Submissions and
 * auto-completes the Tile when that finishes it. Not a "use server" module: it
 * takes a transaction and writes progress, so it must never be callable from
 * the client. Callers authorize first.
 */

type DbOrTransaction =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recalculateGoalProgress(
  tx: DbOrTransaction,
  targetGoalId: string,
  teamId: string
) {
  const approvedSubmissions = await tx
    .select({
      submissionValue: submissions.submissionValue,
    })
    .from(submissions)
    .innerJoin(
      teamTileSubmissions,
      eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
    )
    .where(
      and(
        eq(submissions.goalId, targetGoalId),
        eq(submissions.status, "approved"),
        eq(teamTileSubmissions.teamId, teamId)
      )
    )

  const totalValue = approvedSubmissions.reduce(
    (sum: number, s: { submissionValue: number | null }) =>
      sum + (s.submissionValue || 0),
    0
  )

  const progress = await tx.query.teamGoalProgress.findFirst({
    where: and(
      eq(teamGoalProgress.goalId, targetGoalId),
      eq(teamGoalProgress.teamId, teamId)
    ),
  })

  if (progress) {
    await tx
      .update(teamGoalProgress)
      .set({
        currentValue: totalValue,
        updatedAt: new Date(),
      })
      .where(eq(teamGoalProgress.id, progress.id))
  } else if (totalValue > 0) {
    await tx.insert(teamGoalProgress).values({
      goalId: targetGoalId,
      teamId: teamId,
      currentValue: totalValue,
    })
  }

  // Evaluate if the tile should be auto-completed based on updated progress
  const goal = await tx.query.goals.findFirst({
    where: eq(goals.id, targetGoalId),
  })
  if (goal) {
    await checkAndAutoCompleteTile(tx, goal.tileId, teamId)
  }
}
