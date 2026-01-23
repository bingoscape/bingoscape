/* eslint-disable */
"use server"

import { db } from "@/server/db"
import {
  bingos,
  goals,
  itemGoals,
  teamGoalProgress,
  tiles,
  submissions,
  submissionComments,
  images,
  teams,
  teamTileSubmissions,
  teamTierProgress,
  tierXpRequirements,
  rowBonuses,
  columnBonuses,
  teamMembers,
  eventParticipants,
  users,
} from "@/server/db/schema"
import type { UUID } from "crypto"
import { asc, eq, inArray, and, gt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import type { Tile, TeamTileSubmission, Bingo } from "./events"
import { getUserRole } from "./events"
import { createNotification } from "./notifications"
import { getServerAuthSession } from "@/server/auth"
import getRandomFrog from "@/lib/getRandomFrog"
import {
  sendDiscordWebhook,
  createSubmissionEmbed,
} from "@/lib/discord-webhook"
import { discordWebhooks } from "@/server/db/schema"
import { sql } from "drizzle-orm"
import { logger } from "@/lib/logger"
import { trackError, trackDbQuery } from "@/lib/metrics"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

interface AddRowOrColumnSuccessResult {
  success: true
  tiles: Tile[]
  bingo: Bingo
}

interface AddRowOrColumnErrorResult {
  success: false
  error: string
}

type AddRowOrColumnResult =
  | AddRowOrColumnSuccessResult
  | AddRowOrColumnErrorResult

// Utility function to ensure the upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Type for selectable users in submission on-behalf-of dropdown
export interface SelectableUser {
  id: string
  name: string | null
  runescapeName: string | null
  teamId?: string | null
  teamName?: string | null
}

/**
 * Get users that the current user can submit on behalf of.
 * - Regular participants: can only submit for their own team members
 * - Management/Admin users: can submit for any event participant
 */
export async function getSelectableUsersForSubmission(
  eventId: string,
  teamId: string
): Promise<SelectableUser[]> {
  const session = await getServerAuthSession()
  if (!session?.user) return []

  const currentUserId = session.user.id
  const userRole = await getUserRole(eventId)
  const isManagement = userRole === "admin" || userRole === "management"

  if (isManagement) {
    // Return all event participants with their team info
    const participants = await db
      .select({
        id: users.id,
        name: users.name,
        runescapeName: users.runescapeName,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(users)
      .innerJoin(eventParticipants, eq(users.id, eventParticipants.userId))
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .leftJoin(
        teams,
        and(eq(teamMembers.teamId, teams.id), eq(teams.eventId, eventId))
      )
      .where(eq(eventParticipants.eventId, eventId))

    // Sort by team name and put current user first
    return participants.sort((a, b) => {
      // Current user always first
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
      // Then sort by team name (unassigned last)
      if (!a.teamName && b.teamName) return 1
      if (a.teamName && !b.teamName) return -1
      if (a.teamName && b.teamName) {
        const teamCompare = a.teamName.localeCompare(b.teamName)
        if (teamCompare !== 0) return teamCompare
      }
      // Then by name
      return (a.runescapeName || a.name || "").localeCompare(
        b.runescapeName || b.name || ""
      )
    })
  } else {
    // Return only team members
    const teamMembersList = await db
      .select({
        id: users.id,
        name: users.name,
        runescapeName: users.runescapeName,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(users)
      .innerJoin(teamMembers, eq(users.id, teamMembers.userId))
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.teamId, teamId))

    // Sort with current user first
    return teamMembersList.sort((a, b) => {
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
      return (a.runescapeName || a.name || "").localeCompare(
        b.runescapeName || b.name || ""
      )
    })
  }
}

/**
 * Validate if the current user can submit on behalf of another user.
 * Rules:
 * 1. Submitting for self → always allowed
 * 2. Admin/management → can submit for any event participant
 * 3. Regular participant → can only submit for same-team members
 */
async function canSubmitOnBehalfOf(
  submitterUserId: string,
  targetUserId: string,
  teamId: string,
  eventId: string
): Promise<boolean> {
  // Case 1: User is submitting for themselves - always allowed
  if (submitterUserId === targetUserId) return true

  // Case 2: Check if submitter is management/admin for the event
  const session = await getServerAuthSession()
  if (!session?.user || session.user.id !== submitterUserId) return false

  const submitterRole = await getUserRole(eventId)
  if (submitterRole === "admin" || submitterRole === "management") {
    // Management can submit for any participant in the event
    const isTargetParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, targetUserId)
      ),
    })
    return !!isTargetParticipant
  }

  // Case 3: Check if both users are on the same team
  const submitterOnTeam = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, submitterUserId)
    ),
  })
  const targetOnTeam = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, targetUserId)
    ),
  })

  return !!submitterOnTeam && !!targetOnTeam
}

export async function updateTile(
  tileId: string,
  updatedTile: Partial<typeof tiles.$inferInsert>
) {
  try {
    await db.update(tiles).set(updatedTile).where(eq(tiles.id, tileId))
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating tile")
    return { success: false, error: "Failed to update tile" }
  }
}

export async function reorderTiles(
  reorderedTiles: Array<{ id: string; index: number }>
) {
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
    logger.error({ error }, "Error reordering tiles")
    return { success: false, error: "Failed to reorder tiles" }
  }
}

