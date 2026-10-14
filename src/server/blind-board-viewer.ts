import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { hasPermission } from "@/server/authz/guards"
import { isBlindBoard } from "@/server/blind-board"
import { bingos, tiles } from "@/server/db/schema"

/**
 * Blind board checks for the signed-in viewer, resolved from the database (the
 * Board's type, its Event's start date and the caller's role). The policy
 * itself is `isBlindBoard` in `blind-board.ts`.
 *
 * This file is intentionally not a "use server" module: nothing here is
 * callable from the client.
 */

/** Whether the Board is blind for the signed-in caller. Unknown Boards are not. */
export async function isBingoBlindForViewer(
  bingoId: string
): Promise<boolean> {
  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    columns: { bingoType: true, eventId: true },
    with: { event: { columns: { startDate: true } } },
  })
  if (!bingo) return false

  const blindForNonManagers = isBlindBoard({
    bingoType: bingo.bingoType,
    startDate: bingo.event.startDate,
    isManager: false,
  })
  if (!blindForNonManagers) return false

  return !(await hasPermission(bingo.eventId, "board:view-secret"))
}

/** Like `isBingoBlindForViewer`, starting from a Tile. Unknown Tiles are not blind. */
export async function isTileBlindForViewer(tileId: string): Promise<boolean> {
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
    columns: { bingoId: true },
  })
  if (!tile) return false
  return isBingoBlindForViewer(tile.bingoId)
}
