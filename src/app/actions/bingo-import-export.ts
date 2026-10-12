"use server"



import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import {
  bingos,
  tiles,
  goals,
  goalGroups,
  itemGoals,
  metricGoals,
  goalValues,
  tierXpRequirements,
  rowBonuses,
  columnBonuses,
} from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getServerAuthSession } from "@/server/auth"
import {
  authzErrorMessage,
  requireBingoAdmin,
  requireEventManager,
} from "@/server/authz"
import type { UUID } from "crypto"
import {
  CURRENT_EXPORT_VERSION,
  parseExportedBingo,
} from "@/lib/bingo-template-schema"
import type { ExportedBingo } from "@/lib/bingo-template-schema"
import generateOSRSCodePhrase from "@/lib/codephraseGenerator"

/**
 * Export a bingo board to a JSON format that can be imported later
 */
export async function exportBingoBoard(
  bingoId: string
): Promise<ExportedBingo | { error: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { error: "Unauthorized" }
  }

  try {
    // Exports include hidden Tiles and all Goals: managers only. The Event is
    // derived from the Board.
    await requireBingoAdmin(bingoId)

    // Fetch the bingo with all its tiles, goals, tier requirements, and pattern bonuses
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        tiles: {
          with: {
            goalGroups: true,
            goals: {
              with: {
                itemGoal: true,
                metricGoal: true,
                goalValues: true,
              },
            },
          },
        },
        tierXpRequirements: true,
        rowBonuses: true,
        columnBonuses: true,
      },
    })

    if (!bingo) {
      return { error: "Bingo board not found" }
    }

    // Ship rules and placements are not part of the export format yet.
    if (bingo.bingoType === "battleship") {
      return { error: "Battleship boards cannot be exported yet" }
    }

    let groupCounter = 1
    let goalCounter = 1
    const groupIdMap = new Map<string, string>()
    const goalIdMap = new Map<string, string>()

    // Pre-populate maps for goalGroups and goals with "imaginary" local IDs
    bingo.tiles.forEach((tile) => {
      tile.goalGroups?.forEach((group) => {
        if (!groupIdMap.has(group.id)) {
          groupIdMap.set(group.id, `group-${groupCounter++}`)
        }
      })
      tile.goals?.forEach((goal) => {
        if (!goalIdMap.has(goal.id)) {
          goalIdMap.set(goal.id, `goal-${goalCounter++}`)
        }
      })
    })

    // Transform the data into our export format
    const exportData: ExportedBingo = {
      version: CURRENT_EXPORT_VERSION,
      metadata: {
        title: bingo.title,
        description: bingo.description,
        rows: bingo.rows,
        columns: bingo.columns,
        // The codephrase is a per-Board secret and is deliberately not exported.
        bingoType: bingo.bingoType,
        ...(bingo.bingoType === "progression" && {
          tiersUnlockRequirement: bingo.tiersUnlockRequirement,
        }),
        ...(bingo.bingoType === "standard" && {
          mainDiagonalBonusXP: bingo.mainDiagonalBonusXP,
          antiDiagonalBonusXP: bingo.antiDiagonalBonusXP,
          completeBoardBonusXP: bingo.completeBoardBonusXP,
        }),
      },
      tiles: bingo.tiles.map((tile) => ({
        title: tile.title,
        description: tile.description,
        headerImage: tile.headerImage,
        weight: tile.weight,
        index: tile.index,
        isHidden: tile.isHidden,
        tier: tile.tier,
        goalGroups: tile.goalGroups?.map((group) => ({
          localId: groupIdMap.get(group.id)!,
          parentLocalId: group.parentGroupId
            ? groupIdMap.get(group.parentGroupId)
            : undefined,
          name: group.name,
          logicalOperator: group.logicalOperator,
          minRequiredGoals: group.minRequiredGoals,
          orderIndex: group.orderIndex,
        })) || [],
        goals: tile.goals?.map((goal) => ({
          localId: goalIdMap.get(goal.id)!,
          parentLocalId: goal.parentGroupId
            ? groupIdMap.get(goal.parentGroupId)
            : undefined,
          description: goal.description,
          targetValue: goal.targetValue,
          goalType: goal.goalType,
          orderIndex: goal.orderIndex,
          itemGoal: goal.itemGoal
            ? {
                itemId: goal.itemGoal.itemId,
                baseName: goal.itemGoal.baseName,
                exactVariant: goal.itemGoal.exactVariant,
                imageUrl: goal.itemGoal.imageUrl,
              }
            : undefined,
          metricGoal: goal.metricGoal
            ? {
                metricType: goal.metricGoal.metricType,
                metricName: goal.metricGoal.metricName,
              }
            : undefined,
          goalValues:
            goal.goalValues?.length > 0
              ? goal.goalValues.map((gv) => ({
                  value: gv.value,
                  description: gv.description,
                }))
              : undefined,
        })) || [],
      })),
      ...(bingo.bingoType === "progression" &&
        bingo.tierXpRequirements && {
          tierXpRequirements: bingo.tierXpRequirements.map((req) => ({
            tier: req.tier,
            xpRequired: req.xpRequired,
          })),
        }),
      ...(bingo.bingoType === "standard" &&
        bingo.rowBonuses &&
        bingo.rowBonuses.length > 0 && {
          rowBonuses: bingo.rowBonuses.map((bonus) => ({
            rowIndex: bonus.rowIndex,
            bonusXP: bonus.bonusXP,
          })),
        }),
      ...(bingo.bingoType === "standard" &&
        bingo.columnBonuses &&
        bingo.columnBonuses.length > 0 && {
          columnBonuses: bingo.columnBonuses.map((bonus) => ({
            columnIndex: bonus.columnIndex,
            bonusXP: bonus.bonusXP,
          })),
        }),
    }

    return exportData
  } catch (error) {
    logger.error({ error }, "Error exporting bingo board:", error)
    return { error: authzErrorMessage(error, "Failed to export bingo board") }
  }
}

