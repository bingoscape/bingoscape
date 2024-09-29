'use server'

import { db } from "@/server/db"
import { bingos, goals, teamGoalProgress, tiles } from "@/server/db/schema"
import { UUID } from "crypto"
import { eq } from "drizzle-orm"

// Define the types based on the schema
interface Tile {
  id: string;
  title: string;
  headerImage: string | null;
  description: string;
  weight: number;
  index: number;
  goals: Goal[];
}

interface Goal {
  id: string;
  description: string;
  targetValue: number;
  teamProgress: TeamProgress[];
}

interface TeamProgress {
  teamId: string;
  teamName: string;
  currentValue: number;
}
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
        await tx
          .update(tiles)
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

  console.log(formData)

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
  for (let idx = 0; idx < rows * columns; idx++) {
    tilesToInsert.push({
      bingoId,
      title: `Tile ${idx + 1}`,
      headerImage: '/placeholder.svg?height=100&width=100',
      description: `Tile ${idx + 1}`,
      weight: 1,
      index: idx,
    })
  }

  await db.insert(tiles).values(tilesToInsert)

  return { success: true }
}

export async function deleteBingo(bingoId: UUID) {
  try {
    await db.transaction(async (tx) => {
      // Delete all tiles associated with the bingo
      await tx.delete(tiles).where(eq(tiles.bingoId, bingoId))

      // Delete the bingo itself
      await tx.delete(bingos).where(eq(bingos.id, bingoId))
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting bingo:", error)
    return { success: false, error: "Failed to delete bingo" }
  }
}

export async function addGoal(tileId: string, goal: { description: string, targetValue: number }) {
  try {
    const [newGoal] = await db.insert(goals).values({
      tileId,
      description: goal.description,
      targetValue: goal.targetValue,
    }).returning()

    return { success: true, goal: newGoal }
  } catch (error) {
    console.error("Error adding goal:", error)
    return { success: false, error: "Failed to add goal" }
  }
}

export async function deleteGoal(goalId: string) {
  try {
    await db.delete(goals).where(eq(goals.id, goalId))
    return { success: true }
  } catch (error) {
    console.error("Error deleting goal:", error)
    return { success: false, error: "Failed to delete goal" }
  }
}

export async function updateGoalProgress(goalId: string, teamId: string, newValue: number) {
  try {
    const [updatedProgress] = await db
      .insert(teamGoalProgress)
      .values({
        goalId,
        teamId,
        currentValue: newValue,
      })
      .onConflictDoUpdate({
        target: [teamGoalProgress.goalId, teamGoalProgress.teamId],
        set: { currentValue: newValue },
      })
      .returning()

    return { success: true, progress: updatedProgress }
  } catch (error) {
    console.error("Error updating goal progress:", error)
    return { success: false, error: "Failed to update goal progress" }
  }
}

export async function getTileGoalsAndProgress(tileId: string) {
  const tileGoals = await db.query.goals.findMany({
    where: eq(goals.tileId, tileId),
    with: {
      teamProgress: true,
    },
  });

  return tileGoals;
}

export async function getBingoById(bingoId: string) {
  try {
    const result = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        tiles: {
          with: {
            goals: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    // Transform the result to match the expected Tile and Goal interfaces
    const transformedTiles: Tile[] = result.tiles.map((tile) => ({
      id: tile.id,
      title: tile.title,
      headerImage: tile.headerImage,
      description: tile.description,
      weight: tile.weight,
      index: tile.index,
      goals: tile.goals.map((goal) => ({
        id: goal.id,
        description: goal.description,
        targetValue: goal.targetValue,
        teamProgress: [], // This will be populated in the BingoGrid component
      })),
    }));

    return {
      id: result.id,
      title: result.title,
      description: result.description,
      rows: result.rows,
      columns: result.columns,
      tiles: transformedTiles,
    };
  } catch (error) {
    console.error("Error fetching bingo:", error);
    throw new Error("Failed to fetch bingo");
  }
}

