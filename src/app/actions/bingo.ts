/* eslint-disable */
"use server"

import { db } from "@/server/db"
import {
  bingoTypeEnum,
  type BingoType,
  bingos,
  goals,
  itemGoals,
  metricGoals,
  teamGoalProgress,
  tiles,
  submissions,
  submissionComments,
  images,
  teams,
  teamTileSubmissions,
  teamTierProgress,
  tierXpRequirements,
  rowBonuses,
  columnBonuses,
  teamMembers,
  eventParticipants,
  users,
  events,
  goalGroups,
  type ShipRule,
} from "@/server/db/schema"
import type { UUID } from "crypto"
import { asc, eq, inArray, and, gt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import type { Tile, TeamTileSubmission, Bingo } from "@/types/model"
import { getUserRole } from "./events"
import {
  authzErrorMessage,
  canReadGoal,
  canReadTile,
  isEventManager,
  requireBingoAdmin,
  requireBingoAdminForGoal,
  requireBingoAdminForSubmission,
  requireBingoAdminForTeamTileSubmission,
  requireBingoAdminForTile,
  requireTeamMemberOrManager,
} from "@/server/authz"
import { isBlindBoard } from "@/server/blind-board"
import { isBingoBlindForViewer } from "@/server/blind-board-viewer"
import {
  applyShipRulesUpdate,
  assertBattleshipLayoutEditable,
  assertEventFitsBattleship,
  assertTilesCarryNoShip,
  BattleshipRuleError,
  battleshipErrorMessage,
  defaultShipRules,
  insertBingoShipRules,
  isShipRuleList,
  parseShipRulesJson,
} from "@/server/battleship"
import { validateShipRulesFitBoard } from "@/lib/ship-rules"
import { createNotification } from "./notifications"
import { getServerAuthSession } from "@/server/auth"
import getRandomFrog from "@/lib/getRandomFrog"
import {
  MAX_GOALS_PER_BATCH,
  validateTargetValue,
} from "@/lib/goal-validation"
import {
  sendDiscordWebhook,
  createSubmissionEmbed,
} from "@/lib/discord-webhook"
import { discordWebhooks } from "@/server/db/schema"
import { sql } from "drizzle-orm"
import { completedAtOnComplete } from "@/lib/completed-at"
import { logger } from "@/lib/logger"
import type { SelectableUser } from "@/types/model"
import {
  insertGoal,
  metricGoalDescription,
  nextOrderIndex,
  validateNewGoal,
  type CreateGoalsOptions as SharedCreateGoalsOptions,
  type NewGoalInput as SharedNewGoalInput,
} from "@/server/goal-create"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

interface AddRowOrColumnSuccessResult {
  success: true
  tiles: Tile[]
  bingo: Bingo
}

interface AddRowOrColumnErrorResult {
  success: false
  error: string
}

type AddRowOrColumnResult =
  | AddRowOrColumnSuccessResult
  | AddRowOrColumnErrorResult

// Utility function to ensure the upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Type for selectable users in submission on-behalf-of dropdown imported from model.ts

/**
 * Get users that the current user can submit on behalf of.
 * - Regular participants: can only submit for their own team members
 * - Management/Admin users: can submit for any event participant
 */
export async function getSelectableUsersForSubmission(
  eventId: string,
  teamId: string
): Promise<SelectableUser[]> {
  const session = await getServerAuthSession()
  if (!session?.user) return []

  const currentUserId = session.user.id
  const userRole = await getUserRole(eventId)
  const isManagement = userRole === "admin" || userRole === "management"

  if (isManagement) {
    // Return all event participants with their team info
    const participants = await db
      .select({
        id: users.id,
        name: users.name,
        runescapeName: users.runescapeName,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(users)
      .innerJoin(eventParticipants, eq(users.id, eventParticipants.userId))
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(
        teams,
        and(eq(teamMembers.teamId, teams.id), eq(teams.eventId, eventId))
      )
      .where(eq(eventParticipants.eventId, eventId))

    // Sort by team name and put current user first
    return participants.sort((a, b) => {
      // Current user always first
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
      // Then sort by team name (unassigned last)
      if (!a.teamName && b.teamName) return 1
      if (a.teamName && !b.teamName) return -1
      if (a.teamName && b.teamName) {
        const teamCompare = a.teamName.localeCompare(b.teamName)
        if (teamCompare !== 0) return teamCompare
      }
      // Then by name
      return (a.runescapeName || a.name || "").localeCompare(
        b.runescapeName || b.name || ""
      )
    })
  } else {
    // Return only team members
    const teamMembersList = await db
      .select({
        id: users.id,
        name: users.name,
        runescapeName: users.runescapeName,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(users)
      .innerJoin(teamMembers, eq(users.id, teamMembers.userId))
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.teamId, teamId))

    // Sort with current user first
    return teamMembersList.sort((a, b) => {
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
      return (a.runescapeName || a.name || "").localeCompare(
        b.runescapeName || b.name || ""
      )
    })
  }
}

/**
 * Validate if the current user can submit on behalf of another user.
 * Rules:
 * 1. Submitting for self → always allowed
 * 2. Admin/management → can submit for any event participant
 * 3. Regular participant → can only submit for same-team members
 */
async function canSubmitOnBehalfOf(
  submitterUserId: string,
  targetUserId: string,
  teamId: string,
  eventId: string
): Promise<boolean> {
  // Case 1: User is submitting for themselves - always allowed
  if (submitterUserId === targetUserId) return true

  // Case 2: Check if submitter is management/admin for the event
  const session = await getServerAuthSession()
  if (!session?.user || session.user.id !== submitterUserId) return false

  const submitterRole = await getUserRole(eventId)
  if (submitterRole === "admin" || submitterRole === "management") {
    // Management can submit for any participant in the event
    const isTargetParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, targetUserId)
      ),
    })
    return !!isTargetParticipant
  }

  // Case 3: Check if both users are on the same team
  const submitterOnTeam = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, submitterUserId)
    ),
  })
  const targetOnTeam = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, targetUserId)
    ),
  })

  return !!submitterOnTeam && !!targetOnTeam
}

export async function updateTile(
  tileId: string,
  updatedTile: Partial<typeof tiles.$inferInsert>
) {
  try {
    await requireBingoAdminForTile(tileId)
    // Never let the client re-parent or re-key a Tile (mass assignment).
    const {
      id: _id,
      bingoId: _bingoId,
      createdAt: _createdAt,
      ...safeUpdate
    } = updatedTile
    await db.transaction(async (tx) => {
      // Moving or hiding a tile must not invalidate battleship ship placements.
      if (safeUpdate.index !== undefined) {
        const [tile] = await tx
          .select({ bingoId: tiles.bingoId, index: tiles.index })
          .from(tiles)
          .where(eq(tiles.id, tileId))
        if (tile && tile.index !== safeUpdate.index) {
          await assertBattleshipLayoutEditable(tx, tile.bingoId)
        }
      }
      if (safeUpdate.isHidden === true) {
        await assertTilesCarryNoShip(tx, [tileId])
      }

      await tx
        .update(tiles)
        .set({ ...safeUpdate, updatedAt: new Date() })
        .where(eq(tiles.id, tileId))
    })
    revalidatePath("/events/[id]", "layout")
    logger.info({ tileId, action: "updateTile" }, "Tile updated successfully")
    return { success: true }
  } catch (error) {
    logger.error({ error, tileId, action: "updateTile" }, "Error updating tile")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to update tile"),
    }
  }
}

export async function reorderTiles(
  reorderedTiles: Array<{ id: string; index: number }>
) {
  try {
    // Guard: verify caller is admin/management for the bingo that owns these tiles.
    // We check the first tile; all tiles in a reorder call belong to the same bingo.
    const firstTileId = reorderedTiles[0]?.id
    if (!firstTileId) return { success: false, error: "No tiles provided" }
    await requireBingoAdminForTile(firstTileId)
    await db.transaction(async (tx) => {
      const [first] = await tx
        .select({ bingoId: tiles.bingoId })
        .from(tiles)
        .where(eq(tiles.id, firstTileId))
      if (first) await assertBattleshipLayoutEditable(tx, first.bingoId)

      for (const tile of reorderedTiles) {
        await tx
          .update(tiles)
          .set({ index: tile.index })
          .where(eq(tiles.id, tile.id))
      }
    })
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error reordering tiles")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to reorder tiles"),
    }
  }
}