export async function createBingo(formData: FormData) {
  const eventId = formData.get("eventId") as UUID
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const rowsStr = formData.get("rows") as string
  const columnsStr = formData.get("columns") as string
  const codephrase = formData.get("codephrase") as string
  const bingoType =
    (formData.get("bingoType") as "standard" | "progression") || "standard"
  const tiersUnlockRequirementStr = formData.get(
    "tiersUnlockRequirement"
  ) as string

  logger.debug({ formData }, "Create bingo form data")

  if (!eventId || !title || !rowsStr || !columnsStr) {
    throw new Error("Missing required fields")
  }

  const rows = Number.parseInt(rowsStr)
  const columns = Number.parseInt(columnsStr)
  const tiersUnlockRequirement = tiersUnlockRequirementStr
    ? Number.parseInt(tiersUnlockRequirementStr)
    : 1

  if (isNaN(rows) || isNaN(columns) || rows < 1 || columns < 1) {
    throw new Error("Invalid rows or columns")
  }

  // Parse pattern bonuses
  const mainDiagonalBonus =
    parseInt((formData.get("mainDiagonalBonus") as string) || "0") || 0
  const antiDiagonalBonus =
    parseInt((formData.get("antiDiagonalBonus") as string) || "0") || 0
  const completeBoardBonus =
    parseInt((formData.get("completeBoardBonus") as string) || "0") || 0

  const newBingo = await db
    .insert(bingos)
    .values({
      eventId,
      title,
      description: description || "",
      rows,
      codephrase,
      columns,
      bingoType,
      tiersUnlockRequirement,
      mainDiagonalBonusXP: rows === columns ? mainDiagonalBonus : 0,
      antiDiagonalBonusXP: rows === columns ? antiDiagonalBonus : 0,
      completeBoardBonusXP: bingoType === "standard" ? completeBoardBonus : 0,
    })
    .returning({ id: bingos.id })

  const bingoId = newBingo[0]!.id

  const tilesToInsert = []
  for (let idx = 0; idx < rows * columns; idx++) {
    tilesToInsert.push({
      bingoId,
      title: `Tile ${idx + 1}`,
      headerImage: getRandomFrog(),
      description: `Tile ${idx + 1}`,
      weight: 1,
      isHidden: false,
      index: idx,
      tier: bingoType === "progression" ? Math.floor(idx / columns) : 0, // Assign tiers based on rows for progression
    })
  }

  await db.insert(tiles).values(tilesToInsert)

  // Initialize pattern bonuses for standard bingos
  if (bingoType === "standard") {
    // Insert row bonuses
    const rowBonusValues = []
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const bonusXP =
        parseInt((formData.get(`rowBonus-${rowIndex}`) as string) || "0") || 0
      if (bonusXP > 0) {
        rowBonusValues.push({
          bingoId,
          rowIndex,
          bonusXP,
        })
      }
    }
    if (rowBonusValues.length > 0) {
      await db.insert(rowBonuses).values(rowBonusValues)
    }

    // Insert column bonuses
    const columnBonusValues = []
    for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
      const bonusXP =
        parseInt(
          (formData.get(`columnBonus-${columnIndex}`) as string) || "0"
        ) || 0
      if (bonusXP > 0) {
        columnBonusValues.push({
          bingoId,
          columnIndex,
          bonusXP,
        })
      }
    }
    if (columnBonusValues.length > 0) {
      await db.insert(columnBonuses).values(columnBonusValues)
    }
  }

  // Initialize tier XP requirements for progression bingos
  if (bingoType === "progression") {
    await initializeTierXpRequirements(bingoId, tiersUnlockRequirement)
  }

  return { success: true }
}

export async function deleteBingo(bingoId: string) {
  try {
    await db.transaction(async (tx) => {
      // Delete all tiles associated with the bingo
      const tilesDeleted = await tx
        .delete(tiles)
        .where(eq(tiles.bingoId, bingoId))

      // Delete the bingo itself
      const bingosDeleted = await tx
        .delete(bingos)
        .where(eq(bingos.id, bingoId))
      // console.table(tilesDeleted, bingosDeleted);
    })

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting bingo")
    return { success: false, error: "Failed to delete bingo" }
  }
}

export async function addGoal(
  tileId: string,
  goal: { description: string; targetValue: number }
) {
  try {
    const [newGoal] = await db
      .insert(goals)
      .values({
        tileId,
        description: goal.description,
        targetValue: goal.targetValue,
      })
      .returning()

    return { success: true, goal: newGoal }
  } catch (error) {
    logger.error({ error }, "Error adding goal")
    return { success: false, error: "Failed to add goal" }
  }
}

export async function deleteGoal(goalId: string) {
  try {
    await db.delete(goals).where(eq(goals.id, goalId))
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting goal")
    return { success: false, error: "Failed to delete goal" }
  }
}

/**
 * Update a goal's description and/or target value
 */
export async function updateGoal(
  goalId: string,
  updates: {
    description?: string
    targetValue?: number
  }
) {
  try {
    // Validate inputs
    if (updates.targetValue !== undefined && updates.targetValue <= 0) {
      return { success: false, error: "Target value must be greater than 0" }
    }

    if (
      updates.description !== undefined &&
      updates.description.trim() === ""
    ) {
      return { success: false, error: "Description cannot be empty" }
    }

    // Build update object
    const updateData: Partial<typeof goals.$inferInsert> & { updatedAt: Date } =
      {
        updatedAt: new Date(),
      }

    if (updates.description !== undefined) {
      updateData.description = updates.description.trim()
    }

    if (updates.targetValue !== undefined) {
      updateData.targetValue = updates.targetValue
    }

    // Update the goal
    const [updatedGoal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, goalId))
      .returning()

    return { success: true, goal: updatedGoal }
  } catch (error) {
    logger.error({ error }, "Error updating goal")
    return { success: false, error: "Failed to update goal" }
  }
}

/**
 * Create an item goal with associated item metadata
 */
export async function createItemGoal(
  tileId: string,
  itemId: number,
  itemName: string,
  baseName: string,
  imageUrl: string,
  targetValue: number,
  exactVariant?: string | null
) {
  try {
    // Create the goal first
    const [newGoal] = await db
      .insert(goals)
      .values({
        tileId,
        description: itemName,
        targetValue,
        goalType: "item",
      })
      .returning()

    if (!newGoal) {
      return { success: false, error: "Failed to create goal" }
    }

    // Create the item goal metadata
    const [itemGoalData] = await db
      .insert(itemGoals)
      .values({
        goalId: newGoal.id,
        itemId,
        baseName,
        exactVariant: exactVariant ?? null,
        imageUrl,
      })
      .returning()

    return { success: true, goal: newGoal, itemGoal: itemGoalData }
  } catch (error) {
    logger.error({ error }, "Error creating item goal")
    return { success: false, error: "Failed to create item goal" }
  }
}

/**
 * Get goal with item data if it's an item goal
 */
export async function getGoalWithItemData(goalId: string) {
  try {
    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
      with: {
        itemGoal: true,
      },
    })

    if (!goal) {
      return { success: false, error: "Goal not found" }
    }

    return { success: true, goal }
  } catch (error) {
    logger.error({ error }, "Error getting goal with item data")
    return { success: false, error: "Failed to get goal" }
  }
}

/**
 * Update item goal metadata
 */
export async function updateItemGoal(
  goalId: string,
  itemId: number,
  itemName: string,
  baseName: string,
  imageUrl: string,
  exactVariant?: string | null,
  targetValue?: number
) {
  try {
    // Build goal update object
    const goalUpdate: Partial<typeof goals.$inferInsert> & { updatedAt: Date } =
      {
        description: itemName,
        updatedAt: new Date(),
      }

    if (targetValue !== undefined && targetValue > 0) {
      goalUpdate.targetValue = targetValue
    }

    // Update goal description and optionally target value
    await db.update(goals).set(goalUpdate).where(eq(goals.id, goalId))

    // Update item goal metadata
    const [updatedItemGoal] = await db
      .update(itemGoals)
      .set({
        itemId,
        baseName,
        exactVariant: exactVariant ?? null,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(itemGoals.goalId, goalId))
      .returning()

    return { success: true, itemGoal: updatedItemGoal }
  } catch (error) {
    logger.error({ error }, "Error updating item goal")
    return { success: false, error: "Failed to update item goal" }
  }
}

/**
 * Get all item goals for a tile
 */
export async function getItemGoalsForTile(tileId: string) {
  try {
    const itemGoalsList = await db.query.goals.findMany({
      where: and(eq(goals.tileId, tileId), eq(goals.goalType, "item")),
      with: {
        itemGoal: true,
      },
    })

    return { success: true, goals: itemGoalsList }
  } catch (error) {
    logger.error({ error }, "Error getting item goals for tile")
    return { success: false, error: "Failed to get item goals" }
  }
}

export async function updateGoalProgress(
  goalId: string,
  teamId: string,
  newValue: number
) {
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

    // Check if we need to auto-complete the tile
    // First, get the tileId from the goal
    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    })

    if (goal) {
      // Import the auto-completion function
      const { checkAndAutoCompleteTile } = await import("./tile-completion")
      await checkAndAutoCompleteTile(goal.tileId, teamId)
    }

    return { success: true, progress: updatedProgress }
  } catch (error) {
    logger.error({ error }, "Error updating goal progress")
    return { success: false, error: "Failed to update goal progress" }
  }
}

