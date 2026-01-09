import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, eventParticipants, teamTileSubmissions, submissions, images, teamMembers, discordWebhooks, goals, teamGoalProgress } from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import { createSubmissionEmbed, sendDiscordWebhook } from "@/lib/discord-webhook"
import { formatBingoData } from "@/lib/bingo-formatter"
import { checkAndAutoCompleteTile } from "@/app/actions/tile-completion"

// Type definition for auto-submission metadata
interface AutoSubmissionMetadata {
  npcId?: number
  sourceName?: string
  itemId?: number
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
export async function POST(req: Request, { params }: { params: { tileId: string } }) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

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
        if (typeof parsed === 'object' && parsed !== null) {
          metadata = parsed as AutoSubmissionMetadata
        } else {
          return NextResponse.json({ error: "Invalid metadata format" }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 })
      }
    }

    // Get the tile to check bingo and event access
    const tile = await db.query.tiles.findFirst({
      where: eq(tiles.id, tileId),
      with: {
        bingo: {
          with: {
            event: true
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

    // Check if user is a participant in this event
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, tile.bingo.eventId), eq(eventParticipants.userId, userId)),
      with: {
        user: true
      }
    })

    if (!participant) {
      return NextResponse.json({ error: "Not a participant in this event" }, { status: 403 })
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
              .where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId))),
          ),
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
      return NextResponse.json({ error: "You are not assigned to a team in this event" }, { status: 403 })
    }

    if (tile.bingo.locked) {
      return NextResponse.json({ error: "This bingo is locked. No submission possible" }, { status: 403 })
    }

    const teamSubmissionForTile = tile.teamTileSubmissions.find((submission) => submission.teamId === userTeam.id)
    if (!!teamSubmissionForTile && teamSubmissionForTile.status === "approved") {
      return NextResponse.json({ error: "Your submission has already been approved!" }, { status: 423 })
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
    const teamTileStatus = "pending"

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
          submissionValue: 1.0, // Default value for auto-submissions
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
          .innerJoin(teamTileSubmissions, eq(submissions.teamTileSubmissionId, teamTileSubmissions.id))
          .where(
            and(
              eq(submissions.goalId, matchedGoalId),
              eq(submissions.status, "approved"),
              eq(teamTileSubmissions.teamId, userTeam.id)
            )
          )

        const totalValue = approvedSubmissions.reduce((sum, s) => sum + (s.submissionValue || 0), 0)

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
    if (matchedGoalId) {
      try {
        const completionResult = await checkAndAutoCompleteTile(tileId, userTeam.id)
        console.log(`Tile ${tileId} completion check: ${completionResult.autoCompleted ? 'Complete' : 'Incomplete'}`)
      } catch (error) {
        console.error("Error checking tile auto-completion:", error)
        // Don't fail the submission if auto-completion check fails
      }
    }

    // Send Discord webhook notifications
    try {
      // Get active Discord webhooks for this event
      const activeWebhooks = await db.query.discordWebhooks.findMany({
        where: and(eq(discordWebhooks.eventId, tile.bingo.eventId), eq(discordWebhooks.isActive, true)),
      })

      if (activeWebhooks.length > 0 && participant) {
        // Get submission count for this team/tile combination
        const submissionCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(submissions)
          .innerJoin(teamTileSubmissions, eq(submissions.teamTileSubmissionId, teamTileSubmissions.id))
          .where(and(eq(teamTileSubmissions.tileId, tileId), eq(teamTileSubmissions.teamId, userTeam.id)))

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
          userName: participant.user.name ?? "Unknown",
          runescapeName: participant.user.runescapeName,
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
          }),
        )

        await Promise.allSettled(webhookPromises)
      }
    } catch (discordError) {
      // Log Discord errors but don't fail the submission
      console.error("Discord webhook error:", discordError)
    }

    // Format the response using shared utility
    const formattedBingo = await formatBingoData(tile.bingo, userTeam ?? null)

    return NextResponse.json({
      ...formattedBingo,
      autoApproved: result.autoApproved,
      matchedGoalId: matchedGoalId,
    })
  } catch (error) {
    console.error("Error submitting auto-submission:", error)
    return NextResponse.json({ error: "Failed to submit image" }, { status: 500 })
  }
}
