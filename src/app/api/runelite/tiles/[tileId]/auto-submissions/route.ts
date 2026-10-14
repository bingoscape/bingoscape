import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  tiles,
  users,
  teamTileSubmissions,
  submissions,
  images,
  teamMembers,
  discordWebhooks,
  teamGoalProgress,
} from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import {
  assertCanSubmit,
  SubmissionRejectedError,
} from "@/lib/submission-guard"
import { limitRequest } from "@/server/rate-limit"
import { can } from "@/lib/authz/policy"
import { getApiActor } from "@/server/authz/api"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import {
  createSubmissionEmbed,
  sendDiscordWebhook,
} from "@/lib/discord-webhook"
import { formatBingoData } from "@/lib/bingo-formatter"
import { isBlindBoard } from "@/server/blind-board"
import { hasEventStarted } from "@/lib/event-status"
import { battleshipShot } from "@/lib/battleship-marks"
import { getBattleshipBoardStateForTeam } from "@/server/battleship"
import { getTierLockForSubmit, tierLockedBody } from "@/server/tier-progression"
import { checkAndAutoCompleteTile } from "@/server/tile-completion"

// Type definition for auto-submission metadata
interface AutoSubmissionMetadata {
  npcId?: number
  sourceName?: string
  itemId?: number
  quantity?: number
  accountName?: string
  sourceType?: string
  worldX?: number
  worldY?: number
  plane?: number
  worldNumber?: number
  regionId?: number
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Auto-submission endpoint - accepts metadata and automatically assigns goals
export async function POST(
  req: Request,
  props: { params: Promise<{ tileId: string }> }
) {
  const params = await props.params
  // Validate API key from Authorization header
  const userId = await validateApiKey(req, "submit")
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }
  const limited = await limitRequest("upload", req, userId)
  if (limited) return limited

  const { tileId } = params

