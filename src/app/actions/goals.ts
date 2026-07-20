"use server"

import { db } from "@/server/db"
import { goalValues, submissions, teamGoalProgress, teamTileSubmissions, goals } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

export interface GoalValue {
  id: string
  goalId: string
  value: number
  description: string
  createdAt: Date
  updatedAt: Date
}

export async function addGoalValue(
  goalId: string,
  value: number,
  description: string
) {
  try {
    const [newGoalValue] = await db
      .insert(goalValues)
      .values({
        goalId,
        value,
        description,
      })
      .returning()

    // revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true, goalValue: newGoalValue }
  } catch (error) {
    logger.error(
      { error, goalId, value, description },
      "Error adding goal value"
    )
    return { success: false, error: "Failed to add goal value" }
  }
}

export async function deleteGoalValue(goalValueId: string) {
  try {
    await db.delete(goalValues).where(eq(goalValues.id, goalValueId))

    // revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    logger.error({ error, goalValueId }, "Error deleting goal value")
    return { success: false, error: "Failed to delete goal value" }
  }
}

export async function getGoalValues(goalId: string): Promise<GoalValue[]> {
  try {
    const values = await db.query.goalValues.findMany({
      where: eq(goalValues.goalId, goalId),
      orderBy: (goalValues, { asc }) => [asc(goalValues.value)],
    })

    return values as GoalValue[]
  } catch (error) {
    logger.error({ error, goalId }, "Error fetching goal values")
    return []
  }
}

type DbOrTransaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recalculateGoalProgress(tx: DbOrTransaction, targetGoalId: string, teamId: string) {
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
    (sum: number, s: { submissionValue: number | null }) => sum + (s.submissionValue || 0),
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
    const { checkAndAutoCompleteTile } = await import("./tile-completion")
    await checkAndAutoCompleteTile(goal.tileId, teamId)
  }
}

export async function updateSubmissionGoalAndValue(
  submissionId: string,
  goalId: string | null,
  submissionValue: number
) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Fetch current submission to get the old goalId
      const currentSubmission = await tx.query.submissions.findFirst({
        where: eq(submissions.id, submissionId),
      })

      if (!currentSubmission) {
        throw new Error("Submission not found")
      }

      const oldGoalId = currentSubmission.goalId

      // Get team info for the progress recalculation
      const teamSubmission = await tx.query.teamTileSubmissions.findFirst({
        where: eq(teamTileSubmissions.id, currentSubmission.teamTileSubmissionId),
      })

      if (!teamSubmission) {
        throw new Error("Team submission not found")
      }

      // 2. Update the submission with the new goal/value
      const updateData = {
        goalId,
        submissionValue,
        updatedAt: new Date(),
      }

      const [updatedSubmission] = await tx
        .update(submissions)
        .set(updateData)
        .where(eq(submissions.id, submissionId))
        .returning()

      // 3. Recalculate for old goal if it changed to properly reduce progress
      if (oldGoalId && oldGoalId !== goalId) {
        await recalculateGoalProgress(tx, oldGoalId, teamSubmission.teamId)
      }

      // 4. Recalculate for new goal (and when only the value changed on the same goal)
      if (goalId) {
        await recalculateGoalProgress(tx, goalId, teamSubmission.teamId)
      }

      return updatedSubmission
    })

    revalidatePath("/bingo")

    return { success: true, submission: result }
  } catch (error) {
    logger.error(
      { error, submissionId, goalId, submissionValue },
      "Error updating submission goal and value"
    )
    return { success: false, error: "Failed to update submission" }
  }
}
