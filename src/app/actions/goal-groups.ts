"use server"

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import { db } from "@/server/db"
import { goalGroups, goals, teamGoalProgress } from "@/server/db/schema"
import { eq, and, isNull, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface GoalGroup {
  id: string
  tileId: string
  parentGroupId: string | null
  logicalOperator: "AND" | "OR"
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export interface GoalTreeNode {
  type: "group" | "goal"
  id: string
  data: GoalGroup | {
    id: string
    tileId: string
    parentGroupId: string | null
    description: string
    targetValue: number
    goalType?: "generic" | "item"
    orderIndex: number
    itemGoal?: {
      id: string
      goalId: string
      itemId: number
      baseName: string
      exactVariant: string | null
      imageUrl: string
      createdAt: Date
      updatedAt: Date
    } | null
  }
  children?: GoalTreeNode[]
}

/**
 * Create a new goal group
 */
export async function createGoalGroup(
  tileId: string,
  logicalOperator: "AND" | "OR",
  parentGroupId?: string | null,
) {
  try {
    // Get the next order index for this parent
    const siblings = await db.query.goalGroups.findMany({
      where: parentGroupId
        ? eq(goalGroups.parentGroupId, parentGroupId)
        : and(eq(goalGroups.tileId, tileId), isNull(goalGroups.parentGroupId)),
    })

    const orderIndex = siblings.length

    const [newGroup] = await db
      .insert(goalGroups)
      .values({
        tileId,
        parentGroupId: parentGroupId || null,
        logicalOperator,
        orderIndex,
      })
      .returning()

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true, group: newGroup }
  } catch (error) {
    console.error("Error creating goal group:", error)
    return { success: false, error: "Failed to create goal group" }
  }
}

/**
 * Update a goal group's logical operator
 */
export async function updateGoalGroup(groupId: string, logicalOperator: "AND" | "OR") {
  try {
    const [updatedGroup] = await db
      .update(goalGroups)
      .set({
        logicalOperator,
        updatedAt: new Date(),
      })
      .where(eq(goalGroups.id, groupId))
      .returning()

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true, group: updatedGroup }
  } catch (error) {
    console.error("Error updating goal group:", error)
    return { success: false, error: "Failed to update goal group" }
  }
}

/**
 * Delete a goal group and promote its children to parent level
 */
export async function deleteGoalGroup(groupId: string) {
  try {
    // Get the group to find its parent
    const group = await db.query.goalGroups.findFirst({
      where: eq(goalGroups.id, groupId),
    })

    if (!group) {
      return { success: false, error: "Goal group not found" }
    }

    await db.transaction(async (tx) => {
      // Move child groups to parent level
      await tx
        .update(goalGroups)
        .set({
          parentGroupId: group.parentGroupId,
          updatedAt: new Date(),
        })
        .where(eq(goalGroups.parentGroupId, groupId))

      // Move child goals to parent level
      await tx
        .update(goals)
        .set({
          parentGroupId: group.parentGroupId,
          updatedAt: new Date(),
        })
        .where(eq(goals.parentGroupId, groupId))

      // Delete the group
      await tx.delete(goalGroups).where(eq(goalGroups.id, groupId))
    })

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    console.error("Error deleting goal group:", error)
    return { success: false, error: "Failed to delete goal group" }
  }
}

/**
 * Move a goal to a different group (or root level)
 */
export async function moveGoalToGroup(goalId: string, targetGroupId: string | null, orderIndex?: number) {
  try {
    const updateData: {
      parentGroupId: string | null
      orderIndex?: number
      updatedAt: Date
    } = {
      parentGroupId: targetGroupId,
      updatedAt: new Date(),
    }

    if (orderIndex !== undefined) {
      updateData.orderIndex = orderIndex
    }

    await db.update(goals).set(updateData).where(eq(goals.id, goalId))

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    console.error("Error moving goal:", error)
    return { success: false, error: "Failed to move goal" }
  }
}

/**
 * Move a group to a different parent group (or root level)
 */