  try {
    // Parse the multipart form data
    const formData = await req.formData()
    const image = formData.get("image") as File
    const metadataJson = formData.get("metadata") as string

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Parse metadata (optional)
    let metadata: AutoSubmissionMetadata = {}

    if (metadataJson) {
      try {
        const parsed = JSON.parse(metadataJson) as unknown
        // Validate that parsed data matches expected structure
        if (typeof parsed === "object" && parsed !== null) {
          metadata = parsed as AutoSubmissionMetadata
        } else {
          return NextResponse.json(
            { error: "Invalid metadata format" },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid metadata JSON" },
          { status: 400 }
        )
      }
    }

    // Get the tile to check bingo and event access
    const tile = await db.query.tiles.findFirst({
      where: eq(tiles.id, tileId),
      with: {
        bingo: {
          with: {
            event: true,
          },
        },
        teamTileSubmissions: true,
        goals: {
          with: {
            itemGoal: true,
          },
        },
      },
    })

    if (!tile) {
      return NextResponse.json({ error: "Tile not found" }, { status: 404 })
    }

    // The caller must take part in the Event (the same actor loader as the
    // web app: the creator counts as admin).
    const apiActor = await getApiActor(userId, tile.bingo.eventId)
    if (apiActor.status !== "ok" || apiActor.actor.role === null) {
      return NextResponse.json(
        { error: "Not a participant in this event" },
        { status: 403 }
      )
    }
    const participant = {
      user: await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, name: true, runescapeName: true },
      }),
    }

    // The Tiles of a battleship board are blind until its Event starts: they
    // look like missing Tiles to everybody but the Event's managers.
    const callerIsManager = can(apiActor.actor, "board:view-secret")
    if (
      isBlindBoard({
        bingoType: tile.bingo.bingoType,
        startDate: tile.bingo.event.startDate,
        isManager: callerIsManager,
      })
    ) {
      return NextResponse.json(
        { error: "Tile not found", code: "BOARD_BLIND" },
        { status: 404 }
      )
    }

    // Nobody shoots before the start, not even a manager the blind check lets
    // through: an early hit or miss would show where the opponent's ships are.
    if (
      tile.bingo.bingoType === "battleship" &&
      !hasEventStarted(tile.bingo.event.startDate)
    ) {
      return NextResponse.json(
        {
          error:
            "This battleship board can only be played once the event has started",
          code: "EVENT_NOT_STARTED",
        },
        { status: 403 }
      )
    }

    // Get user's team for this event
    const userTeam = await db.query.teams.findFirst({
      where: (teams, { exists, and, eq }) =>
        and(
          eq(teams.eventId, tile.bingo.eventId),
          exists(
            db
              .select()
              .from(teamMembers)
              .where(
                and(
                  eq(teamMembers.teamId, teams.id),
                  eq(teamMembers.userId, userId)
                )
              )
          )
        ),
      with: {
        teamMembers: {
          with: {
            user: {
              columns: {
                runescapeName: true,
              },
            },
          },
        },
      },
    })

    if (!userTeam) {
      return NextResponse.json(
        { error: "You are not assigned to a team in this event" },
        { status: 403 }
      )
    }

    // Locked Board, file type and size: the gate shared with the manual
    // submit action (src/lib/submission-guard.ts).
    try {
      assertCanSubmit({ board: tile.bingo, file: image })
    } catch (error) {
      if (error instanceof SubmissionRejectedError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      }
      throw error
    }

    const tierLock = await getTierLockForSubmit(
      db,
      tile,
      tile.bingo.bingoType,
      userTeam.id
    )
    if (tierLock) {
      return NextResponse.json(tierLockedBody(tierLock), { status: 403 })
    }

    const teamSubmissionForTile = tile.teamTileSubmissions.find(
      (submission) => submission.teamId === userTeam.id
    )
    if (
      !!teamSubmissionForTile &&
      teamSubmissionForTile.status === "completed"
    ) {
      return NextResponse.json(
        { error: "Your submission has already been approved!" },
        { status: 423 }
      )
    }

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

    // Try to match the item to a goal
    let matchedGoalId: string | null = null
    let shouldAutoApprove = false

    if (metadata.itemId && tile.goals && tile.goals.length > 0) {
      // Find goals that match the item
      const matchingGoal = tile.goals.find((goal) => {
        if (goal.itemGoal && goal.itemGoal.itemId === metadata.itemId) {
          return true
        }
        return false
      })

      if (matchingGoal) {
        matchedGoalId = matchingGoal.id
        // Auto-approve if we have a clear item match
        shouldAutoApprove = true
      }
    }

    // Determine submission status
    // Individual submission can be auto-approved when item matches
    const submissionStatus = shouldAutoApprove ? "approved" : "pending"

    // CRITICAL: Tile always starts pending - let goal tree validation decide approval
    // Only checkAndAutoCompleteTile() should change tile status to "approved"
    const teamTileStatus = "incomplete"

    // Create or update the submission in the database
    const result = await db.transaction(async (tx) => {
      // Get or create teamTileSubmission
      const [teamTileSubmission] = await tx
        .insert(teamTileSubmissions)
        .values({
          tileId,
          teamId: userTeam.id,
          status: teamTileStatus,
        })
        .onConflictDoUpdate({
          target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
          set: {
            updatedAt: new Date(),
            // CRITICAL: Do NOT update status on conflict
            // Preserve existing approval state (don't reset approved tiles to pending)
            // Only checkAndAutoCompleteTile() should change status
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

      // Insert the submission record with auto-submission metadata
      const [insertedSubmission] = await tx
        .insert(submissions)
        .values({
          teamTileSubmissionId: teamTileSubmission!.id,
          submittedBy: userId,
          imageId: insertedImage!.id,
          goalId: matchedGoalId,
          status: submissionStatus,
          isAutoSubmission: true,
          sourceNpcId: metadata.npcId ?? null,
          sourceName: metadata.sourceName ?? null,
          sourceItemId: metadata.itemId ?? null,
          pluginAccountName: metadata.accountName ?? null,
          sourceType: metadata.sourceType ?? null,
          locationWorldX: metadata.worldX ?? null,
          locationWorldY: metadata.worldY ?? null,
          locationPlane: metadata.plane ?? null,
          locationWorldNumber: metadata.worldNumber ?? null,
          locationRegionId: metadata.regionId ?? null,
          reviewedAt: shouldAutoApprove ? new Date() : null,
          submissionValue:
            metadata.quantity && metadata.quantity > 0
              ? metadata.quantity
              : 1.0,
        })
        .returning({
          id: submissions.id,
          createdAt: submissions.createdAt,
        })

      // If submission has a goal and is auto-approved, update goal progress
      if (matchedGoalId && shouldAutoApprove) {
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
              eq(submissions.goalId, matchedGoalId),
              eq(submissions.status, "approved"),
              eq(teamTileSubmissions.teamId, userTeam.id)
            )
          )

        const totalValue = approvedSubmissions.reduce(
          (sum, s) => sum + (s.submissionValue || 0),
          0
        )

        // Get current goal progress for this team
        const currentProgress = await tx.query.teamGoalProgress.findFirst({
          where: and(
            eq(teamGoalProgress.goalId, matchedGoalId),
            eq(teamGoalProgress.teamId, userTeam.id)
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
            goalId: matchedGoalId,
            teamId: userTeam.id,
            currentValue: totalValue,
          })
        }
      }

      return {
        submission: insertedSubmission,
        teamTileSubmission: teamTileSubmission,
        autoApproved: shouldAutoApprove,
      }
    })

    // ALWAYS check tile completion after updating goal progress
    // This evaluates the complete goal tree and updates tile status to "approved"
    // ONLY if all root-level goals/groups are complete
    let tierUnlocked: number | null = null
    const isBattleship = tile.bingo.bingoType === "battleship"
    const marksBefore =
      isBattleship && matchedGoalId
        ? await getBattleshipBoardStateForTeam(tile.bingoId, userTeam.id)
        : null
    if (matchedGoalId) {
      try {
        const completionResult = await checkAndAutoCompleteTile(
          db,
          tileId,
          userTeam.id
        )
        tierUnlocked = completionResult.tierUnlocked ?? null
        logger.info(
          { tileId, autoCompleted: completionResult.autoCompleted },
          "Tile completion check"
        )
      } catch (error) {
        logger.error({ error }, "Error checking tile auto-completion")
        // Don't fail the submission if auto-completion check fails
      }
    }

    // Send Discord webhook notifications
    try {
      // Get active Discord webhooks for this event
      const activeWebhooks = await db.query.discordWebhooks.findMany({
        where: and(
          eq(discordWebhooks.eventId, tile.bingo.eventId),
          eq(discordWebhooks.isActive, true)
        ),
      })

      if (activeWebhooks.length > 0 && participant) {
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
              eq(teamTileSubmissions.teamId, userTeam.id)
            )
          )

        const count = submissionCount[0]?.count ?? 1

        // Generate team color
        const teamColor = `hsl(${(userTeam.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`

        // Build submission description with metadata
        let submissionDescription = tile.description
        if (metadata.sourceName) {
          submissionDescription += `\n**Source:** ${metadata.sourceName}`
          if (metadata.npcId) {
            submissionDescription += ` (NPC ID: ${metadata.npcId})`
          }
        }
        if (metadata.accountName) {
          submissionDescription += `\n**Account:** ${metadata.accountName}`
        }
        if (result.autoApproved) {
          submissionDescription += `\n**Status:** Auto-approved`
        }

        const embedData = {
          userName: participant.user?.name ?? "Unknown",
          runescapeName: participant.user?.runescapeName ?? null,
          teamName: userTeam.name,
          tileName: tile.title,
          tileDescription: submissionDescription,
          eventTitle: tile.bingo.event.title,
          bingoTitle: tile.bingo.title,
          submissionCount: count,
          teamColor,
        }

        const embed = createSubmissionEmbed(embedData)

        // Prepare the image file for Discord attachment
        const imageExtension = image.name.split(".").pop() ?? "png"
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

    // Format the response using shared utility
    const formattedBingo = await formatBingoData(tile.bingo, userTeam ?? null, {
      userId,
    })

    // The shot is what the completion above did to the Team's marks. The
    // response's own marks were read after it, so they are the "after".
    const shot =
      marksBefore && formattedBingo.battleship
        ? battleshipShot(tileId, marksBefore, formattedBingo.battleship.marks)
        : null

    return NextResponse.json({
      ...formattedBingo,
      autoApproved: result.autoApproved,
      matchedGoalId: matchedGoalId,
      tierUnlocked,
      shot,
    })
  } catch (error) {
    logger.error({ error }, "Error submitting auto-submission")
    return NextResponse.json(
      { error: "Failed to submit image" },
      { status: 500 }
    )
  }
}
