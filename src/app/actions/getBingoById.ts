"use server"
import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import { bingos, tiles } from "@/server/db/schema"
import { eq, asc } from "drizzle-orm"
import type { BingoData } from "@/types/model"
import { applyBlindBoard } from "@/server/blind-board"
import { getBoardReadAccess, redactBoardForViewer } from "@/server/authz"
import { redactHiddenTiles } from "@/lib/hidden-tiles"

/**
 * A Board with its Tiles and Goals. The viewer must be able to read the Board
 * (a visible Board of an Event they may read, or any Board for managers);
 * otherwise this is null, as for a Board that does not exist. Managers get
 * everything; everybody else gets hidden Tiles redacted, the Tiles of a
 * battleship Board blind until its Event starts, and no secrets (tracker
 * verification code, codephrase per the read policy).
 */
export async function getBingoById(bingoId: string): Promise<BingoData | null> {
  try {
    const boardAccess = await getBoardReadAccess(bingoId)
    if (!boardAccess) return null

    const result = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
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

    const bingo = redactBoardForViewer(result, boardAccess.access)

    if (boardAccess.isManager) {
      return { ...bingo, tiles: applyBlindBoard(bingo.tiles, false) }
    }

    return {
      ...bingo,
      tiles: applyBlindBoard(
        redactHiddenTiles(bingo.tiles),
        boardAccess.blind
      ),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching bingo:", error)
    throw new Error("Failed to fetch bingo")
  }
}
