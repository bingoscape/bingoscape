"use server"

import { db } from "@/server/db"
import {
  bingos,
  tiles,
  rowBonuses,
  columnBonuses,
  events,
} from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { actionClient } from "@/lib/safe-action"
import { logger } from "@/lib/logger"
import getRandomFrog from "@/lib/getRandomFrog"
import { initializeTierXpRequirements } from "../bingo"

const createBingoSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  rows: z.number().min(1),
  columns: z.number().min(1),
  codephrase: z.string().min(1),
  bingoType: z.enum(["standard", "progression"]).optional().default("standard"),
  tiersUnlockRequirement: z.number().optional().default(1),
  mainDiagonalBonus: z.number().optional().default(0),
  antiDiagonalBonus: z.number().optional().default(0),
  completeBoardBonus: z.number().optional().default(0),
  scheduledUnlockDate: z.string().optional().nullable(),
  rowBonuses: z.record(z.string(), z.number()).optional(),
  columnBonuses: z.record(z.string(), z.number()).optional(),
})

export const createBingo = actionClient
  .schema(createBingoSchema)
  .action(async ({ parsedInput: data }) => {
    try {
      const event = await db.query.events.findFirst({
        where: eq(events.id, data.eventId),
      })

      if (!event) {
        return { success: false, error: "Event not found" }
      }

      const scheduledUnlockDate = data.scheduledUnlockDate
        ? new Date(data.scheduledUnlockDate)
        : null

      const newBingo = await db
        .insert(bingos)
        .values({
          eventId: data.eventId,
          title: data.title,
          description: data.description || "",
          rows: data.rows,
          codephrase: data.codephrase,
          columns: data.columns,
          bingoType: data.bingoType,
          tiersUnlockRequirement: data.tiersUnlockRequirement,
          mainDiagonalBonusXP:
            data.rows === data.columns ? data.mainDiagonalBonus : 0,
          antiDiagonalBonusXP:
            data.rows === data.columns ? data.antiDiagonalBonus : 0,
          completeBoardBonusXP:
            data.bingoType === "standard" ? data.completeBoardBonus : 0,
          scheduledUnlockDate,
          locked: true,
          visible: false,
        })
        .returning({ id: bingos.id })

      const bingoId = newBingo[0]!.id

      const tilesToInsert = []
      for (let idx = 0; idx < data.rows * data.columns; idx++) {
        tilesToInsert.push({
          bingoId,
          title: `Tile ${idx + 1}`,
          headerImage: getRandomFrog(event.gameType),
          description: `Tile ${idx + 1}`,
          weight: 1,
          isHidden: false,
          index: idx,
          tier:
            data.bingoType === "progression"
              ? Math.floor(idx / data.columns)
              : 0,
        })
      }

      await db.insert(tiles).values(tilesToInsert)

      if (data.bingoType === "standard") {
        const rowBonusValues = []
        for (let rowIndex = 0; rowIndex < data.rows; rowIndex++) {
          const bonusXP = data.rowBonuses?.[rowIndex] || 0
          if (bonusXP > 0) {
            rowBonusValues.push({ bingoId, rowIndex, bonusXP })
          }
        }
        if (rowBonusValues.length > 0) {
          await db.insert(rowBonuses).values(rowBonusValues)
        }

        const columnBonusValues = []
        for (let columnIndex = 0; columnIndex < data.columns; columnIndex++) {
          const bonusXP = data.columnBonuses?.[columnIndex] || 0
          if (bonusXP > 0) {
            columnBonusValues.push({ bingoId, columnIndex, bonusXP })
          }
        }
        if (columnBonusValues.length > 0) {
          await db.insert(columnBonuses).values(columnBonusValues)
        }
      }

      if (data.bingoType === "progression") {
        await initializeTierXpRequirements(bingoId, data.tiersUnlockRequirement)
      }

      logger.info(
        { eventId: data.eventId, bingoId, action: "createBingo" },
        "Bingo created successfully"
      )
      return { success: true }
    } catch (error) {
      logger.error({ error, action: "createBingo" }, "Error creating bingo")
      return { success: false, error: "Failed to create bingo" }
    }
  })

const deleteBingoSchema = z.object({
  bingoId: z.string().uuid(),
})

export const deleteBingo = actionClient
  .schema(deleteBingoSchema)
  .action(async ({ parsedInput: { bingoId } }) => {
    try {
      await db.transaction(async (tx) => {
        await tx.delete(tiles).where(eq(tiles.bingoId, bingoId))
        await tx.delete(bingos).where(eq(bingos.id, bingoId))
      })
      return { success: true }
    } catch (error) {
      logger.error({ error }, "Error deleting bingo")
      return { success: false, error: "Failed to delete bingo" }
    }
  })

