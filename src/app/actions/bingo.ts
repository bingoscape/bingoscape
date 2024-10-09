'use server'

import { db } from "@/server/db"
import { bingos, goals, teamGoalProgress, tiles, submissions, images, teams, teamTileSubmissions } from "@/server/db/schema"
import { type UUID } from "crypto"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import fs from 'fs/promises'
import path from 'path'
import { type Tile, type TeamTileSubmission, type Bingo } from "./events"

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

interface AddRowOrColumnSuccessResult {
  success: true;
  tiles: Tile[];
  bingo: Bingo;
}

interface AddRowOrColumnErrorResult {
  success: false;
  error: string;
}

type AddRowOrColumnResult = AddRowOrColumnSuccessResult | AddRowOrColumnErrorResult;

// Utility function to ensure the upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
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
  const codephrase = formData.get('codephrase') as string

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
    codephrase,
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

export async function deleteBingo(bingoId: string) {
  try {
    await db.transaction(async (tx) => {
      // Delete all tiles associated with the bingo
      const tilesDeleted = await tx.delete(tiles).where(eq(tiles.bingoId, bingoId))

      // Delete the bingo itself
      const bingosDeleted = await tx.delete(bingos).where(eq(bingos.id, bingoId))
      console.table(tilesDeleted, bingosDeleted)

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
          orderBy: [asc(tiles.index)],
        },
      },
    });

    if (!result) {
      return null;
    }


    return result;

  } catch (error) {
    console.error("Error fetching bingo:", error);
    throw new Error("Failed to fetch bingo");
  }
}


export async function getSubmissions(tileId: string): Promise<TeamTileSubmission[]> {
  try {
    const result = await db.query.teamTileSubmissions.findMany({
      with: {
        submissions: {
          with: {
            image: true
          }
        },
        team: true
      },
      where: eq(teamTileSubmissions.tileId, tileId)
    })

    return result
  } catch (error) {
    console.error("Error fetching submissions:", error)
    throw new Error("Failed to fetch submissions")
  }
}

