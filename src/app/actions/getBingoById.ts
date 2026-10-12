"use server"
import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import { bingos, tiles } from "@/server/db/schema"
import { eq, asc } from "drizzle-orm"
import type { BingoData } from "@/types/model"
import { applyBlindBoard, isBlindBoard } from "@/server/blind-board"
import { isEventManager } from "@/server/authz"
import { redactHiddenTiles } from "@/lib/hidden-tiles"

export async function getBingoById(bingoId: string): Promise<BingoData | null> {
  try {
    const result = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        event: { columns: { startDate: true } },
        tiles: {
          with: {
            goals: true,
          },
          orderBy: [asc(tiles.index)],
        },
      },
    })

    if (!result) {
      return null
    }

    const { event, ...bingo } = result

    // Managers see everything. Everybody else gets hidden Tiles redacted, and
    // the Tiles of a battleship Board stay blind until its Event starts.
    if (await isEventManager(bingo.eventId)) {
      return { ...bingo, tiles: applyBlindBoard(bingo.tiles, false) }
    }

    const blind = isBlindBoard({
      bingoType: bingo.bingoType,
      startDate: event.startDate,
      isManager: false,
    })
    return {
      ...bingo,
      tiles: applyBlindBoard(redactHiddenTiles(bingo.tiles), blind),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching bingo:", error)
    throw new Error("Failed to fetch bingo")
  }
}
