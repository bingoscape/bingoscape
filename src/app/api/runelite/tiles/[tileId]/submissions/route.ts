import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, eventParticipants, teamTileSubmissions, submissions, images, teamMembers } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { nanoid } from "nanoid"
import fs from "fs/promises"
import path from "path"
import { mapStatus } from "@/lib/statusMapping"

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
            tiles: {
              with: {
                goals: true,
              },
            },
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

    // Create a map of tile IDs to submission data
    const tileSubmissionMap: Record<
      string,
      {
        id: string
        status: "pending" | "accepted" | "requires_interaction" | "declined" | "not_submitted"
        lastUpdated: Date | null
        submissionCount: number
        latestSubmission?: {
          id: string
          imageUrl: string
          submittedBy: {
            id: string
            name: string | null
            runescapeName: string | null
          }
          createdAt: Date
        }
      }
    > = {}

    const teamSubmissions = userTeam
      ? await db.query.teamTileSubmissions.findMany({
        where: eq(teamTileSubmissions.teamId, userTeam.id),
        with: {
          submissions: {
            with: {
              image: true,
              user: {
                columns: {
                  id: true,
                  name: true,
                  runescapeName: true,
                },
              },
            },
          },
        },
      })
      : []

    tile.bingo.tiles.forEach((t) => {
      const submission = teamSubmissions.find((sub) => sub.tileId === t.id)
      tileSubmissionMap[t.id] = {
        id: t.id,
        status: submission ? mapStatus(submission.status) : "not_submitted",
        lastUpdated: submission ? submission.updatedAt : null,
        submissionCount: submission?.submissions.length ?? 0,
        ...(submission?.submissions.length
          ? {
            latestSubmission: {
              id: submission.submissions[submission.submissions.length - 1]!.id,
              imageUrl: submission.submissions[submission.submissions.length - 1]!.image.path,
              submittedBy: {
                id: submission.submissions[submission.submissions.length - 1]!.user.id,
                name: submission.submissions[submission.submissions.length - 1]!.user.name,
                runescapeName: submission.submissions[submission.submissions.length - 1]!.user.runescapeName,
              },
              createdAt: submission.submissions[submission.submissions.length - 1]!.createdAt,
            },
          }
          : {}),
      }
    })

    // Get the event data to include event context
    // const eventData = await getEventById(bingo.eventId)

    // Format the response
    const formattedBingo = {
      id: tile.bingo.id,
      title: tile.bingo.title,
      description: tile.bingo.description,
      rows: tile.bingo.rows,
      columns: tile.bingo.columns,
      codephrase: tile.bingo.codephrase,
      locked: tile.bingo.locked,
      visible: tile.bingo.visible,
      tiles: tile.bingo.tiles.map((tile) => ({
        id: tile.id,
        title: tile.title,
        description: tile.description,
        headerImage: tile.headerImage,
        weight: tile.weight,
        index: tile.index,
        isHidden: tile.isHidden,
        submission: tileSubmissionMap[tile.id],
        goals:
          tile.goals?.map((goal) => ({
            id: goal.id,
            description: goal.description,
            targetValue: goal.targetValue,
          })) ?? [],
      })),
    }

    return NextResponse.json(formattedBingo)
  } catch (error) {
    console.error("Error submitting image:", error)
    return NextResponse.json({ error: "Failed to submit image" }, { status: 500 })
  }
}
