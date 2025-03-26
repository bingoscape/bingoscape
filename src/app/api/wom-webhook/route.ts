import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { users, tiles, teamTileSubmissions, teamMembers } from "@/server/db/schema"
import { eq, sql } from "drizzle-orm"
import { createNotification } from "@/app/actions/notifications"
import { revalidatePath } from "next/cache"
import type { WomVerificationConfig } from "@/types/wom-types"

// This endpoint handles webhooks from Wise Old Man
// It can be used to automatically verify tiles when player stats are updated
export async function POST(req: Request) {
  try {
    // Verify webhook signature if WOM provides one
    // const signature = req.headers.get('x-wom-signature')
    // if (!verifySignature(signature, await req.text())) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const body = await req.json()

    // Handle different webhook types
    switch (body.type) {
      case "player.updated":
        await handlePlayerUpdated(body.data)
        break
      case "competition.created":
        await handleCompetitionCreated(body.data)
        break
      case "competition.ended":
        await handleCompetitionEnded(body.data)
        break
      default:
        return NextResponse.json({ error: "Unsupported webhook type" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing WOM webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function handlePlayerUpdated(data: any) {
  const { username, snapshot } = data
  if (!username || !snapshot) return

  // Find user with this RuneScape name
  const user = await db.query.users.findFirst({
    where: eq(users.runescapeName, username),
  })

  if (!user) return

  // Find all tiles with auto-verification enabled
  const tilesWithVerification = await db
    .select({
      id: tiles.id,
      bingoId: tiles.bingoId,
      title: tiles.title,
      womVerificationConfig: tiles.womVerificationConfig,
    })
    .from(tiles)
    .where(
      // Only select tiles where womVerificationConfig is not null and enabled is true
      // This is a simplified query - in a real implementation, you'd need to parse the JSON
      sql`${tiles.womVerificationConfig}->>'enabled' = 'true'`,
    )
    .execute()

  // Process each tile for auto-verification
  for (const tile of tilesWithVerification) {
    const config = tile.womVerificationConfig as WomVerificationConfig

    // Check if the player meets the verification criteria
    const isVerified = checkVerificationCriteria(snapshot, config)

    if (isVerified) {
      // Find teams the user is part of
      const userTeams = await db.query.teamMembers.findMany({
        where: eq(teamMembers.userId, user.id),
        with: {
          team: true,
        },
      })

      // Auto-verify the tile for each team
      for (const teamMember of userTeams) {
        // Update or create team tile submission
        await db
          .insert(teamTileSubmissions)
          .values({
            tileId: tile.id,
            teamId: teamMember.teamId,
            status: "accepted",
            reviewedBy: null, // System verified
          })
          .onConflictDoUpdate({
            target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
            set: {
              status: "accepted",
              updatedAt: new Date(),
            },
          })

        // Create notification
        await createNotification(
          teamMember.team.eventId,
          tile.id,
          teamMember.teamId,
          `Tile "${tile.title}" was automatically verified for ${username} using Wise Old Man data`,
        )
      }

      // Revalidate relevant paths
      revalidatePath(`/events/[id]/bingos/${tile.bingoId}`)
    }
  }
}

async function handleCompetitionCreated(data: any) {
  // Handle competition created event
  // This could be used to notify users about new competitions
}

async function handleCompetitionEnded(data: any) {
  // Handle competition ended event
  // This could be used to update leaderboards or award prizes
}

function checkVerificationCriteria(snapshot: any, config: WomVerificationConfig): boolean {
  // Similar to the function in wom-integration.ts
  // Extract the relevant value from the snapshot based on config
  // and compare it with the threshold

  const { type, metric, threshold, comparison, measureType } = config
  let actualValue: number | undefined

  // Get the actual value based on the metric type
  if (type === "skill" && snapshot.data?.skills) {
    const skillData = snapshot.data.skills[metric]
    if (skillData) {
      actualValue = measureType === "level" ? skillData.level : skillData.experience
    }
  } else if (type === "boss" && snapshot.data?.bosses) {
    const bossData = snapshot.data.bosses[metric]
    if (bossData) {
      actualValue = bossData.kills
    }
  } else if (type === "activity" && snapshot.data?.activities) {
    const activityData = snapshot.data.activities[metric]
    if (activityData) {
      actualValue = activityData.score
    }
  }

  // If we couldn't find the value, verification fails
  if (actualValue === undefined) {
    return false
  }

  // Compare the actual value with the threshold
  switch (comparison) {
    case "greater_than":
      return actualValue > threshold
    case "greater_than_equal":
      return actualValue >= threshold
    case "equal":
      return actualValue === threshold
    case "less_than":
      return actualValue < threshold
    case "less_than_equal":
      return actualValue <= threshold
    default:
      return false
  }
}

