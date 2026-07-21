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
import type { UUID } from "crypto"
import { z } from "zod"

// Define Zod schemas for validation
const GoalGroupSchema = z.object({
  localId: z.string(),
  parentLocalId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  logicalOperator: z.enum(["AND", "OR", "SUM"]),
  minRequiredGoals: z.number().default(1),
  orderIndex: z.number().default(0),
})

const GoalValueSchema = z.object({
  value: z.number(),
  description: z.string(),
})

const ItemGoalSchema = z.object({
  itemId: z.number(),
  baseName: z.string(),
  exactVariant: z.string().nullable().optional(),
  imageUrl: z.string(),
})

const MetricGoalSchema = z.object({
  metricType: z.string(),
  metricName: z.string(),
})

const GoalSchema = z.object({
  localId: z.string().optional(),
  parentLocalId: z.string().nullable().optional(),
  description: z.string(),
  targetValue: z.number(),
  goalType: z.enum(["generic", "item", "metric"]).default("generic"),
  orderIndex: z.number().default(0),
  itemGoal: ItemGoalSchema.optional(),
  metricGoal: MetricGoalSchema.optional(),
  goalValues: z.array(GoalValueSchema).optional(),
})

const TileSchema = z.object({
  title: z.string(),
  description: z.string(),
  headerImage: z.string().nullable().optional(),
  weight: z.number(),
  index: z.number(),
  isHidden: z.boolean().default(true),
  tier: z.number().default(0),
  goalGroups: z.array(GoalGroupSchema).optional(),
  goals: z.array(GoalSchema).optional(),
})

const ExportedBingoSchema = z.object({
  version: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    rows: z.number(),
    columns: z.number(),
    codephrase: z.string(),
    bingoType: z.enum(["standard", "progression"]),
    tiersUnlockRequirement: z.number().optional(),
    mainDiagonalBonusXP: z.number().optional(),
    antiDiagonalBonusXP: z.number().optional(),
    completeBoardBonusXP: z.number().optional(),
  }),
  tiles: z.array(TileSchema),
  tierXpRequirements: z
    .array(
      z.object({
        tier: z.number(),
        xpRequired: z.number(),
      })
    )
    .optional(),
  rowBonuses: z
    .array(
      z.object({
        rowIndex: z.number(),
        bonusXP: z.number(),
      })
    )
    .optional(),
  columnBonuses: z
    .array(
      z.object({
        columnIndex: z.number(),
        bonusXP: z.number(),
      })
    )
    .optional(),
})

// Infer the TypeScript type from the Zod schema
export type ExportedBingo = z.infer<typeof ExportedBingoSchema>

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
      version: "2.0", // Updated version to support unified data schema
      metadata: {
        title: bingo.title,
        description: bingo.description,
        rows: bingo.rows,
        columns: bingo.columns,
        codephrase: bingo.codephrase,
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
    return { error: "Failed to export bingo board" }
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

  // Validate the import data using Zod
  const validationResult = ExportedBingoSchema.safeParse(importData)
  if (!validationResult.success) {
    logger.warn({ issues: validationResult.error.issues }, "Invalid import data")
    return { success: false, error: "Invalid import data format" }
  }
  
  const validatedData = validationResult.data

  // Set default values for backwards compatibility
  const bingoType = validatedData.metadata.bingoType ?? "standard"
  const tiersUnlockRequirement = validatedData.metadata.tiersUnlockRequirement ?? 5
  const mainDiagonalBonusXP = validatedData.metadata.mainDiagonalBonusXP ?? 0
  const antiDiagonalBonusXP = validatedData.metadata.antiDiagonalBonusXP ?? 0
  const completeBoardBonusXP = validatedData.metadata.completeBoardBonusXP ?? 0

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
          codephrase: validatedData.metadata.codephrase,
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
            logger.warn("Some goal groups could not be imported due to unresolvable parent references")
          }
        }

        // Create all the goals for this tile
        if (tileData.goals && tileData.goals.length > 0) {
          for (const goal of tileData.goals) {
            const parentId = goal.parentLocalId ? localToDbGroupId.get(goal.parentLocalId) : null

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
      if (bingoType === "progression" && validatedData.tierXpRequirements) {
        const tierXpReqsToInsert = validatedData.tierXpRequirements.map((req) => ({
          bingoId: newBingo.id,
          tier: req.tier,
          xpRequired: req.xpRequired,
        }))

        await tx.insert(tierXpRequirements).values(tierXpReqsToInsert)
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
  try {
    const result = ExportedBingoSchema.safeParse(data)
    if (!result.success) {
      return { 
        valid: false, 
        error: "Invalid import data format: " + result.error.errors.map(e => e.message).join(", ") 
      }
    }
    return { valid: true }
  } catch (_error) {
    return { valid: false, error: "Error validating import data" }
  }
}