export async function submitImage(formData: FormData) {
  try {
    const tileId = formData.get('tileId') as string
    const teamId = formData.get('teamId') as string
    const image = formData.get('image') as File

    if (!tileId || !teamId || !image) {
      throw new Error("Missing required fields")
    }

    // Check if the tile exists
    const tileExists = await db.select({ id: tiles.id })
      .from(tiles)
      .where(eq(tiles.id, tileId))
      .execute()

    if (tileExists.length === 0) {
      throw new Error("Tile not found")
    }

    // Check if the team exists
    const teamExists = await db.select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .execute()

    if (teamExists.length === 0) {
      throw new Error("Team not found")
    }

    // Ensure the upload directory exists
    await ensureUploadDir();

    // Generate a unique filename
    const filename = `${nanoid()}`
    const filePath = path.join(UPLOAD_DIR, filename)

    // Write the file to the server
    const buffer = Buffer.from(await image.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Calculate the relative path for storage and serving
    const relativePath = path.join('/uploads', filename).replace(/\\/g, '/')

    const newSubmission = await db.transaction(async (tx) => {
      // Get or create teamTileSubmission
      const [teamTileSubmission] = await tx
        .insert(teamTileSubmissions)
        .values({
          tileId,
          teamId,
          status: 'pending',
        })
        .onConflictDoUpdate({
          target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
          set: {
            updatedAt: new Date(),
            status: 'pending', // Reset status to pending when a new submission is made
          },
        })
        .returning()

      // Insert the image record
      const [insertedImage] = await tx.insert(images)
        .values({
          path: relativePath,
        })
        .returning()

      // Insert the submission record
      const [insertedSubmission] = await tx.insert(submissions)
        .values({
          teamTileSubmissionId: teamTileSubmission!.id,
          imageId: insertedImage!.id,
        })
        .returning()

      return insertedSubmission
    })

    // Revalidate the bingo page
    revalidatePath('/bingo')

    return { success: true, submission: newSubmission }
  } catch (error) {
    console.error("Error submitting image:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function updateTeamTileSubmissionStatus(teamTileSubmissionId: string, newStatus: 'accepted' | 'requires_interaction' | 'declined') {
  try {
    const [updatedTeamTileSubmission] = await db
      .update(teamTileSubmissions)
      .set({ status: newStatus })
      .where(eq(teamTileSubmissions.id, teamTileSubmissionId))
      .returning()

    if (!updatedTeamTileSubmission) {
      throw new Error("Team tile submission not found")
    }

    return { success: true, teamTileSubmission: updatedTeamTileSubmission }
  } catch (error) {
    console.error("Error updating team tile submission status:", error)
    return { success: false, error: "Failed to update team tile submission status" }
  }
}

export async function addRowOrColumn(bingoId: string, type: 'row' | 'column'): Promise<AddRowOrColumnResult> {
  try {
    return await db.transaction(async (tx) => {
      const [bingo] = await tx.select().from(bingos).where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const newSize = type === 'row' ? bingo.rows + 1 : bingo.columns + 1
      const totalTiles = type === 'row' ? newSize * bingo.columns : bingo.rows * newSize

      // Update bingo size
      await tx.update(bingos).set({ [type === 'row' ? 'rows' : 'columns']: newSize }).where(eq(bingos.id, bingoId))

      // Get existing tiles
      const existingTiles = await tx.select().from(tiles).where(eq(tiles.bingoId, bingoId))
      const [updated] = await tx.select().from(bingos).where(eq(bingos.id, bingoId))

      // Create new tiles
      const newTiles = []
      for (let i = existingTiles.length; i < totalTiles; i++) {
        newTiles.push({
          bingoId,
          title: `New Tile ${i + 1}`,
          description: '',
          weight: 1,
          index: i,
        })
      }

      if (newTiles.length > 0) {
        await tx.insert(tiles).values(newTiles)
      }

      // Fetch all tiles after update
      const updatedTiles = await tx.select().from(tiles).where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo: updated! }
    })
  } catch (error) {
    console.error("Error adding row or column:", error)
    return { success: false, error: "Failed to add row or column" }
  }
}
export async function deleteTile(tileId: string, bingoId: string) {
  try {
    await db.transaction(async (tx) => {
      // Delete the tile
      await tx.delete(tiles).where(eq(tiles.id, tileId));

      // Get remaining tiles
      const remainingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index));

      // Reorder remaining tiles
      for (let i = 0; i < remainingTiles.length; i++) {
        await tx
          .update(tiles)
          .set({ index: i })
          .where(eq(tiles.id, remainingTiles[i]!.id));
      }

      // Update bingo dimensions
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId));

      const newTotalTiles = remainingTiles.length;
      const newRows = Math.floor(Math.sqrt(newTotalTiles));
      const newColumns = Math.ceil(newTotalTiles / newRows);

      await tx
        .update(bingos)
        .set({ rows: newRows, columns: newColumns })
        .where(eq(bingos.id, bingoId));

    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting tile:", error);
    return { success: false, error: "Failed to delete tile" };
  }
}

export async function addTile(bingoId: string): Promise<AddRowOrColumnResult> {
  try {
    return await db.transaction(async (tx) => {
      const [bingo] = await tx.select().from(bingos).where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const totalTiles = bingo.rows * bingo.columns + 1

      // Create new tile
      const [newTile] = await tx.insert(tiles).values({
        bingoId,
        title: `New Tile ${totalTiles}`,
        description: '',
        weight: 1,
        index: totalTiles - 1,
      }).returning()

      // Update bingo dimensions
      const newColumns = Math.ceil(Math.sqrt(totalTiles))
      const newRows = Math.ceil(totalTiles / newColumns)

      await tx.update(bingos).set({ rows: newRows, columns: newColumns }).where(eq(bingos.id, bingoId))
      bingo.columns = newColumns;
      bingo.rows = newRows;

      // Fetch all tiles after update
      const updatedTiles = await tx.select().from(tiles).where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo }
    })
  } catch (error) {
    console.error("Error adding tile:", error)
    return { success: false, error: "Failed to add tile" }
  }
}