export async function createBingo(formData: FormData) {
  const eventId = formData.get("eventId") as UUID
  const title = formData.get("title") as string

  // Auth guard: only event admin/management may create bingos.
  {
    const session = await getServerAuthSession()
    if (!session?.user) return { success: false, error: "Unauthorized" }
    const role = await getUserRole(eventId)
    if (role !== "admin" && role !== "management") {
      return {
        success: false,
        error: "Forbidden: admin or management role required",
      }
    }
  }
  const description = formData.get("description") as string
  const rowsStr = formData.get("rows") as string
  const columnsStr = formData.get("columns") as string
  const codephrase = formData.get("codephrase") as string
  const bingoTypeRaw = (formData.get("bingoType") as string | null) || "standard"
  const bingoType = bingoTypeEnum.enumValues.find((t) => t === bingoTypeRaw)
  if (!bingoType) return { success: false, error: "Invalid bingo type" }
  const tiersUnlockRequirementStr = formData.get(
    "tiersUnlockRequirement"
  ) as string

  logger.debug({ formData }, "Create bingo form data")

  if (!eventId || !title || !rowsStr || !columnsStr) {
    return { success: false, error: "Missing required fields" }
  }

  const rows = Number.parseInt(rowsStr)
  const columns = Number.parseInt(columnsStr)
  const tiersUnlockRequirement = tiersUnlockRequirementStr
    ? Number.parseInt(tiersUnlockRequirementStr)
    : 1

  if (isNaN(rows) || isNaN(columns) || rows < 1 || columns < 1) {
    return { success: false, error: "Invalid rows or columns" }
  }

  // Fetch the event to get its gameType
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    return { success: false, error: "Event not found" }
  }

  // Battleship boards carry a fleet and play without pattern bonuses.
  let shipRules = defaultShipRules
  if (bingoType === "battleship") {
    const supplied = parseShipRulesJson(formData.get("shipRules"))
    if (supplied === null) return { success: false, error: "Invalid ship rules" }
    if (supplied) shipRules = supplied
    const fitError = validateShipRulesFitBoard(shipRules, rows, columns)
    if (fitError) return { success: false, error: fitError }
  }

  // Parse pattern bonuses
  const mainDiagonalBonus =
    parseInt((formData.get("mainDiagonalBonus") as string) || "0") || 0
  const antiDiagonalBonus =
    parseInt((formData.get("antiDiagonalBonus") as string) || "0") || 0
  const completeBoardBonus =
    parseInt((formData.get("completeBoardBonus") as string) || "0") || 0

  const scheduledUnlockDateStr = formData.get("scheduledUnlockDate") as string
  const scheduledUnlockDate = scheduledUnlockDateStr
    ? new Date(scheduledUnlockDateStr)
    : null

  try {
    await db.transaction(async (tx) => {
      if (bingoType === "battleship") {
        await assertEventFitsBattleship(tx, eventId)
      }

      const newBingo = await tx
        .insert(bingos)
        .values({
          eventId,
          title,
          description: description || "",
          rows,
          codephrase,
          columns,
          bingoType,
          tiersUnlockRequirement,
          mainDiagonalBonusXP:
            rows === columns && bingoType !== "battleship"
              ? mainDiagonalBonus
              : 0,
          antiDiagonalBonusXP:
            rows === columns && bingoType !== "battleship"
              ? antiDiagonalBonus
              : 0,
          completeBoardBonusXP:
            bingoType === "standard" ? completeBoardBonus : 0,
          scheduledUnlockDate,
          locked: true,
          visible: false,
        })
        .returning({ id: bingos.id })

      const bingoId = newBingo[0]!.id

      const tilesToInsert = []
      for (let idx = 0; idx < rows * columns; idx++) {
        tilesToInsert.push({
          bingoId,
          title: `Tile ${idx + 1}`,
          headerImage: getRandomFrog(event.gameType),
          description: `Tile ${idx + 1}`,
          weight: 1,
          isHidden: false,
          index: idx,
          tier: bingoType === "progression" ? Math.floor(idx / columns) : 0,
        })
      }

      await tx.insert(tiles).values(tilesToInsert)

      if (bingoType === "standard") {
        const rowBonusValues = []
        for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
          const bonusXP =
            parseInt((formData.get(`rowBonus-${rowIndex}`) as string) || "0") ||
            0
          if (bonusXP > 0) {
            rowBonusValues.push({ bingoId, rowIndex, bonusXP })
          }
        }
        if (rowBonusValues.length > 0) {
          await tx.insert(rowBonuses).values(rowBonusValues)
        }

        const columnBonusValues = []
        for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
          const bonusXP =
            parseInt(
              (formData.get(`columnBonus-${columnIndex}`) as string) || "0"
            ) || 0
          if (bonusXP > 0) {
            columnBonusValues.push({ bingoId, columnIndex, bonusXP })
          }
        }
        if (columnBonusValues.length > 0) {
          await tx.insert(columnBonuses).values(columnBonusValues)
        }
      }

      if (bingoType === "progression") {
        const tierRequirements = []
        for (let tier = 0; tier < rows - 1; tier++) {
          tierRequirements.push({
            bingoId,
            tier,
            xpRequired: tiersUnlockRequirement,
          })
        }
        if (tierRequirements.length > 0) {
          await tx.insert(tierXpRequirements).values(tierRequirements)
        }
      }

      if (bingoType === "battleship") {
        await insertBingoShipRules(tx, bingoId, shipRules)
      }

      logger.info(
        {
          eventId,
          bingoId,
          bingoType,
          rows,
          columns,
          action: "createBingo",
        },
        "Bingo created successfully"
      )
    })

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error creating bingo")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to create bingo"),
    }
  }
}

export async function deleteBingo(bingoId: string) {
  try {
    await requireBingoAdmin(bingoId)
    await db.transaction(async (tx) => {
      // Delete all tiles associated with the bingo
      await tx.delete(tiles).where(eq(tiles.bingoId, bingoId))

      // Delete the bingo itself
      await tx.delete(bingos).where(eq(bingos.id, bingoId))
      // console.table(tilesDeleted, bingosDeleted);
    })

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting bingo")
    return { success: false, error: "Failed to delete bingo" }
  }
}

// Declared here (not re-exported with `export type { ... }`): the "use server"
// transform only erases type declarations, and would treat a re-export as a
// value export that does not exist.
export type NewGoalInput = SharedNewGoalInput
export type CreateGoalsOptions = SharedCreateGoalsOptions

/**
 * Create one or more goals on a tile in a single transaction: either all goals
 * (and the optional wrapping group) are created, or none are.
 */
export async function createGoals(
  tileId: string,
  inputs: NewGoalInput[],
  options: CreateGoalsOptions = {}
) {
  try {
    await requireBingoAdminForTile(tileId)

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return { success: false as const, error: "No goals to create" }
    }
    if (inputs.length > MAX_GOALS_PER_BATCH) {
      return {
        success: false as const,
        error: `You can create at most ${MAX_GOALS_PER_BATCH} goals at once`,
      }
    }
    for (const [index, input] of inputs.entries()) {
      const error = validateNewGoal(input)
      if (error) {
        return {
          success: false as const,
          error: inputs.length > 1 ? `Goal ${index + 1}: ${error}` : error,
        }
      }
    }

    const { group } = options
    if (group) {
      const min = group.minRequiredGoals ?? 1
      if (
        !Number.isInteger(min) ||
        min < 1 ||
        (group.operator === "OR" && min > inputs.length)
      ) {
        return {
          success: false as const,
          error: "Invalid number of required goals for this group",
        }
      }
    }

    const parentGroupId = options.parentGroupId ?? null
    if (parentGroupId) {
      const parent = await db.query.goalGroups.findFirst({
        where: eq(goalGroups.id, parentGroupId),
        columns: { tileId: true },
      })
      if (!parent || parent.tileId !== tileId) {
        return { success: false as const, error: "Goal group not found" }
      }
    }

    const created = await db.transaction(async (tx) => {
      let containerId = parentGroupId
      let startIndex = await nextOrderIndex(tx, tileId, parentGroupId)

      if (group) {
        const [newGroup] = await tx
          .insert(goalGroups)
          .values({
            tileId,
            parentGroupId,
            logicalOperator: group.operator,
            minRequiredGoals: group.minRequiredGoals ?? 1,
            orderIndex: startIndex,
          })
          .returning()
        if (!newGroup) throw new Error("Failed to insert goal group")
        containerId = newGroup.id
        startIndex = 0
      }

      const results = []
      for (const [index, input] of inputs.entries()) {
        results.push(
          await insertGoal(tx, tileId, containerId, startIndex + index, input)
        )
      }
      return { groupId: group ? containerId : null, results }
    })

    revalidatePath("/events/[id]", "layout")

    return {
      success: true as const,
      goals: created.results,
      groupId: created.groupId,
    }
  } catch (error) {
    logger.error({ error }, "Error creating goals")
    return {
      success: false as const,
      error: authzErrorMessage(error, "Failed to create goals"),
    }
  }
}

export async function addGoal(
  tileId: string,
  goal: {
    description: string
    targetValue: number
    parentGroupId?: string | null
  }
) {
  const result = await createGoals(
    tileId,
    [
      {
        type: "generic",
        description: goal.description,
        targetValue: goal.targetValue,
      },
    ],
    { parentGroupId: goal.parentGroupId }
  )
  if (!result.success) return result
  return { success: true as const, goal: result.goals[0]?.goal }
}

export async function deleteGoal(goalId: string) {
  try {
    await requireBingoAdminForGoal(goalId)
    await db.delete(goals).where(eq(goals.id, goalId))
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting goal")
    return { success: false, error: "Failed to delete goal" }
  }
}

/**
 * Update a goal's description and/or target value
 */
