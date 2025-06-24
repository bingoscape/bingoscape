"use server"

import { db } from "@/server/db"
import { goalValues, submissions } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface GoalValue {
  id: string
  goalId: string
  value: number
  description: string
  createdAt: Date
  updatedAt: Date
}

export async function addGoalValue(goalId: string, value: number, description: string) {
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
    console.error("Error adding goal value:", error)
    return { success: false, error: "Failed to add goal value" }
  }
}

export async function deleteGoalValue(goalValueId: string) {
  try {
    await db.delete(goalValues).where(eq(goalValues.id, goalValueId))

    // revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    console.error("Error deleting goal value:", error)
    return { success: false, error: "Failed to delete goal value" }
  }
}

export async function getGoalValues(goalId: string): Promise<GoalValue[]> {
  try {
    const values = await db.query.goalValues.findMany({
      where: eq(goalValues.goalId, goalId),
      orderBy: (goalValues, { asc }) => [asc(goalValues.value)],
    })

    return values
  } catch (error) {
    console.error("Error fetching goal values:", error)
    return []
  }
}

export async function updateSubmissionGoalAndValue(
  submissionId: string,
  goalId: string | null,
  submissionValue: number,
) {
  try {
    type SubmissionUpdateData = {
      goalId: string | null
      submissionValue: number
      updatedAt: Date
    }
    const updateData: SubmissionUpdateData = {
      goalId,
      submissionValue,
      updatedAt: new Date(),
    }

    const [updatedSubmission] = await db
      .update(submissions)
      .set(updateData)
      .where(eq(submissions.id, submissionId))
      .returning()

    revalidatePath("/bingo")

    return { success: true, submission: updatedSubmission }
  } catch (error) {
    console.error("Error updating submission goal and value:", error)
    return { success: false, error: "Failed to update submission" }
  }
}