export async function moveGroupToGroup(groupId: string, targetGroupId: string | null, orderIndex?: number) {
  try {
    // Prevent circular references
    if (targetGroupId) {
      const isCircular = await checkCircularReference(groupId, targetGroupId)
      if (isCircular) {
        return { success: false, error: "Cannot create circular group reference" }
      }
    }

    const updateData: {
      parentGroupId: string | null
      orderIndex?: number
      updatedAt: Date
    } = {
      parentGroupId: targetGroupId,
      updatedAt: new Date(),
    }

    if (orderIndex !== undefined) {
      updateData.orderIndex = orderIndex
    }

    await db.update(goalGroups).set(updateData).where(eq(goalGroups.id, groupId))

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    console.error("Error moving group:", error)
    return { success: false, error: "Failed to move group" }
  }
}

/**
 * Check if moving a group would create a circular reference
 */
async function checkCircularReference(groupId: string, targetGroupId: string): Promise<boolean> {
  let currentId: string | null = targetGroupId

  while (currentId) {
    if (currentId === groupId) {
      return true // Circular reference detected
    }

    const parent: GoalGroup | undefined = await db.query.goalGroups.findFirst({
      where: eq(goalGroups.id, currentId),
    })

    currentId = parent?.parentGroupId || null
  }

  return false
}

/**
 * Reorder goals/groups within the same parent
 */
export async function reorderItems(
  items: Array<{ id: string; type: "goal" | "group"; orderIndex: number }>,
) {
  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        if (item.type === "goal") {
          await tx.update(goals).set({ orderIndex: item.orderIndex }).where(eq(goals.id, item.id))
        } else {
          await tx.update(goalGroups).set({ orderIndex: item.orderIndex }).where(eq(goalGroups.id, item.id))
        }
      }
    })

    revalidatePath("/events/[id]/bingos/[bingoId]", "page")

    return { success: true }
  } catch (error) {
    console.error("Error reordering items:", error)
    return { success: false, error: "Failed to reorder items" }
  }
}

/**
 * Get the goal tree for a tile
 */
export async function getGoalTree(tileId: string): Promise<GoalTreeNode[]> {
  try {
    // Fetch all groups and goals for this tile
    const allGroups = await db.query.goalGroups.findMany({
      where: eq(goalGroups.tileId, tileId),
    })

    const allGoals = await db.query.goals.findMany({
      where: eq(goals.tileId, tileId),
      with: {
        goalValues: true,
        teamProgress: true,
        itemGoal: true,
      },
    })

    // Build tree structure
    const buildTree = (parentId: string | null): GoalTreeNode[] => {
      const nodes: GoalTreeNode[] = []

      // Add groups at this level
      const childGroups = allGroups
        .filter((g) => g.parentGroupId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      for (const group of childGroups) {
        nodes.push({
          type: "group",
          id: group.id,
          data: group,
          children: buildTree(group.id),
        })
      }

      // Add goals at this level
      const childGoals = allGoals
        .filter((g) => g.parentGroupId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      for (const goal of childGoals) {
        nodes.push({
          type: "goal",
          id: goal.id,
          data: goal,
        })
      }

      return nodes
    }

    return buildTree(null)
  } catch (error) {
    console.error("Error getting goal tree:", error)
    return []
  }
}

/**
 * Get the goal tree with team progress for a tile
 */
export async function getGoalTreeWithProgress(tileId: string, teamId: string) {
  try {
    const tree = await getGoalTree(tileId)

    // Get all team progress for this team and tile's goals
    const tileGoals = await db.query.goals.findMany({
      where: eq(goals.tileId, tileId),
    })

    const goalIds = tileGoals.map((g) => g.id)

    const teamProgressData = await db.query.teamGoalProgress.findMany({
      where: and(eq(teamGoalProgress.teamId, teamId), inArray(teamGoalProgress.goalId, goalIds)),
    })

    // Build progress map with completion status
    const progressMap = new Map()
    for (const goal of tileGoals) {
      const progress = teamProgressData.find((p) => p.goalId === goal.id)
      progressMap.set(goal.id, {
        goalId: goal.id,
        currentValue: progress?.currentValue || 0,
        isComplete: (progress?.currentValue || 0) >= goal.targetValue,
      })
    }

    return {
      tree,
      teamProgress: Array.from(progressMap.values()),
    }
  } catch (error) {
    console.error("Error getting goal tree with progress:", error)
    return {
      tree: [],
      teamProgress: [],
    }
  }
}