export async function getTileGoalsAndProgress(tileId: string) {
  const tileGoals = await db.query.goals.findMany({
    where: eq(goals.tileId, tileId),
    with: {
      teamProgress: true,
      goalValues: true, // Add this line to include goal values
    },
  })

  return tileGoals
}

export interface GoalData {
  id: string
  description: string
  createdAt: Date
  updatedAt: Date
  tileId: string
  targetValue: number
}

export interface TileData {
  id: string
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
  bingoId: string
  headerImage: string | null
  weight: number
  index: number
  isHidden: boolean
  tier: number
  goals: GoalData[]
}

export interface BingoData {
  id: string
  title: string
  description: string | null
  columns: number
  createdAt: Date
  updatedAt: Date
  locked: boolean
  eventId: string
  rows: number
  codephrase: string
  visible: boolean
  bingoType: "standard" | "progression"
  tiersUnlockRequirement: number
  tiles: TileData[]
}

// Update the getAllSubmissionsForTeam function to include goal information
export async function getAllSubmissionsForTeam(
  bingoId: string,
  teamId: string
): Promise<Record<string, TeamTileSubmission[]>> {
  try {
    // First, get all tiles for this bingo
    const bingoTiles = await db
      .select({ id: tiles.id })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))

    if (!bingoTiles.length) {
      return {}
    }

    // Get all tile IDs
    const tileIds = bingoTiles.map((tile) => tile.id)

    // Fetch all submissions for this team across all tiles in the bingo
    // Type assertion is safe here because:
    // 1. The query structure matches TeamTileSubmission interface exactly
    // 2. Drizzle's type inference doesn't match our custom interfaces
    // 3. The relations ensure correct data structure at runtime
    const teamSubmissions = (await db.query.teamTileSubmissions.findMany({
      with: {
        submissions: {
          with: {
            image: true,
            user: true,
            goal: true, // Include goal information
          },
        },
        team: true,
        tile: true,
      },
      where: and(
        eq(teamTileSubmissions.teamId, teamId),
        inArray(teamTileSubmissions.tileId, tileIds)
      ),
    })) as unknown as TeamTileSubmission[]

    // Group submissions by tile ID
    const submissionsByTile: Record<string, TeamTileSubmission[]> = {}

    for (const submission of teamSubmissions) {
      const tileId = submission.tileId
      if (!submissionsByTile[tileId]) {
        submissionsByTile[tileId] = []
      }
      submissionsByTile[tileId].push(submission)
    }

    return submissionsByTile
  } catch (error) {
    logger.error({ error }, "Error fetching team submissions")
    throw new Error("Failed to fetch team submissions")
  }
}

// Update the submitImage function to send image as Discord attachment
// Supports submitting on behalf of another user via onBehalfOfUserId parameter
export async function submitImage(formData: FormData) {
  try {
    const tileId = formData.get("tileId") as string
    const teamId = formData.get("teamId") as string
    const image = formData.get("image") as File
    const onBehalfOfUserId = formData.get("onBehalfOfUserId") as string | null

    if (!tileId || !teamId || !image) {
      throw new Error("Missing required fields")
    }

    // Get session first to validate user
    const session = await getServerAuthSession()
    if (!session?.user) {
      throw new Error("Not authenticated")
    }

    // Check if the tile exists and get its bingoId
    const tileResult = await db
      .select({
        id: tiles.id,
        bingoId: tiles.bingoId,
        title: tiles.title,
        description: tiles.description,
      })
      .from(tiles)
      .where(eq(tiles.id, tileId))
      .execute()

    if (tileResult.length === 0) {
      throw new Error("Tile not found")
    }

    const tile = tileResult[0]!

    // Get bingo and event information
    const bingoResult = await db.query.bingos.findFirst({
      where: eq(bingos.id, tile.bingoId),
      with: {
        event: true,
      },
    })

    if (!bingoResult) {
      throw new Error("Bingo not found")
    }

    // Determine the target user for the submission
    const targetUserId = onBehalfOfUserId || session.user.id

    // Validate permission to submit on behalf of another user
    if (onBehalfOfUserId && onBehalfOfUserId !== session.user.id) {
      const canSubmit = await canSubmitOnBehalfOf(
        session.user.id,
        onBehalfOfUserId,
        teamId,
        bingoResult.eventId
      )
      if (!canSubmit) {
        throw new Error(
          "You do not have permission to submit on behalf of this user"
        )
      }
    }

    // Determine the correct team ID - use the target user's team when submitting on behalf
    let effectiveTeamId = teamId
    let targetUser = session.user as {
      id: string
      name: string | null
      runescapeName: string | null
    }

    if (onBehalfOfUserId && onBehalfOfUserId !== session.user.id) {
      // Look up the target user's team in this event
      const targetUserTeamResult = await db
        .select({
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
          teamId: teams.id,
          teamName: teams.name,
        })
        .from(users)
        .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
        .leftJoin(
          teams,
          and(
            eq(teamMembers.teamId, teams.id),
            eq(teams.eventId, bingoResult.eventId)
          )
        )
        .where(eq(users.id, onBehalfOfUserId))
        .execute()

      if (targetUserTeamResult.length > 0 && targetUserTeamResult[0]) {
        const targetUserData = targetUserTeamResult[0]
        targetUser = {
          id: targetUserData.id,
          name: targetUserData.name,
          runescapeName: targetUserData.runescapeName,
        }
        // Use the target user's team if they have one
        if (targetUserData.teamId) {
          effectiveTeamId = targetUserData.teamId
        }
      }
    }

    // Check if the team exists and get its name
    const teamResult = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, effectiveTeamId))
      .execute()

    if (teamResult.length === 0) {
      throw new Error("Team not found")
    }

    const team = teamResult[0]!

    // Ensure the upload directory exists
    await ensureUploadDir()

    // Generate a unique filename
    const filename = `${nanoid()}`
    const filePath = path.join(UPLOAD_DIR, filename)

    // Write the file to the server
    const buffer = Buffer.from(await image.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Calculate the relative path for storage and serving
    const relativePath = path.join("/uploads", filename).replace(/\\/g, "/")

    const newSubmission = await db.transaction(async (tx) => {
      // Get or create teamTileSubmission
      const [teamTileSubmission] = await tx
        .insert(teamTileSubmissions)
        .values({
          tileId,
          teamId: effectiveTeamId,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
          set: {
            updatedAt: new Date(),
            status: "pending", // Reset status to pending when a new submission is made
          },
        })
        .returning()

      // Insert the image record
      const [insertedImage] = await tx
        .insert(images)
        .values({
          path: relativePath,
        })
        .returning()

      // Insert the submission record with target user as submittedBy
      const [insertedSubmission] = await tx
        .insert(submissions)
        .values({
          teamTileSubmissionId: teamTileSubmission!.id,
          submittedBy: targetUserId,
          imageId: insertedImage!.id,
          // No goalId here - will be assigned during review
        })
        .returning()

      return {
        submission: insertedSubmission,
        image: insertedImage,
        teamTileSubmission,
      }
    })

    // Create a notification for admin and management users
    await createNotification(
      bingoResult.eventId,
      tileId,
      effectiveTeamId,
      `Team ${team.name} has submitted an image for tile "${tile.title}"`
    )

    // Send Discord webhook notifications
    try {
      // Get active Discord webhooks for this event
      const activeWebhooks = await db.query.discordWebhooks.findMany({
        where: and(
          eq(discordWebhooks.eventId, bingoResult.event.id),
          eq(discordWebhooks.isActive, true)
        ),
      })

      if (activeWebhooks.length > 0) {
        // Get submission count for this team/tile combination
        const submissionCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(submissions)
          .innerJoin(
            teamTileSubmissions,
            eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
          )
          .where(
            and(
              eq(teamTileSubmissions.tileId, tileId),
              eq(teamTileSubmissions.teamId, effectiveTeamId)
            )
          )

        const count = submissionCount[0]?.count || 1

        // Generate team color
        const teamColor = `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`

        // Use targetUser for Discord embed (shows correct user when submitting on behalf)
        const embedData = {
          userName: targetUser.name || "Unknown",
          runescapeName: targetUser.runescapeName,
          teamName: team.name,
          tileName: tile.title,
          tileDescription: tile.description,
          eventTitle: bingoResult.event.title,
          bingoTitle: bingoResult.title,
          submissionCount: count,
          teamColor,
        }

        const embed = createSubmissionEmbed(embedData)

        // Prepare the image file for Discord attachment
        const imageExtension = image.name.split(".").pop() || "png"
        const discordFileName = `submission_${nanoid()}.${imageExtension}`

        // Send to all active webhooks
        const webhookPromises = activeWebhooks.map((webhook) =>
          sendDiscordWebhook(webhook.webhookUrl, {
            embeds: [embed],
            files: [
              {
                attachment: buffer,
                name: discordFileName,
              },
            ],
          })
        )

        await Promise.allSettled(webhookPromises)
      }
    } catch (discordError) {
      // Log Discord errors but don't fail the submission
      logger.error({ error: discordError }, "Discord webhook error")
    }

    // Revalidate the bingo page
    revalidatePath("/bingo")

    return { success: true, submission: newSubmission.submission }
  } catch (error) {
    logger.error({ error }, "Error submitting image")
    return { success: false, error: (error as Error).message }
  }
}

