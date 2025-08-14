import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, eventParticipants, teamTileSubmissions, submissions, images, teamMembers, discordWebhooks } from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import { createSubmissionEmbed, sendDiscordWebhook } from "@/lib/discord-webhook"
import { formatBingoData } from "@/lib/bingo-formatter"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// Submit an image for a specific tile
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

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
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

    // Create or update the submission in the database
    const result = await db.transaction(async (tx) => {
      // Get or create teamTileSubmission
      const [teamTileSubmission] = await tx
        .insert(teamTileSubmissions)
        .values({
          tileId,
          teamId: userTeam.id,
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

      // Insert the submission record
      const [insertedSubmission] = await tx
        .insert(submissions)
        .values({
          teamTileSubmissionId: teamTileSubmission!.id,
          submittedBy: userId,
          imageId: insertedImage!.id,
        })
        .returning({
          id: submissions.id,
          createdAt: submissions.createdAt,
        })

      return {
        submission: insertedSubmission,
        teamTileSubmission: teamTileSubmission,
      }
    })

    // Create a notification for admin and management users
    // This would typically be handled by your existing notification system

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

        const embedData = {
          userName: participant.user.name ?? "Unknown",
          runescapeName: participant.user.runescapeName,
          teamName: userTeam.name,
          tileName: tile.title,
          tileDescription: tile.description,
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

    return NextResponse.json(formattedBingo)
  } catch (error) {
    console.error("Error submitting image:", error)
    return NextResponse.json({ error: "Failed to submit image" }, { status: 500 })
  }
}