export async function updateGoal(
  goalId: string,
  updates: {
    description?: string
    targetValue?: number
  }
) {
  try {
    await requireBingoAdminForGoal(goalId)
    // Validate inputs
    if (updates.targetValue !== undefined) {
      const targetError = validateTargetValue(updates.targetValue)
      if (targetError) return { success: false, error: targetError }
    }

    if (
      updates.description !== undefined &&
      updates.description.trim() === ""
    ) {
      return { success: false, error: "Description cannot be empty" }
    }

    // Build update object
    const updateData: Partial<typeof goals.$inferInsert> & { updatedAt: Date } =
      {
        updatedAt: new Date(),
      }

    if (updates.description !== undefined) {
      updateData.description = updates.description.trim()
    }

    if (updates.targetValue !== undefined) {
      updateData.targetValue = updates.targetValue
    }

    // Update the goal
    const [updatedGoal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, goalId))
      .returning()

    return { success: true, goal: updatedGoal }
  } catch (error) {
    logger.error({ error }, "Error updating goal")
    return { success: false, error: "Failed to update goal" }
  }
}

/**
 * Create an item goal with associated item metadata
 */
export async function createItemGoal(
  tileId: string,
  itemId: number,
  itemName: string,
  baseName: string,
  imageUrl: string,
  targetValue: number,
  exactVariant?: string | null,
  parentGroupId?: string | null
) {
  const result = await createGoals(
    tileId,
    [
      {
        type: "item",
        itemId,
        itemName,
        baseName,
        imageUrl,
        targetValue,
        exactVariant,
      },
    ],
    { parentGroupId }
  )
  if (!result.success) return result
  const created = result.goals[0]
  return {
    success: true as const,
    goal: created?.goal,
    itemGoal: created && "itemGoal" in created ? created.itemGoal : undefined,
  }
}

export async function createMetricGoal(
  tileId: string,
  metricType: string,
  metricName: string,
  targetValue: number,
  description?: string,
  parentGroupId?: string | null
) {
  const result = await createGoals(
    tileId,
    [{ type: "metric", metricType, metricName, targetValue, description }],
    { parentGroupId }
  )
  if (!result.success) return result
  const created = result.goals[0]
  return {
    success: true as const,
    goal: created?.goal,
    metricGoal:
      created && "metricGoal" in created ? created.metricGoal : undefined,
  }
}

export async function updateMetricGoal(
  goalId: string,
  metricType: string,
  metricName: string,
  targetValue: number,
  description?: string
) {
  try {
    await requireBingoAdminForGoal(goalId)
    const targetError = validateTargetValue(targetValue)
    if (targetError) return { success: false, error: targetError }
    const goalDescription = metricGoalDescription(metricName, description)

    // Update the base goal
    await db
      .update(goals)
      .set({
        description: goalDescription,
        targetValue,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goalId))

    // Update the metric goal metadata
    await db
      .update(metricGoals)
      .set({
        metricType,
        metricName,
        updatedAt: new Date(),
      })
      .where(eq(metricGoals.goalId, goalId))

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating metric goal")
    return { success: false, error: "Failed to update metric goal" }
  }
}

/**
 * Get goal with item data if it's an item goal
 */
export async function getGoalWithItemData(goalId: string) {
  try {
    // Hidden Tiles must not leak their Goals to non-managers.
    if (!(await canReadGoal(goalId))) {
      return { success: false, error: "Goal not found" }
    }

    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
      with: {
        itemGoal: true,
      },
    })

    if (!goal) {
      return { success: false, error: "Goal not found" }
    }

    return { success: true, goal }
  } catch (error) {
    logger.error({ error }, "Error getting goal with item data")
    return { success: false, error: "Failed to get goal" }
  }
}

/**
 * Update item goal metadata
 */
export async function updateItemGoal(
  goalId: string,
  itemId: number,
  itemName: string,
  baseName: string,
  imageUrl: string,
  exactVariant?: string | null,
  targetValue?: number
) {
  try {
    await requireBingoAdminForGoal(goalId)
    if (targetValue !== undefined) {
      const targetError = validateTargetValue(targetValue)
      if (targetError) return { success: false, error: targetError }
    }
    // Build goal update object
    const goalUpdate: Partial<typeof goals.$inferInsert> & { updatedAt: Date } =
      {
        description: itemName,
        updatedAt: new Date(),
      }

    if (targetValue !== undefined) {
      goalUpdate.targetValue = targetValue
    }

    // Update goal description and optionally target value
    await db.update(goals).set(goalUpdate).where(eq(goals.id, goalId))

    // Update item goal metadata
    const [updatedItemGoal] = await db
      .update(itemGoals)
      .set({
        itemId,
        baseName,
        exactVariant: exactVariant ?? null,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(itemGoals.goalId, goalId))
      .returning()

    return { success: true, itemGoal: updatedItemGoal }
  } catch (error) {
    logger.error({ error }, "Error updating item goal")
    return { success: false, error: "Failed to update item goal" }
  }
}

/**
 * Get all item goals for a tile
 */
export async function getItemGoalsForTile(tileId: string) {
  try {
    if (!(await canReadTile(tileId))) {
      return { success: true, goals: [] }
    }

    const itemGoalsList = await db.query.goals.findMany({
      where: and(eq(goals.tileId, tileId), eq(goals.goalType, "item")),
      with: {
        itemGoal: true,
      },
    })

    return { success: true, goals: itemGoalsList }
  } catch (error) {
    logger.error({ error }, "Error getting item goals for tile")
    return { success: false, error: "Failed to get item goals" }
  }
}

export async function updateGoalProgress(
  goalId: string,
  teamId: string,
  newValue: number
) {
  try {
    // Manual progress edits are a management action. The Event is derived
    // from the Goal; the Team must belong to the same Event.
    const eventId = await requireBingoAdminForGoal(goalId)
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      columns: { eventId: true },
    })
    if (!team || team.eventId !== eventId) {
      return { success: false, error: "Team not found in this event" }
    }

    const updatedProgress = await db.transaction(async (tx) => {
      const [progress] = await tx
        .insert(teamGoalProgress)
        .values({
          goalId,
          teamId,
          currentValue: newValue,
        })
        .onConflictDoUpdate({
          target: [teamGoalProgress.goalId, teamGoalProgress.teamId],
          set: { currentValue: newValue },
        })
        .returning()

      // Check if we need to auto-complete the tile
      const goal = await tx.query.goals.findFirst({
        where: eq(goals.id, goalId),
      })

      if (goal) {
        // Import the auto-completion function
        const { checkAndAutoCompleteTile } = await import("./tile-completion")
        await checkAndAutoCompleteTile(tx, goal.tileId, teamId)
      }

      return progress
    })

    revalidatePath("/events/[id]", "layout")

    return { success: true, progress: updatedProgress }
  } catch (error) {
    logger.error({ error }, "Error updating goal progress")
    return {
      success: false,
      error: authzErrorMessage(error, "Failed to update goal progress"),
    }
  }
}

export async function getTileGoalsAndProgress(tileId: string) {
  // Hidden Tiles must not leak their Goals to non-managers.
  if (!(await canReadTile(tileId))) return []

  const tileGoals = await db.query.goals.findMany({
    where: eq(goals.tileId, tileId),
    with: {
      teamProgress: true,
      goalValues: true, // Add this line to include goal values
    },
  })

  return tileGoals
}

// Types GoalData, TileData, BingoData are imported from @/types/model

// Update the getAllSubmissionsForTeam function to include goal information
export async function getAllSubmissionsForTeam(
  bingoId: string,
  teamId: string
): Promise<Record<string, TeamTileSubmission[]>> {
  try {
    // Submissions (with images and users) are only visible to the Team itself
    // and to managers of the Event.
    await requireTeamMemberOrManager(teamId)

    // A blind battleship board (before its Event starts) has nothing to show
    // to non-managers: the Tiles carried in these records would reveal it.
    if (await isBingoBlindForViewer(bingoId)) return {}

    // First, get all tiles for this bingo
    const bingoTiles = await db
      .select({ id: tiles.id })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))

    if (!bingoTiles.length) {
      return {}
    }

    // Get all tile IDs
    const tileIds = bingoTiles.map((tile) => tile.id)

    // Fetch all submissions for this team across all tiles in the bingo
    // Type assertion is safe here because:
    // 1. The query structure matches TeamTileSubmission interface exactly
    // 2. Drizzle's type inference doesn't match our custom interfaces
    // 3. The relations ensure correct data structure at runtime
    const teamSubmissions = (await db.query.teamTileSubmissions.findMany({
      with: {
        submissions: {
          with: {
            image: true,
            user: { columns: { id: true, name: true, runescapeName: true } },
            goal: true, // Include goal information
          },
        },
        team: true,
        tile: {
          with: {
            bingo: {
              columns: {
                id: true,
                title: true,
              },
            },
            goals: {
              with: {
                itemGoal: true,
              }
            }
          }
        }
      },
      where: and(
        eq(teamTileSubmissions.teamId, teamId),
        inArray(teamTileSubmissions.tileId, tileIds)
      ),
    })) as unknown as TeamTileSubmission[]

    // Group submissions by tile ID
    const submissionsByTile: Record<string, TeamTileSubmission[]> = {}

    for (const submission of teamSubmissions) {
      const tileId = submission.tileId
      if (!submissionsByTile[tileId]) {
        submissionsByTile[tileId] = []
      }
      submissionsByTile[tileId].push(submission)
    }

    return submissionsByTile
  } catch (error) {
    logger.error({ error }, "Error fetching team submissions")
    throw new Error("Failed to fetch team submissions")
  }
}