// Add new server action for updating individual submission status and assigning a goal
export async function updateSubmissionStatus(
  submissionId: string,
  newStatus: "approved" | "needs_review" | "pending",
  goalId?: string | null,
  submissionValue?: number | null
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    logger.info(
      { submissionId, newStatus, goalId, submissionValue },
      "Updating submission status"
    )

    // Create the update data object
    const updateData: Record<string, any> = {
      status: newStatus,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }

    // Only update goalId if it's provided (including null to remove a goal)
    if (goalId !== undefined) {
      updateData.goalId = goalId
    }

    // Update submission value if provided
    if (submissionValue !== undefined) {
      updateData.submissionValue = submissionValue
    }

    const [updatedSubmission] = await db
      .update(submissions)
      .set(updateData)
      .where(eq(submissions.id, submissionId))
      .returning()

    if (!updatedSubmission) {
      throw new Error("Submission not found")
    }

    // If marking individual submission as "needs_review", update the parent tile status
    if (newStatus === "needs_review") {
      await db
        .update(teamTileSubmissions)
        .set({
          status: "needs_review",
          reviewedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(
          eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
        )
    }

    // If submission has a goal assignment, recalculate goal progress
    if (updatedSubmission.goalId) {
      // Get the team submission to find the team ID
      const teamSubmission = await db.query.teamTileSubmissions.findFirst({
        where: eq(
          teamTileSubmissions.id,
          updatedSubmission.teamTileSubmissionId
        ),
      })

      if (teamSubmission) {
        // Recalculate progress from ALL approved submissions for this goal and team
        const approvedSubmissions = await db
          .select({
            submissionValue: submissions.submissionValue,
          })
          .from(submissions)
          .innerJoin(
            teamTileSubmissions,
            eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
          )
          .where(
            and(
              eq(submissions.goalId, updatedSubmission.goalId),
              eq(submissions.status, "approved"),
              eq(teamTileSubmissions.teamId, teamSubmission.teamId)
            )
          )

        const totalValue = approvedSubmissions.reduce(
          (sum, s) => sum + (s.submissionValue || 0),
          0
        )

        // Get current goal progress for this team
        const currentProgress = await db.query.teamGoalProgress.findFirst({
          where: and(
            eq(teamGoalProgress.goalId, updatedSubmission.goalId),
            eq(teamGoalProgress.teamId, teamSubmission.teamId)
          ),
        })

        if (currentProgress) {
          // Update existing progress
          await db
            .update(teamGoalProgress)
            .set({
              currentValue: totalValue,
              updatedAt: new Date(),
            })
            .where(eq(teamGoalProgress.id, currentProgress.id))
        } else if (totalValue > 0) {
          // Create new progress entry only if there's actual progress
          await db.insert(teamGoalProgress).values({
            goalId: updatedSubmission.goalId,
            teamId: teamSubmission.teamId,
            currentValue: totalValue,
          })
        }

        // Check if we need to auto-complete the tile
        const goal = await db.query.goals.findFirst({
          where: eq(goals.id, updatedSubmission.goalId),
        })
        if (goal) {
          const { checkAndAutoCompleteTile } = await import("./tile-completion")
          await checkAndAutoCompleteTile(goal.tileId, teamSubmission.teamId)
        }
      }
    }

    // Revalidate the submissions page
    revalidatePath("/bingo")

    return { success: true, submission: updatedSubmission }
  } catch (error) {
    logger.error({ error }, "Error updating submission status")
    return { success: false, error: "Failed to update submission status" }
  }
}

// Keep the existing updateTeamTileSubmissionStatus function but remove any automatic propagation
export async function updateTeamTileSubmissionStatus(
  teamTileSubmissionId: string,
  newStatus: "approved" | "needs_review"
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    const [updatedTeamTileSubmission] = await db
      .update(teamTileSubmissions)
      .set({
        status: newStatus,
        reviewedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(teamTileSubmissions.id, teamTileSubmissionId))
      .returning()

    if (!updatedTeamTileSubmission) {
      throw new Error("Team tile submission not found")
    }

    // If approving the whole tile, approve all individual submissions
    if (newStatus === "approved") {
      await db
        .update(submissions)
        .set({
          status: "approved",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(submissions.teamTileSubmissionId, teamTileSubmissionId))

      // Check for tier unlock in progression bingo
      const tile = await db.query.tiles.findFirst({
        where: eq(tiles.id, updatedTeamTileSubmission.tileId),
        with: { bingo: true },
      })

      if (tile && tile.bingo.bingoType === "progression") {
        await checkAndUnlockNextTier(
          updatedTeamTileSubmission.teamId,
          tile.bingoId
        )
      }
    }

    // Revalidate the submissions page
    revalidatePath("/bingo")

    return { success: true, teamTileSubmission: updatedTeamTileSubmission }
  } catch (error) {
    logger.error({ error }, "Error updating team tile submission status")
    return {
      success: false,
      error: "Failed to update team tile submission status",
    }
  }
}

// New function for updating submission status with comment (used when marking as "needs_review")
export async function updateSubmissionStatusWithComment(
  submissionId: string,
  newStatus: "approved" | "needs_review" | "pending",
  comment?: string,
  goalId?: string | null,
  submissionValue?: number | null
) {
  try {
    const session = await getServerAuthSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    logger.info(
      { submissionId, newStatus, comment },
      "Updating submission status with comment"
    )

    return await db.transaction(async (tx) => {
      // Create the update data object
      const updateData: Record<string, any> = {
        status: newStatus,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }

      // Only update goalId if it's provided (including null to remove a goal)
      if (goalId !== undefined) {
        updateData.goalId = goalId
      }

      // Update submission value if provided
      if (submissionValue !== undefined) {
        updateData.submissionValue = submissionValue
      }

      const [updatedSubmission] = await tx
        .update(submissions)
        .set(updateData)
        .where(eq(submissions.id, submissionId))
        .returning()

      if (!updatedSubmission) {
        throw new Error("Submission not found")
      }

      // Add comment if provided (required for "needs_review" status)
      if (comment && comment.trim()) {
        await tx.insert(submissionComments).values({
          submissionId: submissionId,
          authorId: session.user.id,
          comment: comment.trim(),
        })
      }

      // If marking individual submission as "needs_review", update the parent tile status
      if (newStatus === "needs_review") {
        await tx
          .update(teamTileSubmissions)
          .set({
            status: "needs_review",
            updatedAt: new Date(),
          })
          .where(
            eq(teamTileSubmissions.id, updatedSubmission.teamTileSubmissionId)
          )
      }

      // If submission has a goal assignment, recalculate goal progress
      if (updatedSubmission.goalId) {
        // Get the team submission to find the team ID
        const teamSubmission = await tx.query.teamTileSubmissions.findFirst({
          where: eq(
            teamTileSubmissions.id,
            updatedSubmission.teamTileSubmissionId
          ),
        })

        if (teamSubmission) {
          // Recalculate progress from ALL approved submissions for this goal and team
          const approvedSubmissions = await tx
            .select({
              submissionValue: submissions.submissionValue,
            })
            .from(submissions)
            .innerJoin(
              teamTileSubmissions,
              eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
            )
            .where(
              and(
                eq(submissions.goalId, updatedSubmission.goalId),
                eq(submissions.status, "approved"),
                eq(teamTileSubmissions.teamId, teamSubmission.teamId)
              )
            )

          const totalValue = approvedSubmissions.reduce(
            (sum, s) => sum + (s.submissionValue || 0),
            0
          )

          // Get current goal progress for this team
          const currentProgress = await tx.query.teamGoalProgress.findFirst({
            where: and(
              eq(teamGoalProgress.goalId, updatedSubmission.goalId),
              eq(teamGoalProgress.teamId, teamSubmission.teamId)
            ),
          })

          if (currentProgress) {
            // Update existing progress
            await tx
              .update(teamGoalProgress)
              .set({
                currentValue: totalValue,
                updatedAt: new Date(),
              })
              .where(eq(teamGoalProgress.id, currentProgress.id))
          } else if (totalValue > 0) {
            // Create new progress entry only if there's actual progress
            await tx.insert(teamGoalProgress).values({
              goalId: updatedSubmission.goalId,
              teamId: teamSubmission.teamId,
              currentValue: totalValue,
            })
          }

          // Check if we need to auto-complete the tile
          const goal = await tx.query.goals.findFirst({
            where: eq(goals.id, updatedSubmission.goalId),
          })
          if (goal) {
            const { checkAndAutoCompleteTile } =
              await import("./tile-completion")
            await checkAndAutoCompleteTile(goal.tileId, teamSubmission.teamId)
          }
        }
      }

      // Revalidate the submissions page
      revalidatePath("/bingo")

      return { success: true, submission: updatedSubmission }
    })
  } catch (error) {
    logger.error({ error }, "Error updating submission status with comment")
    return { success: false, error: "Failed to update submission status" }
  }
}

export async function deleteSubmission(submissionId: string) {
  try {
    return await db.transaction(async (tx) => {
      // First, get the submission to find the associated image
      const [submission] = await tx
        .select({
          id: submissions.id,
          imageId: submissions.imageId,
          teamTileSubmissionId: submissions.teamTileSubmissionId,
        })
        .from(submissions)
        .where(eq(submissions.id, submissionId))

      if (!submission) {
        throw new Error("Submission not found")
      }

      // Get the image path to delete the file
      const [imageRecord] = await tx
        .select({ path: images.path })
        .from(images)
        .where(eq(images.id, submission.imageId))

      if (imageRecord?.path) {
        // Delete the image file from the filesystem
        const filePath = path.join(process.cwd(), "public", imageRecord.path)
        try {
          await fs.access(filePath)
          await fs.unlink(filePath)
        } catch (fileError) {
          // If file doesn't exist, just log and continue
          logger.warn(
            { error: fileError, filePath },
            `Could not delete file at ${filePath}`
          )
        }
      }

      // Delete the submission record
      await tx.delete(submissions).where(eq(submissions.id, submissionId))

      // Delete the image record
      if (imageRecord) {
        await tx.delete(images).where(eq(images.id, submission.imageId))
      }

      // Note: We no longer automatically update the team tile submission status
      // when individual submissions are deleted - they remain independent

      return { success: true }
    })
  } catch (error) {
    logger.error({ error }, "Error deleting submission")
    return { success: false, error: (error as Error).message }
  }
}

export async function addRowOrColumn(
  bingoId: string,
  type: "row" | "column"
): Promise<AddRowOrColumnResult> {
  try {
    return await db.transaction(async (tx) => {
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const newSize = type === "row" ? bingo.rows + 1 : bingo.columns + 1
      const totalTiles =
        type === "row" ? newSize * bingo.columns : bingo.rows * newSize

      // Update bingo size
      await tx
        .update(bingos)
        .set({ [type === "row" ? "rows" : "columns"]: newSize })
        .where(eq(bingos.id, bingoId))

      // Get existing tiles
      const existingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
      const [updated] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))

      // Create new tiles
      const newTiles = []
      for (let i = existingTiles.length; i < totalTiles; i++) {
        newTiles.push({
          bingoId,
          title: `New Tile ${i + 1}`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: i,
          isHidden: false,
        })
      }

      if (newTiles.length > 0) {
        await tx.insert(tiles).values(newTiles)
      }

      // Fetch all tiles after update
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo: updated! }
    })
  } catch (error) {
    logger.error({ error }, "Error adding row or column")
    return { success: false, error: "Failed to add row or column" }
  }
}

