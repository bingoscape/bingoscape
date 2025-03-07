"use server"

import { db } from "@/server/db"
import { bingos, tiles, goals } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getServerAuthSession } from "@/server/auth"
import type { UUID } from "crypto"

// Define the structure for exported bingo data
export interface ExportedBingo {
  version: string // For future compatibility
  metadata: {
    title: string
    description: string | null
    rows: number
    columns: number
    codephrase: string
  }
  tiles: Array<{
    title: string
    description: string
    headerImage: string | null
    weight: number
    index: number
    isHidden: boolean
    goals: Array<{
      description: string
      targetValue: number
    }>
  }>
}

/**
 * Export a bingo board to a JSON format that can be imported later
 */
export async function exportBingoBoard(bingoId: string): Promise<ExportedBingo | { error: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { error: "Unauthorized" }
  }

  try {
    // Fetch the bingo with all its tiles and goals
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        tiles: {
          with: {
            goals: true,
          },
        },
      },
    })

    if (!bingo) {
      return { error: "Bingo board not found" }
    }

    // Transform the data into our export format
    const exportData: ExportedBingo = {
      version: "1.0",
      metadata: {
        title: bingo.title,
        description: bingo.description,
        rows: bingo.rows,
        columns: bingo.columns,
        codephrase: bingo.codephrase,
      },
      tiles: bingo.tiles.map((tile) => ({
        title: tile.title,
        description: tile.description,
        headerImage: tile.headerImage,
        weight: tile.weight,
        index: tile.index,
        isHidden: tile.isHidden,
        goals: tile.goals.map((goal) => ({
          description: goal.description,
          targetValue: goal.targetValue,
        })),
      })),
    }

    return exportData
  } catch (error) {
    console.error("Error exporting bingo board:", error)
    return { error: "Failed to export bingo board" }
  }
}

/**
 * Import a bingo board from a JSON format
 */
export async function importBingoBoard(
  eventId: string,
  importData: ExportedBingo,
): Promise<{ success: boolean; bingoId?: string; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Validate the import data
  if (!importData.version || !importData.metadata || !importData.tiles) {
    return { success: false, error: "Invalid import data format" }
  }

  try {
    return await db.transaction(async (tx) => {
      // Create the new bingo board
      const [newBingo] = await tx
        .insert(bingos)
        .values({
          eventId: eventId as UUID,
          title: importData.metadata.title,
          description: importData.metadata.description,
          rows: importData.metadata.rows,
          columns: importData.metadata.columns,
          codephrase: importData.metadata.codephrase,
          visible: false, // Default to not visible
          locked: true, // Default to locked
        })
        .returning()

      if (!newBingo) {
        throw new Error("Failed to create bingo board")
      }

      // Create all the tiles
      for (const tileData of importData.tiles) {
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
          })
          .returning()

        if (!newTile) {
          throw new Error("Failed to create tile")
        }

        // Create all the goals for this tile
        if (tileData.goals && tileData.goals.length > 0) {
          const goalsToInsert = tileData.goals.map((goal) => ({
            tileId: newTile.id,
            description: goal.description,
            targetValue: goal.targetValue,
          }))

          await tx.insert(goals).values(goalsToInsert)
        }
      }

      // Revalidate the event page to show the new bingo
      revalidatePath(`/events/${eventId}`)

      return { success: true, bingoId: newBingo.id }
    })
  } catch (error) {
    console.error("Error importing bingo board:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to import bingo board" }
  }
}

/**
 * Validate an imported bingo board
 */
export async function validateImportData(data: unknown): Promise<{ valid: boolean; error?: string }> {
  try {
    // Basic structure check
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Invalid data format" }
    }

    const importData = data as Partial<ExportedBingo>

    if (!importData.version) {
      return { valid: false, error: "Missing version information" }
    }

    if (!importData.metadata) {
      return { valid: false, error: "Missing metadata" }
    }

    const metadata = importData.metadata as Partial<ExportedBingo["metadata"]>
    if (!metadata.title || typeof metadata.rows !== "number" || typeof metadata.columns !== "number") {
      return { valid: false, error: "Invalid metadata" }
    }

    if (!importData.tiles || !Array.isArray(importData.tiles) || importData.tiles.length === 0) {
      return { valid: false, error: "Missing or empty tiles array" }
    }

    // Check if the number of tiles matches rows × columns
    if (importData.tiles.length !== metadata.rows * metadata.columns) {
      return {
        valid: false,
        error: `Tile count (${importData.tiles.length}) doesn't match dimensions (${metadata.rows}×${metadata.columns} = ${metadata.rows * metadata.columns})`,
      }
    }

    // Validate each tile
    for (const tile of importData.tiles) {
      if (!tile.title || typeof tile.weight !== "number" || typeof tile.index !== "number") {
        return { valid: false, error: "Invalid tile data" }
      }

      // Validate goals if present
      if (tile.goals && Array.isArray(tile.goals)) {
        for (const goal of tile.goals) {
          if (!goal.description || typeof goal.targetValue !== "number") {
            return { valid: false, error: "Invalid goal data" }
          }
        }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: "Error validating import data" }
  }
}