/**
 * Import a bingo board from a JSON format
 */
export async function importBingoBoard(
  eventId: string,
  importData: unknown
): Promise<{ success: boolean; bingoId?: string; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Importing creates a Board with Tiles and Goals: managers of the target
  // Event only.
  try {
    await requireEventManager(eventId)
  } catch (error) {
    return {
      success: false,
      error: authzErrorMessage(error, "Failed to verify permissions"),
    }
  }

  const parsed = parseExportedBingo(importData)
  if (!parsed.success) {
    logger.warn({ error: parsed.error }, "Invalid import data")
    return { success: false, error: parsed.error }
  }

  const validatedData = parsed.data

  // Apply the same Board rules as createBingo.
  const { rows, columns } = validatedData.metadata
  const bingoType = validatedData.metadata.bingoType
  const isSquare = rows === columns
  const tiersUnlockRequirement = validatedData.metadata.tiersUnlockRequirement ?? 5
  const mainDiagonalBonusXP = isSquare
    ? (validatedData.metadata.mainDiagonalBonusXP ?? 0)
    : 0
  const antiDiagonalBonusXP = isSquare
    ? (validatedData.metadata.antiDiagonalBonusXP ?? 0)
    : 0
  const completeBoardBonusXP =
    bingoType === "standard"
      ? (validatedData.metadata.completeBoardBonusXP ?? 0)
      : 0

  try {
    return await db.transaction(async (tx) => {
      // Create the new bingo board
      const [newBingo] = await tx
        .insert(bingos)
        .values({
          eventId: eventId as UUID,
          title: validatedData.metadata.title,
          description: validatedData.metadata.description,
          rows: validatedData.metadata.rows,
          columns: validatedData.metadata.columns,
          // Never reuse the source Board's codephrase: it is a per-Board secret.
          codephrase: generateOSRSCodePhrase(),
          bingoType: bingoType,
          tiersUnlockRequirement: tiersUnlockRequirement,
          mainDiagonalBonusXP: mainDiagonalBonusXP,
          antiDiagonalBonusXP: antiDiagonalBonusXP,
          completeBoardBonusXP: completeBoardBonusXP,
          visible: false, // Default to not visible for safety
          locked: true, // Default to locked for safety
        })
        .returning()

      if (!newBingo) {
        throw new Error("Failed to create bingo board")
      }

      // Create all the tiles
      for (const tileData of validatedData.tiles) {
        const [newTile] = await tx
          .insert(tiles)
          .values({
            bingoId: newBingo.id,
            title: tileData.title,
            description: tileData.description,
            headerImage: tileData.headerImage,
            weight: tileData.weight,
            index: tileData.index,
            isHidden: tileData.isHidden,
            tier: tileData.tier ?? 0,
          })
          .returning()

        if (!newTile) {
          throw new Error("Failed to create tile")
        }

        const localToDbGroupId = new Map<string, string>()

        // Insert goal groups
        if (tileData.goalGroups && tileData.goalGroups.length > 0) {
          // Resolve hierarchical dependencies by iteratively inserting groups
          // that either have no parent or whose parent has already been inserted.
          const pendingGroups = [...tileData.goalGroups]
          let progress = true

          while (pendingGroups.length > 0 && progress) {
            progress = false
            for (let i = 0; i < pendingGroups.length; i++) {
              const group = pendingGroups[i]
              
              if (!group) continue

              // We can safely insert if it has no parent, or if we've already inserted its parent
              if (!group.parentLocalId || localToDbGroupId.has(group.parentLocalId)) {
                const parentId = group.parentLocalId ? localToDbGroupId.get(group.parentLocalId) : null
                
                const [newGroup] = await tx
                  .insert(goalGroups)
                  .values({
                    tileId: newTile.id,
                    parentGroupId: parentId,
                    name: group.name || null,
                    logicalOperator: group.logicalOperator,
                    minRequiredGoals: group.minRequiredGoals,
                    orderIndex: group.orderIndex,
                  })
                  .returning()

                if (newGroup) {
                  localToDbGroupId.set(group.localId, newGroup.id)
                  pendingGroups.splice(i, 1)
                  i-- // Adjust index since we spliced
                  progress = true
                }
              }
            }
          }

          if (pendingGroups.length > 0) {
            throw new Error(
              "Goal groups contain a circular or unresolvable parent reference"
            )
          }
        }

        // Create all the goals for this tile
        if (tileData.goals && tileData.goals.length > 0) {
          for (const goal of tileData.goals) {
            const parentId = goal.parentLocalId
              ? localToDbGroupId.get(goal.parentLocalId)
              : null
            if (goal.parentLocalId && !parentId) {
              throw new Error("Goal references a group that could not be imported")
            }

            const [newGoal] = await tx
              .insert(goals)
              .values({
                tileId: newTile.id,
                parentGroupId: parentId,
                description: goal.description,
                targetValue: goal.targetValue,
                goalType: goal.goalType,
                orderIndex: goal.orderIndex,
              })
              .returning()

            if (!newGoal) continue

            // Insert polymorphic goal data
            if (goal.goalType === "item" && goal.itemGoal) {
              await tx.insert(itemGoals).values({
                goalId: newGoal.id,
                itemId: goal.itemGoal.itemId,
                baseName: goal.itemGoal.baseName,
                exactVariant: goal.itemGoal.exactVariant || null,
                imageUrl: goal.itemGoal.imageUrl,
              })
            } else if (goal.goalType === "metric" && goal.metricGoal) {
              await tx.insert(metricGoals).values({
                goalId: newGoal.id,
                metricType: goal.metricGoal.metricType,
                metricName: goal.metricGoal.metricName,
              })
            }

            // Insert goal values
            if (goal.goalValues && goal.goalValues.length > 0) {
              await tx.insert(goalValues).values(
                goal.goalValues.map((gv) => ({
                  goalId: newGoal.id,
                  value: gv.value,
                  description: gv.description,
                }))
              )
            }
          }
        }
      }

      // Create tier XP requirements for progression boards
      if (bingoType === "progression") {
        // Templates without explicit requirements fall back to the Board's
        // unlock requirement for every tier except the last.
        const tierXpReqsToInsert = validatedData.tierXpRequirements?.length
          ? validatedData.tierXpRequirements.map((req) => ({
              bingoId: newBingo.id,
              tier: req.tier,
              xpRequired: req.xpRequired,
            }))
          : [...new Set(validatedData.tiles.map((t) => t.tier ?? 0))]
              .sort((a, b) => a - b)
              .slice(0, -1)
              .map((tier) => ({
                bingoId: newBingo.id,
                tier,
                xpRequired: tiersUnlockRequirement,
              }))

        if (tierXpReqsToInsert.length > 0) {
          await tx.insert(tierXpRequirements).values(tierXpReqsToInsert)
        }
      }

      // Create row bonuses for standard boards
      if (
        bingoType === "standard" &&
        validatedData.rowBonuses &&
        validatedData.rowBonuses.length > 0
      ) {
        const rowBonusesToInsert = validatedData.rowBonuses.map((bonus) => ({
          bingoId: newBingo.id,
          rowIndex: bonus.rowIndex,
          bonusXP: bonus.bonusXP,
        }))

        await tx.insert(rowBonuses).values(rowBonusesToInsert)
      }

      // Create column bonuses for standard boards
      if (
        bingoType === "standard" &&
        validatedData.columnBonuses &&
        validatedData.columnBonuses.length > 0
      ) {
        const columnBonusesToInsert = validatedData.columnBonuses.map((bonus) => ({
          bingoId: newBingo.id,
          columnIndex: bonus.columnIndex,
          bonusXP: bonus.bonusXP,
        }))

        await tx.insert(columnBonuses).values(columnBonusesToInsert)
      }

      // Revalidate the event page to show the new bingo
      revalidatePath(`/events/${eventId}`)

      return { success: true, bingoId: newBingo.id }
    })
  } catch (error) {
    logger.error({ error }, "Error importing bingo board:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to import bingo board",
    }
  }
}

/**
 * Validate an imported bingo board
 */
export async function validateImportData(
  data: unknown
): Promise<{ valid: boolean; error?: string }> {
  const result = parseExportedBingo(data)
  return result.success
    ? { valid: true }
    : { valid: false, error: result.error }
}