export async function deleteTile(tileId: string, bingoId: string) {
  try {
    await db.transaction(async (tx) => {
      // Delete the tile
      await tx.delete(tiles).where(eq(tiles.id, tileId))

      // Get remaining tiles
      const remainingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      // Reorder remaining tiles
      for (let i = 0; i < remainingTiles.length; i++) {
        await tx
          .update(tiles)
          .set({ index: i })
          .where(eq(tiles.id, remainingTiles[i]!.id))
      }

      // Update bingo dimensions
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))

      const newTotalTiles = remainingTiles.length
      const newRows = Math.floor(Math.sqrt(newTotalTiles))
      const newColumns = Math.ceil(newTotalTiles / newRows)

      await tx
        .update(bingos)
        .set({ rows: newRows, columns: newColumns })
        .where(eq(bingos.id, bingoId))
    })

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting tile")
    return { success: false, error: "Failed to delete tile" }
  }
}

export async function addTile(bingoId: string): Promise<AddRowOrColumnResult> {
  try {
    return await db.transaction(async (tx) => {
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      const totalTiles = bingo.rows * bingo.columns + 1

      // Create new tile
      const [newTile] = await tx
        .insert(tiles)
        .values({
          bingoId,
          title: `New Tile ${totalTiles}`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: totalTiles - 1,
          isHidden: false,
        })
        .returning()

      // Update bingo dimensions
      const newColumns = Math.ceil(Math.sqrt(totalTiles))
      const newRows = Math.ceil(totalTiles / newColumns)

      await tx
        .update(bingos)
        .set({ rows: newRows, columns: newColumns })
        .where(eq(bingos.id, bingoId))
      bingo.columns = newColumns
      bingo.rows = newRows

      // Fetch all tiles after update
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      return { success: true, tiles: updatedTiles, bingo }
    })
  } catch (error) {
    logger.error({ error }, "Error adding tile")
    return { success: false, error: "Failed to add tile" }
  }
}

