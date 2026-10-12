import { eq } from "drizzle-orm"

import { getUserRole } from "@/app/actions/events"
import { db } from "@/server/db"
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

/** True when the signed-in caller manages the Event (admin or management). */
async function callerManagesEvent(eventId: string): Promise<boolean> {
  const role = await getUserRole(eventId)
  return role === "admin" || role === "management"
}

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

  return !(await callerManagesEvent(bingo.eventId))
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
