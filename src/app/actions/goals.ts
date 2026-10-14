"use server"

import { db } from "@/server/db"
import { goalValues, submissions, teamTileSubmissions } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"
import { recalculateGoalProgress } from "@/server/goal-progress"
import {
  assertGoalInEvent,
  authzErrorMessage,
  canReadGoal,
  requireBingoAdminForGoal,
  requireBingoAdminForGoalValue,
  requireBingoAdminForSubmission,
} from "@/server/authz"

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
    await requireBingoAdminForGoal(goalId)

    if (!Number.isFinite(value)) {
      return { success: false, error: "Value must be a number" }
    }

    const newGoalValue = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(goalValues)
        .values({
          goalId,
          value,
          description,
        })
        .returning()
      return inserted
    })

    revalidatePath("/events/[id]", "layout")

    return { success: true, goalValue: newGoalValue }
  } catch (error) {
    logger.error(
      { error, goalId, value, description },
      "Error adding goal value"
    )
    return {
      success: false,
      error: authzErrorMessage(error, "Failed to add goal value"),
    }
  }
}

export async function deleteGoalValue(goalValueId: string) {
  try {
    await requireBingoAdminForGoalValue(goalValueId)

    await db.transaction(async (tx) => {
      await tx.delete(goalValues).where(eq(goalValues.id, goalValueId))
    })

    revalidatePath("/events/[id]", "layout")

    return { success: true }
  } catch (error) {
    logger.error({ error, goalValueId }, "Error deleting goal value")
    return {
      success: false,
      error: authzErrorMessage(error, "Failed to delete goal value"),
    }
  }
}

export async function getGoalValues(goalId: string): Promise<GoalValue[]> {
  try {
    // Hidden Tiles must not leak their Goals to non-managers.
    if (!(await canReadGoal(goalId))) return []

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

export async function updateSubmissionGoalAndValue(
  submissionId: string,
  goalId: string | null,
  submissionValue: number
) {
  try {
    // Re-assigning a Submission to a Goal is a review action: managers only.
    // The Event is derived from the Submission, never supplied by the client.
    const eventId = await requireBingoAdminForSubmission(submissionId)
    // The new Goal must belong to the same Event as the Submission.
    if (goalId) await assertGoalInEvent(goalId, eventId)

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

    revalidatePath("/")

    return { success: true, submission: result }
  } catch (error) {
    logger.error(
      { error, submissionId, goalId, submissionValue },
      "Error updating submission goal and value"
    )
    return {
      success: false,
      error: authzErrorMessage(error, "Failed to update submission"),
    }
  }
}