export async function deleteRowOrColumn(
  bingoId: string,
  type: "row" | "column"
): Promise<AddRowOrColumnResult> {
  try {
    return await db.transaction(async (tx) => {
      const [bingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      if (!bingo) throw new Error("Bingo not found")

      if (
        (type === "row" && bingo.rows <= 1) ||
        (type === "column" && bingo.columns <= 1)
      ) {
        throw new Error(`Cannot delete the last ${type}`)
      }

      const newSize = type === "row" ? bingo.rows - 1 : bingo.columns - 1

      // Update bingo size
      await tx
        .update(bingos)
        .set({ [type === "row" ? "rows" : "columns"]: newSize })
        .where(eq(bingos.id, bingoId))

      // Get existing tiles
      const existingTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      // Delete tiles
      const tilesToDelete =
        type === "row"
          ? existingTiles.slice(-bingo.columns)
          : existingTiles.filter(
              (_, index) => (index + 1) % bingo.columns === 0
            )

      await tx.delete(tiles).where(
        inArray(
          tiles.id,
          tilesToDelete.map((tile) => tile.id)
        )
      )

      // Reindex remaining tiles
      const remainingTiles = existingTiles.filter(
        (tile) => !tilesToDelete.includes(tile)
      )
      for (let i = 0; i < remainingTiles.length; i++) {
        await tx
          .update(tiles)
          .set({ index: i })
          .where(eq(tiles.id, remainingTiles[i]!.id))
      }

      // Fetch updated bingo and tiles
      const [updatedBingo] = await tx
        .select()
        .from(bingos)
        .where(eq(bingos.id, bingoId))
      const updatedTiles = await tx
        .select()
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))
        .orderBy(asc(tiles.index))

      return { success: true, tiles: updatedTiles, bingo: updatedBingo! }
    })
  } catch (error) {
    logger.error({ error, type }, `Error deleting ${type}`)
    return { success: false, error: `Failed to delete ${type}` }
  }
}

interface UpdateBingoData {
  title: string
  description: string
  visible: boolean
  locked: boolean
  codephrase: string
  bingoType?: "standard" | "progression"
  tiersUnlockRequirement?: number
}

interface PatternBonusData {
  rowBonuses?: Record<number, number>
  columnBonuses?: Record<number, number>
  mainDiagonalBonus?: number
  antiDiagonalBonus?: number
  completeBoardBonus?: number
}

interface UpdateBingoDataWithBonuses extends UpdateBingoData {
  patternBonuses?: PatternBonusData
}

