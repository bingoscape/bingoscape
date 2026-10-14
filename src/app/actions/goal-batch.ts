"use server"

import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/server/db"
import { goalGroups, goals, tiles } from "@/server/db/schema"
import { requirePermissionForBingo, actionFailure } from "@/server/authz"
import { buildCopyPlan, type CopyPlan, type PlanNode } from "@/server/goal-copy"
import {
  insertGoal,
  nextOrderIndex,
  validateNewGoal,
  type GoalDbTx,
  type NewGoalInput,
} from "@/server/goal-create"
import { MAX_GOALS_PER_BATCH, validateBatchSize } from "@/lib/goal-validation"
import { logger } from "@/lib/logger"

/** What to put on every selected tile. */
export type GoalBatchSource =
  /** The same new goals, each as its own top-level goal. */
  | { kind: "goals"; goals: NewGoalInput[] }
  /** The whole goal tree of another tile of the same board (definitions only). */
  | { kind: "copy"; sourceTileId: string }

export type GoalBatchResult =
  | {
      success: true
      /** Tiles that received goals. */
      tilesUpdated: number
      /** Goals created, over all tiles. */
      goalsCreated: number
      /** Groups created, over all tiles (copying a tree can create groups). */
      groupsCreated: number
    }
  | { success: false; error: string }

/** A problem with the request itself; its message is safe to show to the user. */
class BatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BatchError"
  }
}

/** Creates the planned nodes under `parentGroupId`, numbering siblings from `startIndex`. */
async function insertPlan(
  tx: GoalDbTx,
  tileId: string,
  parentGroupId: string | null,
  nodes: PlanNode[],
  startIndex: number
) {
  for (const [offset, node] of nodes.entries()) {
    const orderIndex = startIndex + offset
    if (node.kind === "goal") {
      await insertGoal(tx, tileId, parentGroupId, orderIndex, node.input)
      continue
    }
    const [group] = await tx
      .insert(goalGroups)
      .values({
        tileId,
        parentGroupId,
        name: node.name,
        logicalOperator: node.operator,
        minRequiredGoals: node.minRequiredGoals,
        orderIndex,
      })
      .returning()
    if (!group) throw new Error("Failed to insert goal group")
    await insertPlan(tx, tileId, group.id, node.children, 0)
  }
}

/** Reads the goal tree of a tile into a plan for copying it. */
async function planCopy(tx: GoalDbTx, sourceTileId: string): Promise<CopyPlan> {
  const groups = await tx.query.goalGroups.findMany({
    where: eq(goalGroups.tileId, sourceTileId),
  })
  const sourceGoals = await tx.query.goals.findMany({
    where: eq(goals.tileId, sourceTileId),
    with: { itemGoal: true, metricGoal: true },
  })
  const result = buildCopyPlan(groups, sourceGoals)
  if (!result.ok) throw new BatchError(result.error)
  return result.plan
}

/**
 * Adds goals to several tiles of one board in a single transaction: either
 * every selected tile gets them, or nothing changes.
 *
 * - The caller must manage the event that owns the board.
 * - Every tile id (and the copy source) is looked up in the database and must
 *   belong to `bingoId`; the client's word is never trusted.
 * - New goals are appended after the goals a tile already has. Existing goals
 *   are never changed or removed, and progress is never copied.
 * - Limits: `MAX_BATCH_TILES` tiles, `MAX_GOALS_PER_BATCH` new goals per tile
 *   and `MAX_BATCH_TOTAL_ROWS` goals and groups in total.
 *
 * Never throws; failures come back as `{ success: false, error }`.
 */
export async function applyGoalsToTiles(
  bingoId: string,
  tileIds: string[],
  source: GoalBatchSource
): Promise<GoalBatchResult> {
  try {
    if (typeof bingoId !== "string" || bingoId === "") {
      return { success: false, error: "Board not found" }
    }
    await requirePermissionForBingo(bingoId, "board:manage")

    if (
      !Array.isArray(tileIds) ||
      tileIds.some((id) => typeof id !== "string" || id === "")
    ) {
      return { success: false, error: "Select at least one tile" }
    }
    const targetIds = [...new Set(tileIds)]
    const sizeError = validateBatchSize(targetIds.length, 0)
    if (sizeError) return { success: false, error: sizeError }

    let newGoals: NewGoalInput[] = []
    let sourceTileId: string | null = null

    if (source?.kind === "goals") {
      newGoals = source.goals
      if (!Array.isArray(newGoals) || newGoals.length === 0) {
        return { success: false, error: "No goals to create" }
      }
      if (newGoals.length > MAX_GOALS_PER_BATCH) {
        return {
          success: false,
          error: `You can create at most ${MAX_GOALS_PER_BATCH} goals at once`,
        }
      }
      for (const [index, input] of newGoals.entries()) {
        const error = validateNewGoal(input)
        if (error) {
          return {
            success: false,
            error: newGoals.length > 1 ? `Goal ${index + 1}: ${error}` : error,
          }
        }
      }
      const totalError = validateBatchSize(targetIds.length, newGoals.length)
      if (totalError) return { success: false, error: totalError }
    } else if (source?.kind === "copy") {
      sourceTileId = source.sourceTileId
      if (typeof sourceTileId !== "string" || sourceTileId === "") {
        return { success: false, error: "Choose a tile to copy goals from" }
      }
      if (targetIds.includes(sourceTileId)) {
        return {
          success: false,
          error: "A tile cannot receive a copy of its own goals",
        }
      }
    } else {
      return { success: false, error: "No goals to create" }
    }

    const outcome = await db.transaction(async (tx) => {
      // Every tile involved must belong to this board.
      const wanted = sourceTileId ? [...targetIds, sourceTileId] : targetIds
      const found = await tx
        .select({ id: tiles.id })
        .from(tiles)
        .where(and(eq(tiles.bingoId, bingoId), inArray(tiles.id, wanted)))
      if (found.length !== wanted.length) {
        throw new BatchError("Some of the selected tiles are not on this board")
      }

      if (sourceTileId) {
        const plan = await planCopy(tx, sourceTileId)
        const rowsPerTile = plan.goalCount + plan.groupCount
        const totalError = validateBatchSize(targetIds.length, rowsPerTile)
        if (totalError) throw new BatchError(totalError)

        for (const tileId of targetIds) {
          const startIndex = await nextOrderIndex(tx, tileId, null)
          await insertPlan(tx, tileId, null, plan.nodes, startIndex)
        }
        return {
          goalsCreated: plan.goalCount * targetIds.length,
          groupsCreated: plan.groupCount * targetIds.length,
        }
      }

      const inputs: PlanNode[] = newGoals.map((input) => ({
        kind: "goal",
        input,
      }))
      for (const tileId of targetIds) {
        const startIndex = await nextOrderIndex(tx, tileId, null)
        await insertPlan(tx, tileId, null, inputs, startIndex)
      }
      return {
        goalsCreated: newGoals.length * targetIds.length,
        groupsCreated: 0,
      }
    })

    revalidatePath("/events/[id]", "layout")

    return { success: true, tilesUpdated: targetIds.length, ...outcome }
  } catch (error) {
    if (error instanceof BatchError) {
      return { success: false, error: error.message }
    }
    logger.error({ error }, "Error applying goals to tiles")
    return actionFailure(error, "Failed to apply goals")
  }
}
