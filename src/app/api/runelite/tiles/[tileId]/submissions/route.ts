import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, eventParticipants, teamTileSubmissions, submissions, images } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import { getTeamForUserInEvent } from "@/lib/team-utils"

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
        bingo: true,
      },
    })

    if (!tile) {
      return NextResponse.json({ error: "Tile not found" }, { status: 404 })
    }

    // Check if user is a participant in this event
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, tile.bingo.eventId), eq(eventParticipants.userId, userId)),
    })

    if (!participant) {
      return NextResponse.json({ error: "Not a participant in this event" }, { status: 403 })
    }

    // Get user's team for this event
    const userTeam = await getTeamForUserInEvent(userId, tile.bingo.eventId)

    if (!userTeam) {
      return NextResponse.json({ error: "You are not assigned to a team in this event" }, { status: 403 })
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
          createdAt: submissions.createdAt
        })

      return {
        submission: insertedSubmission,
        teamTileSubmission: teamTileSubmission,
      }
    })

    // Create a notification for admin and management users
    // This would typically be handled by your existing notification system

    return NextResponse.json({
      success: true,
      teamId: userTeam.id,
      teamName: userTeam.name,
      status: "pending",
      submission: result.submission,
    })
  } catch (error) {
    console.error("Error submitting image:", error)
    return NextResponse.json({ error: "Failed to submit image" }, { status: 500 })
  }
}