export async function updateBingo(
  bingoId: string,
  data: UpdateBingoDataWithBonuses
) {
  try {
    await db.transaction(async (tx) => {
      const updateData: any = {
        title: data.title,
        description: data.description,
        visible: data.visible,
        locked: data.locked,
        codephrase: data.codephrase,
        updatedAt: new Date(),
      }

      if (data.bingoType !== undefined) {
        updateData.bingoType = data.bingoType
      }

      if (data.tiersUnlockRequirement !== undefined) {
        updateData.tiersUnlockRequirement = data.tiersUnlockRequirement
      }

      // Update pattern bonuses if provided
      if (data.patternBonuses?.mainDiagonalBonus !== undefined) {
        updateData.mainDiagonalBonusXP = data.patternBonuses.mainDiagonalBonus
      }

      if (data.patternBonuses?.antiDiagonalBonus !== undefined) {
        updateData.antiDiagonalBonusXP = data.patternBonuses.antiDiagonalBonus
      }

      if (data.patternBonuses?.completeBoardBonus !== undefined) {
        updateData.completeBoardBonusXP = data.patternBonuses.completeBoardBonus
      }

      await tx.update(bingos).set(updateData).where(eq(bingos.id, bingoId))

      // Update row bonuses if provided
      if (data.patternBonuses?.rowBonuses) {
        for (const [rowIndexStr, bonusXP] of Object.entries(
          data.patternBonuses.rowBonuses
        )) {
          const rowIndex = parseInt(rowIndexStr)

          // Check if row bonus exists
          const existingBonus = await tx.query.rowBonuses.findFirst({
            where: and(
              eq(rowBonuses.bingoId, bingoId),
              eq(rowBonuses.rowIndex, rowIndex)
            ),
          })

          if (bonusXP > 0) {
            if (existingBonus) {
              // Update existing bonus
              await tx
                .update(rowBonuses)
                .set({ bonusXP, updatedAt: new Date() })
                .where(eq(rowBonuses.id, existingBonus.id))
            } else {
              // Insert new bonus
              await tx.insert(rowBonuses).values({
                bingoId,
                rowIndex,
                bonusXP,
              })
            }
          } else if (existingBonus) {
            // Delete bonus if set to 0
            await tx
              .delete(rowBonuses)
              .where(eq(rowBonuses.id, existingBonus.id))
          }
        }
      }

      // Update column bonuses if provided
      if (data.patternBonuses?.columnBonuses) {
        for (const [columnIndexStr, bonusXP] of Object.entries(
          data.patternBonuses.columnBonuses
        )) {
          const columnIndex = parseInt(columnIndexStr)

          // Check if column bonus exists
          const existingBonus = await tx.query.columnBonuses.findFirst({
            where: and(
              eq(columnBonuses.bingoId, bingoId),
              eq(columnBonuses.columnIndex, columnIndex)
            ),
          })

          if (bonusXP > 0) {
            if (existingBonus) {
              // Update existing bonus
              await tx
                .update(columnBonuses)
                .set({ bonusXP, updatedAt: new Date() })
                .where(eq(columnBonuses.id, existingBonus.id))
            } else {
              // Insert new bonus
              await tx.insert(columnBonuses).values({
                bingoId,
                columnIndex,
                bonusXP,
              })
            }
          } else if (existingBonus) {
            // Delete bonus if set to 0
            await tx
              .delete(columnBonuses)
              .where(eq(columnBonuses.id, existingBonus.id))
          }
        }
      }
    })

    // Revalidate the bingo page
    revalidatePath(`/events/[id]/bingos/${bingoId}`)
    revalidatePath(`/events/[id]`)

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating bingo")
    return { success: false, error: "Failed to update bingo" }
  }
}

export async function getBingoWithPatternBonuses(bingoId: string) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: {
        rowBonuses: true,
        columnBonuses: true,
      },
    })

    if (!bingo) {
      return { success: false, error: "Bingo not found" }
    }

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
}

// Progression Bingo Functions

export async function getTeamTierProgress(teamId: string, bingoId: string) {
  try {
    const tierProgress = await db.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
      orderBy: asc(teamTierProgress.tier),
    })

    return tierProgress
  } catch (error) {
    logger.error({ error }, "Error fetching team tier progress")
    throw new Error("Failed to fetch team tier progress")
  }
}

export async function initializeTeamTierProgress(
  teamId: string,
  bingoId: string
) {
  try {
    // Check if this is a progression bingo
    const [bingo] = await db
      .select({ bingoType: bingos.bingoType })
      .from(bingos)
      .where(eq(bingos.id, bingoId))

    if (!bingo || bingo.bingoType !== "progression") {
      return { success: false, error: "Not a progression bingo" }
    }

    // Get all tiers for this bingo
    const tiersQuery = await db
      .select({ tier: tiles.tier })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
      .groupBy(tiles.tier)
      .orderBy(asc(tiles.tier))

    const uniqueTiers = tiersQuery.map((t) => t.tier)

    // Initialize tier progress for this team, unlocking only tier 0
    const tierProgressData = uniqueTiers.map((tier) => ({
      teamId,
      bingoId,
      tier,
      isUnlocked: tier === 0, // Only unlock tier 0 initially
      unlockedAt: tier === 0 ? new Date() : null,
    }))

    await db
      .insert(teamTierProgress)
      .values(tierProgressData)
      .onConflictDoNothing()

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error initializing team tier progress")
    return { success: false, error: "Failed to initialize team tier progress" }
  }
}

export async function checkAndUnlockNextTier(teamId: string, bingoId: string) {
  try {
    // Get tier-specific XP requirements for this bingo
    const tierXpReqs = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
    })

    // Get team's current tier progress
    const tierProgress = await db.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
      orderBy: asc(teamTierProgress.tier),
    })

    // Find the highest unlocked tier
    const highestUnlockedTier = Math.max(
      ...tierProgress.filter((tp) => tp.isUnlocked).map((tp) => tp.tier)
    )

    // Check if we can unlock the next tier
    const nextTier = highestUnlockedTier + 1
    const nextTierProgress = tierProgress.find((tp) => tp.tier === nextTier)

    if (!nextTierProgress || nextTierProgress.isUnlocked) {
      return { success: true, unlockedTier: null } // No next tier or already unlocked
    }

    // Count completed tiles in current highest tier
    const currentTierTiles = await db
      .select({
        id: tiles.id,
        weight: tiles.weight,
        teamTileSubmissions: {
          status: teamTileSubmissions.status,
        },
      })
      .from(tiles)
      .leftJoin(
        teamTileSubmissions,
        and(
          eq(teamTileSubmissions.tileId, tiles.id),
          eq(teamTileSubmissions.teamId, teamId)
        )
      )
      .where(
        and(eq(tiles.bingoId, bingoId), eq(tiles.tier, highestUnlockedTier))
      )

    const completedTilesXP = currentTierTiles
      .filter((tile) => tile.teamTileSubmissions?.status === "approved")
      .reduce((totalXP, tile) => totalXP + tile.weight, 0)

    // Get XP requirement for current tier to unlock next tier
    const tierXpReq = tierXpReqs.find((req) => req.tier === highestUnlockedTier)
    const xpRequired = tierXpReq?.xpRequired ?? 5 // Default to 5 if not found

    // Check if unlock requirement is met (XP-based)
    if (completedTilesXP >= xpRequired) {
      // Unlock the next tier
      await db
        .update(teamTierProgress)
        .set({
          isUnlocked: true,
          unlockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(teamTierProgress.teamId, teamId),
            eq(teamTierProgress.bingoId, bingoId),
            eq(teamTierProgress.tier, nextTier)
          )
        )

      return { success: true, unlockedTier: nextTier }
    }

    return { success: true, unlockedTier: null }
  } catch (error) {
    logger.error({ error }, "Error checking tier unlock")
    return { success: false, error: "Failed to check tier unlock" }
  }
}