// Update the submitImage function to send image as Discord attachment
// Supports submitting on behalf of another user via onBehalfOfUserId parameter
export async function submitImage(formData: FormData) {
  try {
    const tileId = formData.get("tileId") as string
    const teamId = formData.get("teamId") as string
    const image = formData.get("image") as File
    const onBehalfOfUserId = formData.get("onBehalfOfUserId") as string | null

    if (!tileId || !teamId || !image) {
      throw new Error("Missing required fields")
    }

    // Get session first to validate user
    const session = await getServerAuthSession()
    if (!session?.user) {
      throw new Error("Not authenticated")
    }

    // Check if the tile exists and get its bingoId
    const tileResult = await db
      .select({
        id: tiles.id,
        bingoId: tiles.bingoId,
        title: tiles.title,
        description: tiles.description,
        isHidden: tiles.isHidden,
      })
      .from(tiles)
      .where(eq(tiles.id, tileId))
      .execute()

    if (tileResult.length === 0) {
      throw new Error("Tile not found")
    }

    const tile = tileResult[0]!

    // Get bingo and event information
    const bingoResult = await db.query.bingos.findFirst({
      where: eq(bingos.id, tile.bingoId),
      with: {
        event: true,
      },
    })

    if (!bingoResult) {
      throw new Error("Bingo not found")
    }

    // Determine the target user for the submission
    const targetUserId = onBehalfOfUserId || session.user.id

    // Validate permission to submit on behalf of another user
    if (onBehalfOfUserId && onBehalfOfUserId !== session.user.id) {
      const canSubmit = await canSubmitOnBehalfOf(
        session.user.id,
        onBehalfOfUserId,
        teamId,
        bingoResult.eventId
      )
      if (!canSubmit) {
        throw new Error(
          "You do not have permission to submit on behalf of this user"
        )
      }
    }

    // Determine the correct team ID - use the target user's team when submitting on behalf
    let effectiveTeamId = teamId
    let targetUser = session.user as {
      id: string
      name: string | null
      runescapeName: string | null
    }

    if (onBehalfOfUserId && onBehalfOfUserId !== session.user.id) {
      // Look up the target user's team in this event
      const targetUserTeamResult = await db
        .select({
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
          teamId: teams.id,
          teamName: teams.name,
        })
        .from(users)
        .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
        .leftJoin(
          teams,
          and(
            eq(teamMembers.teamId, teams.id),
            eq(teams.eventId, bingoResult.eventId)
          )
        )
        .where(eq(users.id, onBehalfOfUserId))
        .execute()

      if (targetUserTeamResult.length > 0) {
        // Find the record with a valid teamId for this event, or fallback to the first record
        const targetUserData = targetUserTeamResult.find(r => r.teamId !== null) || targetUserTeamResult[0]
        
        if (targetUserData) {
          targetUser = {
            id: targetUserData.id,
            name: targetUserData.name,
            runescapeName: targetUserData.runescapeName,
          }
          // Use the target user's team if they have one
          if (targetUserData.teamId) {
            effectiveTeamId = targetUserData.teamId
          }
        }
      }
    }

    // Check if the team exists and get its name
    const teamResult = await db
      .select({ id: teams.id, name: teams.name, eventId: teams.eventId })
      .from(teams)
      .where(eq(teams.id, effectiveTeamId))
      .execute()

    if (teamResult.length === 0) {
      throw new Error("Team not found")
    }

    const team = teamResult[0]!

    // Participant authorization: the Team must belong to the Tile's Event and
    // the caller must be a member of that Team (or manage the Event). Hidden
    // Tiles can only be submitted to by managers.
    if (team.eventId !== bingoResult.eventId) {
      throw new Error("Team does not belong to this event")
    }
    const callerIsManager = await isEventManager(bingoResult.eventId)
    if (!callerIsManager) {
      // Hidden Tiles, and the Tiles of a blind battleship board (before its
      // Event starts), are indistinguishable from missing ones.
      const blind = isBlindBoard({
        bingoType: bingoResult.bingoType,
        startDate: bingoResult.event.startDate,
        isManager: false,
      })
      if (tile.isHidden || blind) {
        throw new Error("Tile not found")
      }
      const callerMembership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, effectiveTeamId),
          eq(teamMembers.userId, session.user.id)
        ),
        columns: { id: true },
      })
      if (!callerMembership) {
        throw new Error("You are not a member of this team")
      }
    }

    // Ensure the upload directory exists
    await ensureUploadDir()

    // Generate a unique filename
    const filename = `${nanoid()}`
    const filePath = path.join(UPLOAD_DIR, filename)

    // Write the file to the server
    const buffer = Buffer.from(await image.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Calculate the relative path for storage and serving
    const relativePath = path.join("/uploads", filename).replace(/\\/g, "/")

    const newSubmission = await db.transaction(async (tx) => {
      // Get or create teamTileSubmission
      const [teamTileSubmission] = await tx
        .insert(teamTileSubmissions)
        .values({
          tileId,
          teamId: effectiveTeamId,
          status: "incomplete",
        })
        .onConflictDoUpdate({
          target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
          set: {
            updatedAt: new Date(),
            status: sql`CASE WHEN ${teamTileSubmissions.status} = 'completed' THEN 'completed'::tile_completion_status ELSE 'incomplete'::tile_completion_status END`,
          },
        })
        .returning()

      // Insert the image record
      const [insertedImage] = await tx
        .insert(images)
        .values({
          path: relativePath,
        })
        .returning()

      // Insert the submission record with target user as submittedBy
      const [insertedSubmission] = await tx
        .insert(submissions)
        .values({
          teamTileSubmissionId: teamTileSubmission!.id,
          submittedBy: targetUserId,
          imageId: insertedImage!.id,
          // No goalId here - will be assigned during review
        })
        .returning()

      return {
        submission: insertedSubmission,
        image: insertedImage,
        teamTileSubmission,
      }
    })

    // Create a notification for admin and management users
    await createNotification(
      bingoResult.eventId,
      tileId,
      effectiveTeamId,
      `Team ${team.name} has submitted an image for tile "${tile.title}"`
    )

    // Send Discord webhook notifications
    try {
      // Get active Discord webhooks for this event
      const activeWebhooks = await db.query.discordWebhooks.findMany({
        where: and(
          eq(discordWebhooks.eventId, bingoResult.event.id),
          eq(discordWebhooks.isActive, true)
        ),
      })

      if (activeWebhooks.length > 0) {
        // Get submission count for this team/tile combination
        const submissionCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(submissions)
          .innerJoin(
            teamTileSubmissions,
            eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
          )
          .where(
            and(
              eq(teamTileSubmissions.tileId, tileId),
              eq(teamTileSubmissions.teamId, effectiveTeamId)
            )
          )

        const count = submissionCount[0]?.count || 1

        // Generate team color
        const teamColor = `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`

        // Use targetUser for Discord embed (shows correct user when submitting on behalf)
        const embedData = {
          userName: targetUser.name || "Unknown",
          runescapeName: targetUser.runescapeName,
          teamName: team.name,
          tileName: tile.title,
          tileDescription: tile.description,
          eventTitle: bingoResult.event.title,
          bingoTitle: bingoResult.title,
          submissionCount: count,
          teamColor,
        }

        const embed = createSubmissionEmbed(embedData)

        // Prepare the image file for Discord attachment
        const imageExtension = image.name.split(".").pop() || "png"
        const discordFileName = `submission_${nanoid()}.${imageExtension}`

        // Send to all active webhooks
        const webhookPromises = activeWebhooks.map((webhook) =>
          sendDiscordWebhook(webhook.webhookUrl, {
            embeds: [embed],
            files: [
              {
                attachment: buffer,
                name: discordFileName,
              },
            ],
          })
        )

        await Promise.allSettled(webhookPromises)
      }
    } catch (discordError) {
      // Log Discord errors but don't fail the submission
      logger.error({ error: discordError }, "Discord webhook error")
    }

    // Revalidate the bingo page
    revalidatePath("/bingo")

    logger.info(
      {
        submissionId: newSubmission?.submission?.id,
        tileId,
        teamId: effectiveTeamId,
        submitterId: session.user.id,
        targetUserId: targetUser.id,
        action: "submitImage",
      },
      "Image submitted successfully"
    )

    return { success: true, submission: newSubmission.submission }
  } catch (error) {
    const catchTileId = formData.get("tileId") as string | null
    logger.error(
      { error, tileId: catchTileId, action: "submitImage" },
      "Error submitting image"
    )
    return { success: false, error: (error as Error).message }
  }
}

