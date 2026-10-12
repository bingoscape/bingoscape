import { and, eq, isNull, max } from "drizzle-orm"
import type { db } from "@/server/db"
import { goalGroups, goals, itemGoals, metricGoals } from "@/server/db/schema"
import { validateDescription, validateTargetValue } from "@/lib/goal-validation"
import { getMetricName } from "@/lib/osrs-metrics"

/**
 * Internals shared by the goal-creating server actions (`createGoals` in
 * bingo.ts and `applyGoalsToTiles` in goal-batch.ts). This is deliberately
 * not a "use server" module: nothing here is callable from the client.
 */

export type GoalDbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type NewGoalInput =
  | { type: "generic"; description: string; targetValue: number }
  | {
      type: "item"
      itemId: number
      itemName: string
      baseName: string
      imageUrl: string
      targetValue: number
      exactVariant?: string | null
    }
  | {
      type: "metric"
      metricType: string
      metricName: string
      targetValue: number
      description?: string
    }

export interface CreateGoalsOptions {
  /** Place the goals (or the new group) inside this existing group. */
  parentGroupId?: string | null
  /** Wrap the new goals in a new group created in the same transaction. */
  group?: { operator: "AND" | "OR" | "SUM"; minRequiredGoals?: number }
}

export function metricGoalDescription(
  metricName: string,
  description?: string
) {
  return description?.trim() || getMetricName(metricName)
}

/** Returns an error message, or null when the goal can be created. */
export function validateNewGoal(input: NewGoalInput): string | null {
  const targetError = validateTargetValue(input.targetValue)
  if (targetError) return targetError

  switch (input.type) {
    case "generic":
      return validateDescription(input.description)
    case "item":
      if (!Number.isInteger(input.itemId)) return "Invalid item"
      return validateDescription(input.itemName)
    case "metric":
      if (!input.metricType.trim() || !input.metricName.trim()) {
        return "Please specify a metric"
      }
      return null
  }
}

/** Next free order index among the goals and groups sharing a parent. */
export async function nextOrderIndex(
  tx: GoalDbTx,
  tileId: string,
  parentGroupId: string | null
) {
  const [goalMax] = await tx
    .select({ value: max(goals.orderIndex) })
    .from(goals)
    .where(
      and(
        eq(goals.tileId, tileId),
        parentGroupId
          ? eq(goals.parentGroupId, parentGroupId)
          : isNull(goals.parentGroupId)
      )
    )
  const [groupMax] = await tx
    .select({ value: max(goalGroups.orderIndex) })
    .from(goalGroups)
    .where(
      and(
        eq(goalGroups.tileId, tileId),
        parentGroupId
          ? eq(goalGroups.parentGroupId, parentGroupId)
          : isNull(goalGroups.parentGroupId)
      )
    )
  return Math.max(goalMax?.value ?? -1, groupMax?.value ?? -1) + 1
}

export async function insertGoal(
  tx: GoalDbTx,
  tileId: string,
  parentGroupId: string | null,
  orderIndex: number,
  input: NewGoalInput
) {
  const description =
    input.type === "generic"
      ? input.description.trim()
      : input.type === "item"
        ? input.itemName
        : metricGoalDescription(input.metricName, input.description)

  const [goal] = await tx
    .insert(goals)
    .values({
      tileId,
      parentGroupId,
      description,
      targetValue: input.targetValue,
      goalType: input.type,
      orderIndex,
    })
    .returning()
  if (!goal) throw new Error("Failed to insert goal")

  if (input.type === "item") {
    const [itemGoal] = await tx
      .insert(itemGoals)
      .values({
        goalId: goal.id,
        itemId: input.itemId,
        baseName: input.baseName,
        exactVariant: input.exactVariant ?? null,
        imageUrl: input.imageUrl,
      })
      .returning()
    return { goal, itemGoal }
  }

  if (input.type === "metric") {
    const [metricGoal] = await tx
      .insert(metricGoals)
      .values({
        goalId: goal.id,
        metricType: input.metricType,
        metricName: input.metricName,
      })
      .returning()
    return { goal, metricGoal }
  }

  return { goal }
}