export async function getProgressionBingoTiles(
  bingoId: string,
  teamId?: string
) {
  try {
    // Get bingo info
    const [bingo] = await db
      .select({ bingoType: bingos.bingoType })
      .from(bingos)
      .where(eq(bingos.id, bingoId))

    if (!bingo || bingo.bingoType !== "progression") {
      throw new Error("Not a progression bingo")
    }

    // Get all tiles
    const allTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingoId),
      with: {
        goals: true,
        teamTileSubmissions: teamId
          ? {
              where: eq(teamTileSubmissions.teamId, teamId),
            }
          : undefined,
      },
      orderBy: [asc(tiles.tier), asc(tiles.index)],
    })

    // If no team specified, return all tiles
    if (!teamId) {
      return allTiles
    }

    // Get team's tier progress
    const tierProgress = await getTeamTierProgress(teamId, bingoId)
    const unlockedTiers = new Set(
      tierProgress.filter((tp) => tp.isUnlocked).map((tp) => tp.tier)
    )

    // Filter tiles based on unlocked tiers
    const accessibleTiles = allTiles.filter((tile) =>
      unlockedTiers.has(tile.tier)
    )

    return accessibleTiles
  } catch (error) {
    logger.error({ error }, "Error fetching progression bingo tiles")
    throw new Error("Failed to fetch progression bingo tiles")
  }
}

export async function updateTileTier(tileId: string, newTier: number) {
  try {
    await db
      .update(tiles)
      .set({ tier: newTier, updatedAt: new Date() })
      .where(eq(tiles.id, tileId))

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating tile tier")
    return { success: false, error: "Failed to update tile tier" }
  }
}

export async function getTierXpRequirements(bingoId: string) {
  try {
    const requirements = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
      orderBy: asc(tierXpRequirements.tier),
    })
    return requirements
  } catch (error) {
    logger.error({ error }, "Error fetching tier XP requirements")
    throw new Error("Failed to fetch tier XP requirements")
  }
}

export async function setTierXpRequirement(
  bingoId: string,
  tier: number,
  xpRequired: number
) {
  try {
    // Try to update existing record
    const existingReq = await db.query.tierXpRequirements.findFirst({
      where: and(
        eq(tierXpRequirements.bingoId, bingoId),
        eq(tierXpRequirements.tier, tier)
      ),
    })

    if (existingReq) {
      await db
        .update(tierXpRequirements)
        .set({ xpRequired, updatedAt: new Date() })
        .where(eq(tierXpRequirements.id, existingReq.id))
    } else {
      await db.insert(tierXpRequirements).values({
        bingoId,
        tier,
        xpRequired,
      })
    }

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error setting tier XP requirement")
    return { success: false, error: "Failed to set tier XP requirement" }
  }
}

export async function initializeTierXpRequirements(
  bingoId: string,
  defaultXpRequired: number = 5
) {
  try {
    // Get all unique tiers for this bingo
    const tierResults = await db
      .selectDistinct({ tier: tiles.tier })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
      .orderBy(asc(tiles.tier))

    const tiers = tierResults.map((r) => r.tier)

    // Create tier XP requirements for each tier (except the last tier)
    // The last tier doesn't need a requirement since there's no next tier to unlock
    for (const tier of tiers.slice(0, -1)) {
      await setTierXpRequirement(bingoId, tier, defaultXpRequired)
    }

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error initializing tier XP requirements")
    return {
      success: false,
      error: "Failed to initialize tier XP requirements",
    }
  }
}

export async function createNewTier(bingoId: string) {
  try {
    return await db.transaction(async (tx) => {
      // Get the highest tier number for this bingo
      const maxTierResult = await tx
        .select({ maxTier: sql<number>`MAX(${tiles.tier})` })
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      const maxTier = maxTierResult[0]?.maxTier ?? -1
      const newTier = maxTier + 1

      // Get the next index for the new tile
      const maxIndexResult = await tx
        .select({ maxIndex: sql<number>`MAX(${tiles.index})` })
        .from(tiles)
        .where(eq(tiles.bingoId, bingoId))

      const maxIndex = maxIndexResult[0]?.maxIndex ?? -1
      const nextIndex = maxIndex + 1

      // Create a tile in the new tier to persist it
      const [createdTile] = await tx
        .insert(tiles)
        .values({
          bingoId,
          title: `New Tile`,
          headerImage: getRandomFrog(),
          description: "",
          weight: 1,
          index: nextIndex,
          isHidden: false,
          tier: newTier,
        })
        .returning()

      // Initialize XP requirement for the previous tier (if it doesn't exist)
      if (newTier > 0) {
        const existingReq = await tx
          .select()
          .from(tierXpRequirements)
          .where(
            and(
              eq(tierXpRequirements.bingoId, bingoId),
              eq(tierXpRequirements.tier, newTier - 1)
            )
          )

        if (existingReq.length === 0) {
          await tx.insert(tierXpRequirements).values({
            bingoId,
            tier: newTier - 1,
            xpRequired: 5,
          })
        }
      }

      return { success: true, newTier, createdTile }
    })
  } catch (error) {
    logger.error({ error }, "Error creating new tier")
    return { success: false, error: "Failed to create new tier" }
  }
}

export async function deleteTier(bingoId: string, tierToDelete: number) {
  try {
    return await db.transaction(async (tx) => {
      // First, delete all tiles in the specified tier
      const deletedTiles = await tx
        .delete(tiles)
        .where(and(eq(tiles.bingoId, bingoId), eq(tiles.tier, tierToDelete)))
        .returning({ id: tiles.id })

      // Delete any XP requirements for the deleted tier
      await tx
        .delete(tierXpRequirements)
        .where(
          and(
            eq(tierXpRequirements.bingoId, bingoId),
            eq(tierXpRequirements.tier, tierToDelete)
          )
        )

      // Shift all tiles in higher tiers down by one tier
      const updatedTiles = await tx
        .update(tiles)
        .set({
          tier: sql`${tiles.tier} - 1`,
        })
        .where(and(eq(tiles.bingoId, bingoId), gt(tiles.tier, tierToDelete)))
        .returning()

      // Shift all XP requirements for higher tiers down by one
      await tx
        .update(tierXpRequirements)
        .set({
          tier: sql`${tierXpRequirements.tier} - 1`,
        })
        .where(
          and(
            eq(tierXpRequirements.bingoId, bingoId),
            gt(tierXpRequirements.tier, tierToDelete)
          )
        )

      // Delete team tier progress for the deleted tier
      await tx
        .delete(teamTierProgress)
        .where(
          and(
            eq(teamTierProgress.bingoId, bingoId),
            eq(teamTierProgress.tier, tierToDelete)
          )
        )

      // Shift team tier progress for higher tiers down by one
      await tx
        .update(teamTierProgress)
        .set({
          tier: sql`${teamTierProgress.tier} - 1`,
        })
        .where(
          and(
            eq(teamTierProgress.bingoId, bingoId),
            gt(teamTierProgress.tier, tierToDelete)
          )
        )

      return {
        success: true,
        deletedTileIds: deletedTiles.map((t) => t.id),
        updatedTiles: updatedTiles,
      }
    })
  } catch (error) {
    logger.error({ error }, "Error deleting tier")
    return { success: false, error: "Failed to delete tier" }
  } finally {
    // Revalidate the page to refresh cached data
    revalidatePath("/events")
  }
}