// Add new server action for updating individual submission status and assigning a goal
export async function updateSubmissionStatus(
  submissionId: string,
  newStatus: "approved" | "needs_review" | "pending",
  goalId?: string | null,
  submissionValue?: number | null
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    // H4 fix: derive the event from the submission record itself, never trust
    // a caller-supplied eventId.  Verify the caller is admin/management.
    const submissionRecord = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        teamTileSubmission: {
          with: { tile: { with: { bingo: { columns: { eventId: true } } } } },
        },
      },
    })
    if (!submissionRecord) throw new Error("Submission not found")
    const eventId = submissionRecord.teamTileSubmission.tile.bingo.eventId
    const callerRole = await getUserRole(eventId)
    if (callerRole !== "admin" && callerRole !== "management") {
      throw new Error("Forbidden: admin or management role required")
    }

    logger.info(
      { submissionId, newStatus, goalId, submissionValue },
      "Updating submission status"
    )

    // Create the update data object
    const updateData: Record<string, any> = {
      status: newStatus,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }

    // Only update goalId if it's provided (including null to remove a goal)
    if (goalId !== undefined) {
      updateData.goalId = goalId
    }

    // Update submission value if provided
    if (submissionValue !== undefined) {
      updateData.submissionValue = submissionValue ?? 1
    }

    // Fetch the old submission before updating to get the correct oldGoalId
    const oldSubmissionRecord = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        teamTileSubmission: true
      }
    })

    if (!oldSubmissionRecord || !oldSubmissionRecord.teamTileSubmission) {
      throw new Error("Associated team tile submission not found")
    }

    const [updatedSubmission] = await db.update(submissions)
      .set(updateData)
      .where(eq(submissions.id, submissionId))
      .returning()

    if (!updatedSubmission) {
      throw new Error("Submission not found")
    }

    // If marking individual submission as "needs_review", update the parent tile status
    if (newStatus === "needs_review") {
      await db
        .update(teamTileSubmissions)
        .set({
          status: "needs_attention",
          completedAt: null,
          reviewedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(
          eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
        )
    } else {
      // Reconcile needs_attention status if parent was needs_attention
      const teamSubmission = await db.query.teamTileSubmissions.findFirst({
        where: eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
      })
      if (teamSubmission?.status === "needs_attention") {
        const remainingNeedsReview = await db.query.submissions.findFirst({
          where: and(
            eq(submissions.teamTileSubmissionId, teamSubmission.id),
            eq(submissions.status, "needs_review")
          )
        })
        if (!remainingNeedsReview) {
          // If no remaining submissions need review, revert tile to incomplete
          await db.update(teamTileSubmissions)
            .set({ status: "incomplete", updatedAt: new Date() })
            .where(eq(teamTileSubmissions.id, teamSubmission.id))
        }
      }
    }

    // Goal-less tile auto-completion
    if (newStatus === "approved") {
      const goalsResult = await db.query.goals.findMany({
        where: eq(goals.tileId, oldSubmissionRecord.teamTileSubmission.tileId)
      });
      
      if (goalsResult.length === 0) {
        await db.update(teamTileSubmissions)
          .set({
            status: "completed",
            completedAt: completedAtOnComplete,
            reviewedBy: session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId));
      }
    }

    // If submission has a goal assignment, recalculate goal progress
    const { recalculateGoalProgress } = await import("./goals")
    const oldGoalId = oldSubmissionRecord.goalId
    const teamId = oldSubmissionRecord.teamTileSubmission.teamId

    if (oldGoalId && oldGoalId !== updatedSubmission.goalId) {
      await recalculateGoalProgress(db, oldGoalId, teamId)
    }
    if (updatedSubmission.goalId) {
      await recalculateGoalProgress(db, updatedSubmission.goalId, teamId)
    }

    // Revalidate the submissions page
    revalidatePath("/bingo")

    logger.info(
      {
        submissionId,
        newStatus,
        reviewerId: session.user.id,
        action: "updateSubmissionStatus",
      },
      "Submission status updated"
    )

    return { success: true, submission: updatedSubmission }
  } catch (error) {
    logger.error(
      { error, submissionId, action: "updateSubmissionStatus" },
      "Error updating submission status"
    )
    return { success: false, error: error instanceof Error ? error.message : "Failed to update submission status" }
  }
}

// Keep the existing updateTeamTileSubmissionStatus function but remove any automatic propagation
export async function updateTeamTileSubmissionStatus(
  teamTileSubmissionId: string,
  newStatus: "completed" | "needs_attention"
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    // Completing/flagging a Tile is a review action: managers only. The Event
    // is derived from the team tile submission record.
    await requireBingoAdminForTeamTileSubmission(teamTileSubmissionId)

    const [updatedTeamTileSubmission] = await db
      .update(teamTileSubmissions)
      .set({
        status: newStatus,
        completedAt:
          newStatus === "completed" ? completedAtOnComplete : null,
        reviewedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(teamTileSubmissions.id, teamTileSubmissionId))
      .returning()

    if (!updatedTeamTileSubmission) {
      throw new Error("Team tile submission not found")
    }

    // If approving the whole tile, approve all pending individual submissions
    if (newStatus === "completed") {
      const pendingSubmissions = await db.query.submissions.findMany({
        where: and(
          eq(submissions.teamTileSubmissionId, teamTileSubmissionId),
          eq(submissions.status, "pending")
        )
      })

      if (pendingSubmissions.length > 0) {
        await db
          .update(submissions)
          .set({
            status: "approved",
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(submissions.teamTileSubmissionId, teamTileSubmissionId),
              eq(submissions.status, "pending")
            )
          )

        // Recalculate goal progress for updated submissions
        const { recalculateGoalProgress } = await import("./goals")
        const teamId = updatedTeamTileSubmission.teamId
        for (const sub of pendingSubmissions) {
          if (sub.goalId) {
            await recalculateGoalProgress(db, sub.goalId, teamId)
          }
        }
      }

      // Check for tier unlock in progression bingo
      const tile = await db.query.tiles.findFirst({
        where: eq(tiles.id, updatedTeamTileSubmission.tileId),
        with: { bingo: true },
      })

      if (tile && tile.bingo.bingoType === "progression") {
        await checkAndUnlockNextTier(
          updatedTeamTileSubmission.teamId,
          tile.bingoId
        )
      }
    }

    // Revalidate the submissions page
    revalidatePath("/bingo")

    logger.info(
      {
        teamTileSubmissionId,
        newStatus,
        reviewerId: session.user.id,
        action: "updateTeamTileSubmissionStatus",
      },
      "Team tile submission status updated"
    )

    return { success: true, teamTileSubmission: updatedTeamTileSubmission }
  } catch (error) {
    logger.error(
      { error, teamTileSubmissionId, action: "updateTeamTileSubmissionStatus" },
      "Error updating team tile submission status"
    )
    return {
      success: false,
      error: authzErrorMessage(
        error,
        "Failed to update team tile submission status"
      ),
    }
  }
}

// New function for updating submission status with comment (used when marking as "needs_review")
export async function updateSubmissionStatusWithComment(
  submissionId: string,
  newStatus: "approved" | "needs_review" | "pending",
  comment?: string,
  goalId?: string | null,
  submissionValue?: number | null
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    // H4 fix: derive the event from the submission record itself, verify role.
    const submissionRecord = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        teamTileSubmission: {
          with: { tile: { with: { bingo: { columns: { eventId: true } } } } },
        },
      },
    })
    if (!submissionRecord) throw new Error("Submission not found")
    const eventId = submissionRecord.teamTileSubmission.tile.bingo.eventId
    const callerRole = await getUserRole(eventId)
    if (callerRole !== "admin" && callerRole !== "management") {
      throw new Error("Forbidden: admin or management role required")
    }

    logger.info(
      { submissionId, newStatus, comment },
      "Updating submission status with comment"
    )

    return await db.transaction(async (tx) => {
      // Create the update data object
      const updateData: Record<string, any> = {
        status: newStatus,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }

      // Only update goalId if it's provided (including null to remove a goal)
      if (goalId !== undefined) {
        updateData.goalId = goalId
      }

      // Update submission value if provided
      if (submissionValue !== undefined) {
        updateData.submissionValue = submissionValue
      }

      const [updatedSubmission] = await tx
        .update(submissions)
        .set(updateData)
        .where(eq(submissions.id, submissionId))
        .returning()

      if (!updatedSubmission) {
        throw new Error("Submission not found")
      }

      // Add comment if provided (required for "needs_review" status)
      if (comment && comment.trim()) {
        await tx.insert(submissionComments).values({
          submissionId: submissionId,
          authorId: session.user.id,
          comment: comment.trim(),
        })
      }

      // If marking individual submission as "needs_review", update the parent tile status
      if (newStatus === "needs_review") {
        await tx
          .update(teamTileSubmissions)
          .set({
            status: "needs_attention",
            completedAt: null,
            reviewedBy: session.user.id,
            updatedAt: new Date(),
          })
          .where(
            eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
          )
      } else {
        // Reconcile needs_attention status if parent was needs_attention
        const teamSubmission = await tx.query.teamTileSubmissions.findFirst({
          where: eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
        })
        if (teamSubmission?.status === "needs_attention") {
          const remainingNeedsReview = await tx.query.submissions.findFirst({
            where: and(
              eq(submissions.teamTileSubmissionId, teamSubmission.id),
              eq(submissions.status, "needs_review")
            )
          })
          if (!remainingNeedsReview) {
            // If no remaining submissions need review, revert tile to incomplete
            await tx.update(teamTileSubmissions)
              .set({ status: "incomplete", updatedAt: new Date() })
              .where(eq(teamTileSubmissions.id, teamSubmission.id))
          }
        }
      }

      // Goal-less tile auto-completion
      if (newStatus === "approved") {
        const goalsResult = await tx.query.goals.findMany({
          where: eq(goals.tileId, submissionRecord.teamTileSubmission.tileId)
        });
        
        if (goalsResult.length === 0) {
          await tx.update(teamTileSubmissions)
            .set({
              status: "completed",
              completedAt: completedAtOnComplete,
              reviewedBy: session.user.id,
              updatedAt: new Date(),
            })
            .where(eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId));
        }
      }

      // If submission has a goal assignment, recalculate goal progress
      const { recalculateGoalProgress } = await import("./goals")
      const oldGoalId = submissionRecord.goalId
      const teamId = submissionRecord.teamTileSubmission.teamId

      if (oldGoalId && oldGoalId !== updatedSubmission.goalId) {
        await recalculateGoalProgress(tx, oldGoalId, teamId)
      }
      if (updatedSubmission.goalId) {
        await recalculateGoalProgress(tx, updatedSubmission.goalId, teamId)
      }

      // Revalidate the submissions page
      revalidatePath("/bingo")

      logger.info(
        {
          submissionId,
          newStatus,
          reviewerId: session.user.id,
          action: "updateSubmissionStatusWithComment",
        },
        "Submission status with comment updated"
      )

      return { success: true, submission: updatedSubmission }
    })
  } catch (error) {
    logger.error(
      { error, submissionId, action: "updateSubmissionStatusWithComment" },
      "Error updating submission status with comment"
    )
    return { success: false, error: "Failed to update submission status" }
  }
}