const updateBingoSchema = z.object({
  bingoId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  codephrase: z.string(),
  bingoType: z.enum(["standard", "progression"]).optional(),
  tiersUnlockRequirement: z.number().optional(),
  patternBonuses: z
    .object({
      rowBonuses: z.record(z.string(), z.number()).optional(),
      columnBonuses: z.record(z.string(), z.number()).optional(),
      mainDiagonalBonus: z.number().optional(),
      antiDiagonalBonus: z.number().optional(),
      completeBoardBonus: z.number().optional(),
    })
    .optional(),
})

export const updateBingo = actionClient
  .schema(updateBingoSchema)
  .action(async ({ parsedInput: { bingoId, ...data } }) => {
    try {
      await db.transaction(async (tx) => {
        const updateData: Partial<typeof bingos.$inferInsert> = {
          title: data.title,
          description: data.description,
          visible: data.visible,
          locked: data.locked,
          codephrase: data.codephrase,
          updatedAt: new Date(),
        }

        if (data.bingoType !== undefined) updateData.bingoType = data.bingoType
        if (data.tiersUnlockRequirement !== undefined)
          updateData.tiersUnlockRequirement = data.tiersUnlockRequirement

        if (data.patternBonuses?.mainDiagonalBonus !== undefined)
          updateData.mainDiagonalBonusXP = data.patternBonuses.mainDiagonalBonus
        if (data.patternBonuses?.antiDiagonalBonus !== undefined)
          updateData.antiDiagonalBonusXP = data.patternBonuses.antiDiagonalBonus
        if (data.patternBonuses?.completeBoardBonus !== undefined)
          updateData.completeBoardBonusXP =
            data.patternBonuses.completeBoardBonus

        await tx.update(bingos).set(updateData).where(eq(bingos.id, bingoId))

        if (data.patternBonuses?.rowBonuses) {
          for (const [rowIndexStr, bonusXP] of Object.entries(
            data.patternBonuses.rowBonuses
          )) {
            const rowIndex = parseInt(rowIndexStr)
            const existingBonus = await tx.query.rowBonuses.findFirst({
              where: and(
                eq(rowBonuses.bingoId, bingoId),
                eq(rowBonuses.rowIndex, rowIndex)
              ),
            })
            if (bonusXP > 0) {
              if (existingBonus) {
                await tx
                  .update(rowBonuses)
                  .set({ bonusXP, updatedAt: new Date() })
                  .where(eq(rowBonuses.id, existingBonus.id))
              } else {
                await tx
                  .insert(rowBonuses)
                  .values({ bingoId, rowIndex, bonusXP })
              }
            } else if (existingBonus) {
              await tx
                .delete(rowBonuses)
                .where(eq(rowBonuses.id, existingBonus.id))
            }
          }
        }

        if (data.patternBonuses?.columnBonuses) {
          for (const [columnIndexStr, bonusXP] of Object.entries(
            data.patternBonuses.columnBonuses
          )) {
            const columnIndex = parseInt(columnIndexStr)
            const existingBonus = await tx.query.columnBonuses.findFirst({
              where: and(
                eq(columnBonuses.bingoId, bingoId),
                eq(columnBonuses.columnIndex, columnIndex)
              ),
            })
            if (bonusXP > 0) {
              if (existingBonus) {
                await tx
                  .update(columnBonuses)
                  .set({ bonusXP, updatedAt: new Date() })
                  .where(eq(columnBonuses.id, existingBonus.id))
              } else {
                await tx
                  .insert(columnBonuses)
                  .values({ bingoId, columnIndex, bonusXP })
              }
            } else if (existingBonus) {
              await tx
                .delete(columnBonuses)
                .where(eq(columnBonuses.id, existingBonus.id))
            }
          }
        }
      })

      revalidatePath(`/events/[id]/bingos/${bingoId}`)
      revalidatePath(`/events/[id]`)

      return { success: true }
    } catch (error) {
      logger.error({ error }, "Error updating bingo")
      return { success: false, error: "Failed to update bingo" }
    }
  })

const getBingoWithPatternBonusesSchema = z.object({
  bingoId: z.string().uuid(),
})

export const getBingoWithPatternBonuses = actionClient
  .schema(getBingoWithPatternBonusesSchema)
  .action(async ({ parsedInput: { bingoId } }) => {
    try {
      const bingo = await db.query.bingos.findFirst({
        where: eq(bingos.id, bingoId),
        with: { rowBonuses: true, columnBonuses: true },
      })
      if (!bingo) return { success: false, error: "Bingo not found" }

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
  })
