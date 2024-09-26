'use server'

import { db } from "@/server/db"
import { bingos, tiles } from "@/server/db/schema"
import { UUID } from "crypto"
import { eq } from "drizzle-orm"
export async function updateTile(tileId: string, updatedTile: Partial<typeof tiles.$inferInsert>) {
  try {
    await db.update(tiles)
      .set(updatedTile)
      .where(eq(tiles.id, tileId))
    return { success: true }
  } catch (error) {
    console.error("Error updating tile:", error)
    return { success: false, error: "Failed to update tile" }
  }
}

export async function reorderTiles(reorderedTiles: Array<{ id: string; index: number }>) {
  try {
    await db.transaction(async (tx) => {
      for (const tile of reorderedTiles) {
        await tx.update(tiles)
          .set({ index: tile.index })
          .where(eq(tiles.id, tile.id))
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Error reordering tiles:", error)
    return { success: false, error: "Failed to reorder tiles" }
  }
}
export async function createBingo(formData: FormData) {
  const eventId = formData.get('eventId') as UUID
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const rowsStr = formData.get('rows') as string
  const columnsStr = formData.get('columns') as string

  if (!eventId || !title || !rowsStr || !columnsStr) {
    throw new Error("Missing required fields")
  }

  const rows = parseInt(rowsStr)
  const columns = parseInt(columnsStr)

  if (isNaN(rows) || isNaN(columns) || rows < 1 || columns < 1) {
    throw new Error("Invalid rows or columns")
  }

  const newBingo = await db.insert(bingos).values({
    eventId,
    title,
    description: description || '',
    rows,
    columns
  }).returning({ id: bingos.id })

  const bingoId = newBingo[0]!.id

  const tilesToInsert = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      tilesToInsert.push({
        bingoId,
        headerImage: '/placeholder.svg?height=100&width=100',
        description: `Tile ${row * columns + col + 1}`,
        weight: 1,
        index: row * col + col,
      })
    }
  }

  await db.insert(tiles).values(tilesToInsert)

  return { success: true }
}