export async function deleteSubmission(submissionId: string) {
  try {
    await requireBingoAdminForSubmission(submissionId)

    return await db.transaction(async (tx) => {
      // First, get the submission to find the associated image and goal
      const [submission] = await tx
        .select({
          id: submissions.id,
          imageId: submissions.imageId,
          teamTileSubmissionId: submissions.teamTileSubmissionId,
          goalId: submissions.goalId,
        })
        .from(submissions)
        .where(eq(submissions.id, submissionId))

      if (!submission) {
        throw new Error("Submission not found")
      }

      // Fetch team submission to get the teamId for progress recalculation
      const teamSubmission = await tx.query.teamTileSubmissions.findFirst({
        where: (tts, { eq }) => eq(tts.id, submission.teamTileSubmissionId),
      })

      // Get the image path for potential file deletion
      const [imageRecord] = await tx
        .select({ path: images.path })
        .from(images)
        .where(eq(images.id, submission.imageId))

      // Delete the submission record
      await tx.delete(submissions).where(eq(submissions.id, submissionId))

      // Check if the image is still referenced by other submissions
      const otherSubmissionsUsingImage = await tx.query.submissions.findFirst({
        where: (subs, { eq }) => eq(subs.imageId, submission.imageId)
      })

      // If no other submissions use this image, it's safe to delete
      if (!otherSubmissionsUsingImage && imageRecord) {
        await tx.delete(images).where(eq(images.id, submission.imageId))
        
        if (imageRecord.path) {
          // Delete the image file from the filesystem
          const filePath = path.join(process.cwd(), "public", imageRecord.path)
          try {
            await fs.access(filePath)
            await fs.unlink(filePath)
          } catch (fileError) {
            // If file doesn't exist, just log and continue
            logger.warn(
              { error: fileError, filePath },
              `Could not delete file at ${filePath}`
            )
          }
        }
      }

      // Recalculate goal progress if it had a goal
      if (submission.goalId && teamSubmission?.teamId) {
        const { recalculateGoalProgress } = await import("./goals")
        await recalculateGoalProgress(tx, submission.goalId, teamSubmission.teamId)
      }

      // Reconcile needs_attention status if parent was needs_attention
      if (teamSubmission?.status === "needs_attention") {
        const remainingNeedsReview = await tx.query.submissions.findFirst({
          where: (subs, { eq, and }) => and(
            eq(subs.teamTileSubmissionId, submission.teamTileSubmissionId),
            eq(subs.status, "needs_review")
          )
        })
        
        if (!remainingNeedsReview) {
          // If no remaining submissions need review, revert tile to incomplete
          await tx.update(teamTileSubmissions)
            .set({ status: "incomplete", updatedAt: new Date() })
            .where(eq(teamTileSubmissions.id, submission.teamTileSubmissionId))
        }
      }

      revalidatePath("/")
      return { success: true }
    })
  } catch (error) {
    logger.error({ error }, "Error deleting submission")
    return { success: false, error: (error as Error).message }
  }
}

export async function addRowOrColumn(
  bingoId: string,
  type: "row" | "column"
): Promise<AddRowOrColumnResult> {
  try {
    await requireBingoAdmin(bingoId)
    return await db.transaction(async (tx) => {
      await assertBattleshipLayoutEditable(tx, bingoId)
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const newSize = type === "row" ? bingo.rows + 1 : bingo.columns + 1
      const totalTiles =
        type === "row" ? newSize * bingo.columns : bingo.rows * newSize

      // Update bingo size
      await tx
        .update(bingos)
        .set({ [type === "row" ? "rows" : "columns"]: newSize })
        .where(eq(bingos.id, bingoId))

      // Get existing tiles
      const existingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
      const [updated] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))

      // Create new tiles
      const newTiles = []
      for (let i = existingTiles.length; i < totalTiles; i++) {
        newTiles.push({
          bingoId,
          title: `New Tile ${i + 1}`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: i,
          isHidden: false,
        })
      }

      if (newTiles.length > 0) {
        await tx.insert(tiles).values(newTiles)
      }

      // Fetch all tiles after update
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo: updated! }
    })
  } catch (error) {
    logger.error({ error }, "Error adding row or column")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to add row or column"),
    }
  }
}

export async function deleteTile(tileId: string, bingoId: string) {
  try {
    await requireBingoAdmin(bingoId)
    await db.transaction(async (tx) => {
      await assertBattleshipLayoutEditable(tx, bingoId)

      // Delete the tile (scoped to the board the caller was authorized for)
      await tx
        .delete(tiles)
        .where(and(eq(tiles.id, tileId), eq(tiles.bingoId, bingoId)))

      // Get remaining tiles
      const remainingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      // Reorder remaining tiles
      for (let i = 0; i < remainingTiles.length; i++) {
        await tx
          .update(tiles)
          .set({ index: i })
          .where(eq(tiles.id, remainingTiles[i]!.id))
      }

      // Update bingo dimensions
      await tx.select().from(bingos).where(eq(bingos.id, bingoId))

      const newTotalTiles = remainingTiles.length
      const newRows = Math.floor(Math.sqrt(newTotalTiles))
      const newColumns = Math.ceil(newTotalTiles / newRows)

      await tx
        .update(bingos)
        .set({ rows: newRows, columns: newColumns })
        .where(eq(bingos.id, bingoId))
    })

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting tile")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to delete tile"),
    }
  }
}

export async function addTile(bingoId: string): Promise<AddRowOrColumnResult> {
  try {
    await requireBingoAdmin(bingoId)
    return await db.transaction(async (tx) => {
      await assertBattleshipLayoutEditable(tx, bingoId)
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const totalTiles = bingo.rows * bingo.columns + 1

      // Create new tile
      await tx
        .insert(tiles)
        .values({
          bingoId,
          title: `New Tile ${totalTiles}`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: totalTiles - 1,
          isHidden: false,
        })
        .returning()

      // Update bingo dimensions
      const newColumns = Math.ceil(Math.sqrt(totalTiles))
      const newRows = Math.ceil(totalTiles / newColumns)

      await tx
        .update(bingos)
        .set({ rows: newRows, columns: newColumns })
        .where(eq(bingos.id, bingoId))
      bingo.columns = newColumns
      bingo.rows = newRows

      // Fetch all tiles after update
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo }
    })
  } catch (error) {
    logger.error({ error }, "Error adding tile")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to add tile"),
    }
  }
}

