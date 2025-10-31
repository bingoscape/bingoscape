"use server"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { db } from "@/server/db"
import { bingos, tiles, goals, tierXpRequirements } from "@/server/db/schema"
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
    bingoType: "standard" | "progression"
    tiersUnlockRequirement?: number // For progression boards
  }
  tiles: Array<{
    title: string
    description: string
    headerImage: string | null
    weight: number
    index: number
    isHidden: boolean
    tier: number // 0 for standard, tier number for progression
    goals: Array<{
      description: string
      targetValue: number
    }>
  }>
  tierXpRequirements?: Array<{
    tier: number
    xpRequired: number
  }> // Only for progression boards
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
    // Fetch the bingo with all its tiles, goals, and tier requirements
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        tiles: {
          with: {
            goals: true,
          },
        },
        tierXpRequirements: true,
      },
    })

    if (!bingo) {
      return { error: "Bingo board not found" }
    }

    // Transform the data into our export format
    const exportData: ExportedBingo = {
      version: "1.1", // Updated version to support progression boards
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
      },
      tiles: bingo.tiles.map((tile) => ({
        title: tile.title,
        description: tile.description,
        headerImage: tile.headerImage,
        weight: tile.weight,
        index: tile.index,
        isHidden: tile.isHidden,
        tier: tile.tier,
        goals: tile.goals.map((goal: any) => ({
          description: goal.description,
          targetValue: goal.targetValue,
        })),
      })),
      ...(bingo.bingoType === "progression" && bingo.tierXpRequirements && {
        tierXpRequirements: bingo.tierXpRequirements.map((req) => ({
          tier: req.tier,
          xpRequired: req.xpRequired,
        })),
      }),
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

  // Set default values for backwards compatibility
  const bingoType = importData.metadata.bingoType ?? "standard"
  const tiersUnlockRequirement = importData.metadata.tiersUnlockRequirement ?? 5

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
          bingoType: bingoType,
          tiersUnlockRequirement: tiersUnlockRequirement,
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
            tier: tileData.tier ?? 0, // Default to 0 for backwards compatibility
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

      // Create tier XP requirements for progression boards
      if (bingoType === "progression" && importData.tierXpRequirements) {
        const tierXpReqsToInsert = importData.tierXpRequirements.map((req) => ({
          bingoId: newBingo.id,
          tier: req.tier,
          xpRequired: req.xpRequired,
        }))

        await tx.insert(tierXpRequirements).values(tierXpReqsToInsert)
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

    // Validate progression-specific fields if present
    if (metadata.bingoType === "progression") {
      if (importData.tierXpRequirements && !Array.isArray(importData.tierXpRequirements)) {
        return { valid: false, error: "Invalid tierXpRequirements format" }
      }
      if (importData.tierXpRequirements) {
        for (const req of importData.tierXpRequirements) {
          if (typeof req.tier !== "number" || typeof req.xpRequired !== "number") {
            return { valid: false, error: "Invalid tier XP requirement data" }
          }
        }
      }
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

      // Validate tier field (should be number, defaults to 0 if not present)
      if (tile.tier !== undefined && typeof tile.tier !== "number") {
        return { valid: false, error: "Invalid tile tier data" }
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

