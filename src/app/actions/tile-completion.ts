"use server"

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import { db } from "@/server/db"
import { logger } from "@/lib/logger";
import { goals, goalGroups, teamGoalProgress, teamTileSubmissions } from "@/server/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

interface GoalEvaluationNode {
  type: "goal" | "group"
  id: string
  isComplete: boolean
  operator?: "AND" | "OR"
  children?: GoalEvaluationNode[]
}

/**
 * Evaluate if a goal is complete for a team
 */
async function evaluateGoal(goalId: string, teamId: string): Promise<boolean> {
  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
  })

  if (!goal) return false

  const progress = await db.query.teamGoalProgress.findFirst({
    where: and(eq(teamGoalProgress.goalId, goalId), eq(teamGoalProgress.teamId, teamId)),
  })

  return (progress?.currentValue || 0) >= goal.targetValue
}

/**
 * Recursively evaluate a goal group
 */
async function evaluateGroup(groupId: string, teamId: string): Promise<GoalEvaluationNode> {
  const group = await db.query.goalGroups.findFirst({
    where: eq(goalGroups.id, groupId),
    with: {
      childGroups: true,
      goals: true,
    },
  })

  if (!group) {
    return {
      type: "group",
      id: groupId,
      isComplete: false,
      operator: "AND",
      children: [],
    }
  }

  const children: GoalEvaluationNode[] = []

  // Evaluate child groups
  for (const childGroup of group.childGroups) {
    const childNode = await evaluateGroup(childGroup.id, teamId)
    children.push(childNode)
  }

  // Evaluate child goals
  for (const childGoal of group.goals) {
    const isComplete = await evaluateGoal(childGoal.id, teamId)
    children.push({
      type: "goal",
      id: childGoal.id,
      isComplete,
    })
  }

  // Apply logical operator
  let isComplete = false
  if (group.logicalOperator === "AND") {
    isComplete = children.length > 0 && children.every((child) => child.isComplete)
  } else {
    // OR - check if at least minRequiredGoals are complete
    const completedCount = children.filter((child) => child.isComplete).length
    const minRequired = group.minRequiredGoals || 1 // Default to 1 for backwards compatibility
    isComplete = completedCount >= minRequired
  }

  return {
    type: "group",
    id: groupId,
    isComplete,
    operator: group.logicalOperator,
    children,
  }
}

/**
 * Evaluate if a tile should be complete based on its goal tree
 */
export async function evaluateTileCompletion(tileId: string, teamId: string): Promise<boolean> {
  try {
    // Get all root-level groups and goals for this tile
    const rootGroups = await db.query.goalGroups.findMany({
      where: and(eq(goalGroups.tileId, tileId), isNull(goalGroups.parentGroupId)),
    })

    const rootGoals = await db.query.goals.findMany({
      where: and(eq(goals.tileId, tileId), isNull(goals.parentGroupId)),
    })

    // If there are no goals or groups, tile cannot be complete
    if (rootGroups.length === 0 && rootGoals.length === 0) {
      return false
    }

    const evaluationNodes: GoalEvaluationNode[] = []

    // Evaluate root groups
    for (const group of rootGroups) {
      const node = await evaluateGroup(group.id, teamId)
      evaluationNodes.push(node)
    }

    // Evaluate root goals
    for (const goal of rootGoals) {
      const isComplete = await evaluateGoal(goal.id, teamId)
      evaluationNodes.push({
        type: "goal",
        id: goal.id,
        isComplete,
      })
    }

    // All root-level items must be complete (implicit AND at root level)
    return evaluationNodes.every((node) => node.isComplete)
  } catch (error) {
    logger.error({ error }, "Error evaluating tile completion:", error)
    return false
  }
}

/**
 * Check if tile should auto-complete and create submission if needed
 */
export async function checkAndAutoCompleteTile(tileId: string, teamId: string) {
  try {
    // Check if tile is already submitted
    const existingSubmission = await db.query.teamTileSubmissions.findFirst({
      where: and(eq(teamTileSubmissions.tileId, tileId), eq(teamTileSubmissions.teamId, teamId)),
    })

    // Evaluate if tile is complete
    const isComplete = await evaluateTileCompletion(tileId, teamId)

    if (!isComplete) {
      return { success: true, shouldComplete: false }
    }

    // If submission exists and is already approved, nothing to do
    if (existingSubmission?.status === "approved") {
      return { success: true, alreadyApproved: true }
    }

    // If submission exists but not approved, update it to approved
    if (existingSubmission) {
      const [updatedSubmission] = await db
        .update(teamTileSubmissions)
        .set({
          status: "approved",
          updatedAt: new Date(),
        })
        .where(eq(teamTileSubmissions.id, existingSubmission.id))
        .returning()

      revalidatePath("/events/[id]/bingos/[bingoId]", "page")

      return {
        success: true,
        shouldComplete: true,
        autoCompleted: true,
        wasUpdated: true,
        submission: updatedSubmission,
      }
    }

    // No submission exists, create a new one with approved status
    const [newSubmission] = await db
      .insert(teamTileSubmissions)
      .values({
        tileId,
        teamId,
        status: "approved",
      })
      .returning()

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return {
      success: true,
      shouldComplete: true,
      autoCompleted: true,
      wasCreated: true,
      submission: newSubmission,
    }
  } catch (error) {
    logger.error({ error }, "Error checking tile auto-completion:", error)
    return { success: false, error: "Failed to check tile completion" }
  }
}

/**
 * Get detailed evaluation tree for debugging/display
 */
export async function getDetailedEvaluation(tileId: string, teamId: string): Promise<GoalEvaluationNode[]> {
  try {
    const rootGroups = await db.query.goalGroups.findMany({
      where: and(eq(goalGroups.tileId, tileId), isNull(goalGroups.parentGroupId)),
    })

    const rootGoals = await db.query.goals.findMany({
      where: and(eq(goals.tileId, tileId), isNull(goals.parentGroupId)),
    })

    const evaluationNodes: GoalEvaluationNode[] = []

    for (const group of rootGroups) {
      const node = await evaluateGroup(group.id, teamId)
      evaluationNodes.push(node)
    }

    for (const goal of rootGoals) {
      const isComplete = await evaluateGoal(goal.id, teamId)
      evaluationNodes.push({
        type: "goal",
        id: goal.id,
        isComplete,
      })
    }

    return evaluationNodes
  } catch (error) {
    logger.error({ error }, "Error getting detailed evaluation:", error)
    return []
  }
}