export async function deleteRowOrColumn(
  bingoId: string,
  type: "row" | "column"
): Promise<AddRowOrColumnResult> {
  try {
    await requireBingoAdmin(bingoId)
    return await db.transaction(async (tx) => {
      await assertBattleshipLayoutEditable(tx, bingoId)
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      if (
        (type === "row" && bingo.rows <= 1) ||
        (type === "column" && bingo.columns <= 1)
      ) {
        throw new Error(`Cannot delete the last ${type}`)
      }

      const newSize = type === "row" ? bingo.rows - 1 : bingo.columns - 1

      // Update bingo size
      await tx
        .update(bingos)
        .set({ [type === "row" ? "rows" : "columns"]: newSize })
        .where(eq(bingos.id, bingoId))

      // Get existing tiles
      const existingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      // Delete tiles
      const tilesToDelete =
        type === "row"
          ? existingTiles.slice(-bingo.columns)
          : existingTiles.filter(
              (_, index) => (index + 1) % bingo.columns === 0
            )

      await tx.delete(tiles).where(
        inArray(
          tiles.id,
          tilesToDelete.map((tile) => tile.id)
        )
      )

      // Reindex remaining tiles
      const remainingTiles = existingTiles.filter(
        (tile) => !tilesToDelete.includes(tile)
      )
      for (let i = 0; i < remainingTiles.length; i++) {
        await tx
          .update(tiles)
          .set({ index: i })
          .where(eq(tiles.id, remainingTiles[i]!.id))
      }

      // Fetch updated bingo and tiles
      const [updatedBingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      return { success: true, tiles: updatedTiles, bingo: updatedBingo! }
    })
  } catch (error) {
    logger.error({ error, type }, `Error deleting ${type}`)
    return {
      success: false,
      error: battleshipErrorMessage(error, `Failed to delete ${type}`),
    }
  }
}

interface UpdateBingoData {
  title: string
  description: string
  visible: boolean
  locked: boolean
  codephrase: string
  bingoType?: BingoType
  tiersUnlockRequirement?: number
}

interface PatternBonusData {
  rowBonuses?: Record<number, number>
  columnBonuses?: Record<number, number>
  mainDiagonalBonus?: number
  antiDiagonalBonus?: number
  completeBoardBonus?: number
}

interface UpdateBingoDataWithBonuses extends UpdateBingoData {
  patternBonuses?: PatternBonusData
  /**
   * New fleet rules of a battleship board. Applied in the same transaction as
   * the other settings and clears every team's placed fleet.
   */
  shipRules?: ShipRule[]
}

export async function updateBingo(
  bingoId: string,
  data: UpdateBingoDataWithBonuses
) {
  try {
    await requireBingoAdmin(bingoId)
    if (data.shipRules !== undefined && !isShipRuleList(data.shipRules)) {
      return { success: false, error: "Invalid ship rules" }
    }
    let clearedTeams: number | undefined
    await db.transaction(async (tx) => {
      if (data.bingoType !== undefined) {
        const [current] = await tx
          .select({ bingoType: bingos.bingoType })
          .from(bingos)
          .where(eq(bingos.id, bingoId))
          .for("no key update")
        if (
          current &&
          current.bingoType !== data.bingoType &&
          (current.bingoType === "battleship" ||
            data.bingoType === "battleship")
        ) {
          throw new BattleshipRuleError(
            "A board cannot be changed to or from the battleship type"
          )
        }
      }

      const updateData: any = {
        title: data.title,
        description: data.description,
        visible: data.visible,
        locked: data.locked,
        codephrase: data.codephrase,
        updatedAt: new Date(),
      }

      if (data.bingoType !== undefined) {
        updateData.bingoType = data.bingoType
      }

      if (data.tiersUnlockRequirement !== undefined) {
        updateData.tiersUnlockRequirement = data.tiersUnlockRequirement
      }

      // Update pattern bonuses if provided
      if (data.patternBonuses?.mainDiagonalBonus !== undefined) {
        updateData.mainDiagonalBonusXP = data.patternBonuses.mainDiagonalBonus
      }

      if (data.patternBonuses?.antiDiagonalBonus !== undefined) {
        updateData.antiDiagonalBonusXP = data.patternBonuses.antiDiagonalBonus
      }

      if (data.patternBonuses?.completeBoardBonus !== undefined) {
        updateData.completeBoardBonusXP = data.patternBonuses.completeBoardBonus
      }

      await tx.update(bingos).set(updateData).where(eq(bingos.id, bingoId))

      // Update row bonuses if provided
      if (data.patternBonuses?.rowBonuses) {
        for (const [rowIndexStr, bonusXP] of Object.entries(
          data.patternBonuses.rowBonuses
        )) {
          const rowIndex = parseInt(rowIndexStr)

          // Check if row bonus exists
          const existingBonus = await tx.query.rowBonuses.findFirst({
            where: and(
              eq(rowBonuses.bingoId, bingoId),
              eq(rowBonuses.rowIndex, rowIndex)
            ),
          })

          if (bonusXP > 0) {
            if (existingBonus) {
              // Update existing bonus
              await tx
                .update(rowBonuses)
                .set({ bonusXP, updatedAt: new Date() })
                .where(eq(rowBonuses.id, existingBonus.id))
            } else {
              // Insert new bonus
              await tx.insert(rowBonuses).values({
                bingoId,
                rowIndex,
                bonusXP,
              })
            }
          } else if (existingBonus) {
            // Delete bonus if set to 0
            await tx
              .delete(rowBonuses)
              .where(eq(rowBonuses.id, existingBonus.id))
          }
        }
      }

      // Update column bonuses if provided
      if (data.patternBonuses?.columnBonuses) {
        for (const [columnIndexStr, bonusXP] of Object.entries(
          data.patternBonuses.columnBonuses
        )) {
          const columnIndex = parseInt(columnIndexStr)

          // Check if column bonus exists
          const existingBonus = await tx.query.columnBonuses.findFirst({
            where: and(
              eq(columnBonuses.bingoId, bingoId),
              eq(columnBonuses.columnIndex, columnIndex)
            ),
          })

          if (bonusXP > 0) {
            if (existingBonus) {
              // Update existing bonus
              await tx
                .update(columnBonuses)
                .set({ bonusXP, updatedAt: new Date() })
                .where(eq(columnBonuses.id, existingBonus.id))
            } else {
              // Insert new bonus
              await tx.insert(columnBonuses).values({
                bingoId,
                columnIndex,
                bonusXP,
              })
            }
          } else if (existingBonus) {
            // Delete bonus if set to 0
            await tx
              .delete(columnBonuses)
              .where(eq(columnBonuses.id, existingBonus.id))
          }
        }
      }

      if (data.shipRules !== undefined) {
        ;({ clearedTeams } = await applyShipRulesUpdate(
          tx,
          bingoId,
          data.shipRules
        ))
      }
    })

    // Revalidate the bingo page
    revalidatePath("/events/[id]", "layout")

    return { success: true, clearedTeams }
  } catch (error) {
    logger.error({ error }, "Error updating bingo")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to update bingo"),
    }
  }
}

export async function getBingoWithPatternBonuses(bingoId: string) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        rowBonuses: true,
        columnBonuses: true,
      },
    })

    if (!bingo) {
      return { success: false, error: "Bingo not found" }
    }

    return {
      success: true,
      data: {
        id: bingo.id,
        title: bingo.title,
        description: bingo.description,
        visible: bingo.visible,
        locked: bingo.locked,
        codephrase: bingo.codephrase,
        bingoType: bingo.bingoType,
        rows: bingo.rows,
        columns: bingo.columns,
        mainDiagonalBonusXP: bingo.mainDiagonalBonusXP,
        antiDiagonalBonusXP: bingo.antiDiagonalBonusXP,
        completeBoardBonusXP: bingo.completeBoardBonusXP,
        rowBonuses: bingo.rowBonuses,
        columnBonuses: bingo.columnBonuses,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error fetching bingo with pattern bonuses")
    return { success: false, error: "Failed to fetch bingo data" }
  }
}

// Progression Bingo Functions

export async function getTeamTierProgress(teamId: string, bingoId: string) {
  try {
    const tierProgress = await db.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
      orderBy: asc(teamTierProgress.tier),
    })

    return tierProgress
  } catch (error) {
    logger.error({ error }, "Error fetching team tier progress")
    throw new Error("Failed to fetch team tier progress")
  }
}

export async function initializeTeamTierProgress(
  teamId: string,
  bingoId: string
) {
  try {
    await requireTeamMemberOrManager(teamId)

    // Check if this is a progression bingo
    const [bingo] = await db
      .select({ bingoType: bingos.bingoType })
      .from(bingos)
      .where(eq(bingos.id, bingoId))

    if (!bingo || bingo.bingoType !== "progression") {
      return { success: false, error: "Not a progression bingo" }
    }

    // Get all tiers for this bingo
    const tiersQuery = await db
      .select({ tier: tiles.tier })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
      .groupBy(tiles.tier)
      .orderBy(asc(tiles.tier))

    const uniqueTiers = tiersQuery.map((t) => t.tier)

    // Initialize tier progress for this team, unlocking only tier 0
    const tierProgressData = uniqueTiers.map((tier) => ({
      teamId,
      bingoId,
      tier,
      isUnlocked: tier === 0, // Only unlock tier 0 initially
      unlockedAt: tier === 0 ? new Date() : null,
    }))

    await db
      .insert(teamTierProgress)
      .values(tierProgressData)
      .onConflictDoNothing()

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error initializing team tier progress")
    return { success: false, error: "Failed to initialize team tier progress" }
  }
}

export async function checkAndUnlockNextTier(teamId: string, bingoId: string) {
  try {
    await requireTeamMemberOrManager(teamId)

    // Get tier-specific XP requirements for this bingo
    const tierXpReqs = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
    })

    // Get team's current tier progress
    let tierProgress = await db.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
      orderBy: asc(teamTierProgress.tier),
    })

    // Tier rows are created here, when a Team's Tile is first reviewed, rather
    // than while rendering the Board (a GET must not write).
    if (tierProgress.length === 0) {
      await initializeTeamTierProgress(teamId, bingoId)
      tierProgress = await db.query.teamTierProgress.findMany({
        where: and(
          eq(teamTierProgress.teamId, teamId),
          eq(teamTierProgress.bingoId, bingoId)
        ),
        orderBy: asc(teamTierProgress.tier),
      })
    }

    // Find the highest unlocked tier
    const highestUnlockedTier = Math.max(
      ...tierProgress.filter((tp) => tp.isUnlocked).map((tp) => tp.tier)
    )

    // Check if we can unlock the next tier
    const nextTier = highestUnlockedTier + 1
    const nextTierProgress = tierProgress.find((tp) => tp.tier === nextTier)

    if (!nextTierProgress || nextTierProgress.isUnlocked) {
      return { success: true, unlockedTier: null } // No next tier or already unlocked
    }

    // Count completed tiles in current highest tier
    const currentTierTiles = await db
      .select({
        id: tiles.id,
        weight: tiles.weight,
        teamTileSubmissions: {
          status: teamTileSubmissions.status,
        },
      })
      .from(tiles)
      .leftJoin(
        teamTileSubmissions,
        and(
          eq(teamTileSubmissions.tileId, tiles.id),
          eq(teamTileSubmissions.teamId, teamId)
        )
      )
      .where(
        and(eq(tiles.bingoId, bingoId), eq(tiles.tier, highestUnlockedTier))
      )

    const completedTilesXP = currentTierTiles
      .filter((tile) => tile.teamTileSubmissions?.status === "completed")
      .reduce((totalXP, tile) => totalXP + tile.weight, 0)

    // Get XP requirement for current tier to unlock next tier
    const tierXpReq = tierXpReqs.find((req) => req.tier === highestUnlockedTier)
    const xpRequired = tierXpReq?.xpRequired ?? 5 // Default to 5 if not found

    // Check if unlock requirement is met (XP-based)
    if (completedTilesXP >= xpRequired) {
      // Unlock the next tier
      await db
        .update(teamTierProgress)
        .set({
          isUnlocked: true,
          unlockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(teamTierProgress.teamId, teamId),
            eq(teamTierProgress.bingoId, bingoId),
            eq(teamTierProgress.tier, nextTier)
          )
        )

      return { success: true, unlockedTier: nextTier }
    }

    return { success: true, unlockedTier: null }
  } catch (error) {
    logger.error({ error }, "Error checking tier unlock")
    return { success: false, error: "Failed to check tier unlock" }
  }
}

export async function getProgressionBingoTiles(
  bingoId: string,
  teamId?: string
) {
  try {
    // Get bingo info
    const [bingo] = await db
      .select({ bingoType: bingos.bingoType })
      .from(bingos)
      .where(eq(bingos.id, bingoId))

    if (!bingo || bingo.bingoType !== "progression") {
      throw new Error("Not a progression bingo")
    }

    // Get all tiles
    const allTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingoId),
      with: {
        goals: true,
        teamTileSubmissions: teamId
          ? {
              where: eq(teamTileSubmissions.teamId, teamId),
            }
          : undefined,
      },
      orderBy: [asc(tiles.tier), asc(tiles.index)],
    })

    // If no team specified, return all tiles
    if (!teamId) {
      return allTiles
    }

    // Get team's tier progress
    const tierProgress = await getTeamTierProgress(teamId, bingoId)
    const unlockedTiers = new Set(
      tierProgress.filter((tp) => tp.isUnlocked).map((tp) => tp.tier)
    )

    // Filter tiles based on unlocked tiers
    const accessibleTiles = allTiles.filter((tile) =>
      unlockedTiers.has(tile.tier)
    )

    return accessibleTiles
  } catch (error) {
    logger.error({ error }, "Error fetching progression bingo tiles")
    throw new Error("Failed to fetch progression bingo tiles")
  }
}

export async function updateTileTier(tileId: string, newTier: number) {
  try {
    await requireBingoAdminForTile(tileId)
    await db
      .update(tiles)
      .set({ tier: newTier, updatedAt: new Date() })
      .where(eq(tiles.id, tileId))

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating tile tier")
    return { success: false, error: "Failed to update tile tier" }
  }
}

export async function getTierXpRequirements(bingoId: string) {
  try {
    const requirements = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
      orderBy: asc(tierXpRequirements.tier),
    })
    return requirements
  } catch (error) {
    logger.error({ error }, "Error fetching tier XP requirements")
    throw new Error("Failed to fetch tier XP requirements")
  }
}

export async function setTierXpRequirement(
  bingoId: string,
  tier: number,
  xpRequired: number
) {
  try {
    await requireBingoAdmin(bingoId)
    // Try to update existing record
    const existingReq = await db.query.tierXpRequirements.findFirst({
      where: and(
        eq(tierXpRequirements.bingoId, bingoId),
        eq(tierXpRequirements.tier, tier)
      ),
    })

    if (existingReq) {
      await db
        .update(tierXpRequirements)
        .set({ xpRequired, updatedAt: new Date() })
        .where(eq(tierXpRequirements.id, existingReq.id))
    } else {
      await db.insert(tierXpRequirements).values({
        bingoId,
        tier,
        xpRequired,
      })
    }

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error setting tier XP requirement")
    return { success: false, error: "Failed to set tier XP requirement" }
  }
}

export async function initializeTierXpRequirements(
  bingoId: string,
  defaultXpRequired: number = 5
) {
  try {
    await requireBingoAdmin(bingoId)
    // Get all unique tiers for this bingo
    const tierResults = await db
      .selectDistinct({ tier: tiles.tier })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
      .orderBy(asc(tiles.tier))

    const tiers = tierResults.map((r) => r.tier)

    // Create tier XP requirements for each tier (except the last tier)
    // The last tier doesn't need a requirement since there's no next tier to unlock
    for (const tier of tiers.slice(0, -1)) {
      await setTierXpRequirement(bingoId, tier, defaultXpRequired)
    }

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error initializing tier XP requirements")
    return {
      success: false,
      error: "Failed to initialize tier XP requirements",
    }
  }
}

export async function createNewTier(bingoId: string) {
  try {
    await requireBingoAdmin(bingoId)
    return await db.transaction(async (tx) => {
      // Get the highest tier number for this bingo
      const maxTierResult = await tx
        .select({ maxTier: sql<number>`MAX(${tiles.tier})` })
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      const maxTier = maxTierResult[0]?.maxTier ?? -1
      const newTier = maxTier + 1

      // Get the next index for the new tile
      const maxIndexResult = await tx
        .select({ maxIndex: sql<number>`MAX(${tiles.index})` })
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      const maxIndex = maxIndexResult[0]?.maxIndex ?? -1
      const nextIndex = maxIndex + 1

      // Create a tile in the new tier to persist it
      const [createdTile] = await tx
        .insert(tiles)
        .values({
          bingoId,
          title: `New Tile`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: nextIndex,
          isHidden: false,
          tier: newTier,
        })
        .returning()

      // Initialize XP requirement for the previous tier (if it doesn't exist)
      if (newTier > 0) {
        const existingReq = await tx
          .select()
          .from(tierXpRequirements)
          .where(
            and(
              eq(tierXpRequirements.bingoId, bingoId),
              eq(tierXpRequirements.tier, newTier - 1)
            )
          )

        if (existingReq.length === 0) {
          await tx.insert(tierXpRequirements).values({
            bingoId,
            tier: newTier - 1,
            xpRequired: 5,
          })
        }
      }

      return { success: true, newTier, createdTile }
    })
  } catch (error) {
    logger.error({ error }, "Error creating new tier")
    return { success: false, error: "Failed to create new tier" }
  }
}

export async function deleteTier(bingoId: string, tierToDelete: number) {
  try {
    await requireBingoAdmin(bingoId)
    return await db.transaction(async (tx) => {
      // First, delete all tiles in the specified tier
      const deletedTiles = await tx
        .delete(tiles)
        .where(and(eq(tiles.bingoId, bingoId), eq(tiles.tier, tierToDelete)))
        .returning({ id: tiles.id })

      // Delete any XP requirements for the deleted tier
      await tx
        .delete(tierXpRequirements)
        .where(
          and(
            eq(tierXpRequirements.bingoId, bingoId),
            eq(tierXpRequirements.tier, tierToDelete)
          )
        )

      // Shift all tiles in higher tiers down by one tier
      const updatedTiles = await tx
        .update(tiles)
        .set({
          tier: sql`${tiles.tier} - 1`,
        })
        .where(and(eq(tiles.bingoId, bingoId), gt(tiles.tier, tierToDelete)))
        .returning()

      // Shift all XP requirements for higher tiers down by one
      await tx
        .update(tierXpRequirements)
        .set({
          tier: sql`${tierXpRequirements.tier} - 1`,
        })
        .where(
          and(
            eq(tierXpRequirements.bingoId, bingoId),
            gt(tierXpRequirements.tier, tierToDelete)
          )
        )

      // Delete team tier progress for the deleted tier
      await tx
        .delete(teamTierProgress)
        .where(
          and(
            eq(teamTierProgress.bingoId, bingoId),
            eq(teamTierProgress.tier, tierToDelete)
          )
        )

      // Shift team tier progress for higher tiers down by one
      await tx
        .update(teamTierProgress)
        .set({
          tier: sql`${teamTierProgress.tier} - 1`,
        })
        .where(
          and(
            eq(teamTierProgress.bingoId, bingoId),
            gt(teamTierProgress.tier, tierToDelete)
          )
        )

      return {
        success: true,
        deletedTileIds: deletedTiles.map((t) => t.id),
        updatedTiles: updatedTiles,
      }
    })
  } catch (error) {
    logger.error({ error }, "Error deleting tier")
    return { success: false, error: "Failed to delete tier" }
  } finally {
    // Revalidate the page to refresh cached data
    revalidatePath("/events")
  }
}
