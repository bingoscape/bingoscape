import { type NextRequest, NextResponse } from "next/server"
import { validateApiKey } from "@/lib/api-auth"
import { db } from "@/server/db"
import { bingos, teamMembers, teamTileSubmissions, tiles } from "@/server/db/schema"
import { asc, eq } from "drizzle-orm"
import { mapStatus } from "@/lib/statusMapping"
import { getProgressionBingoTiles, getTeamTierProgress, getTierXpRequirements } from "@/app/actions/bingo"

export async function GET(request: NextRequest, { params }: { params: { bingoId: string } }) {
  try {
    // Validate API key
    const userId = await validateApiKey(request)
    if (!userId) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const bingoId = params.bingoId

    console.log("bingoId", bingoId)
    // Get the bingo data
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })

    if (!bingo) {
      return NextResponse.json({ error: "Bingo not found" }, { status: 404 })
    }

    const userTeam = await db.query.teams.findFirst({
      where: (teams, { exists, and, eq }) =>
        and(
          eq(teams.eventId, bingo.eventId),
          exists(
            db
              .select()
              .from(teamMembers)
              .where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId)))
          )
        ),
      with: {
        teamMembers: {
          with: {
            user: {
              columns: {
                runescapeName: true,
              }
            }
          }
        },
      },
    })

    // Get tiles based on bingo type - for progressive bingos, filter by unlocked tiers
    let bingoTiles
    let tierXpRequirements = null
    let tierProgress = null

    if (bingo.bingoType === "progression" && userTeam) {
      // For progression bingo, get only unlocked tiles for the user's team
      bingoTiles = await getProgressionBingoTiles(bingoId, userTeam.id)
      tierXpRequirements = await getTierXpRequirements(bingoId)
      tierProgress = await getTeamTierProgress(userTeam.id, bingoId)
    } else if (bingo.bingoType === "progression" && !userTeam) {
      // No team found - return empty tiles for progression bingo
      bingoTiles = []
    } else {
      // Standard bingo - get all tiles
      bingoTiles = await db.query.tiles.findMany({
        where: eq(tiles.bingoId, bingoId),
        orderBy: [asc(tiles.index)],
        with: {
          teamTileSubmissions: {
            with: {
              team: true,
              submissions: {
                with: {
                  image: true,
                }
              },
            }
          },
          goals: {
            with: {
              teamProgress: true,
            },
          },
        },
      })
    }

    // Create a map of tile IDs to submission data
    const tileSubmissionMap: Record<
      string,
      {
        id: string
        status: "pending" | "accepted" | "requires_interaction" | "not_submitted"
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

    bingoTiles.forEach((tile) => {

      const submission = teamSubmissions.find((sub) => sub.tileId === tile.id)
      tileSubmissionMap[tile.id] = {
        id: tile.id,
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
      id: bingo.id,
      title: bingo.title,
      description: bingo.description,
      rows: bingo.rows,
      columns: bingo.columns,
      codephrase: bingo.codephrase,
      locked: bingo.locked,
      visible: bingo.visible,
      bingoType: bingo.bingoType, // Include bingo type for progressive support
      tiles: bingoTiles.map((tile) => ({
        id: tile.id,
        title: tile.title,
        description: tile.description,
        headerImage: tile.headerImage,
        weight: tile.weight,
        index: tile.index,
        tier: tile.tier, // Include tier information for progressive bingos
        isHidden: tile.isHidden,
        submission: tileSubmissionMap[tile.id],
        goals:
          tile.goals?.map((goal) => ({
            id: goal.id,
            description: goal.description,
            targetValue: goal.targetValue,
            // progress: goalProgressMap[goal.id] || null,
          })) ?? [],
      })),
      // Include progression bingo metadata when applicable
      ...(bingo.bingoType === "progression" && userTeam && {
        progression: {
          tierXpRequirements: tierXpRequirements?.map(req => ({
            tier: req.tier,
            xpRequired: req.xpRequired,
          })) ?? [],
          unlockedTiers: tierProgress?.filter(tp => tp.isUnlocked).map(tp => tp.tier) ?? [],
          tierProgress: tierProgress?.map(tp => ({
            tier: tp.tier,
            isUnlocked: tp.isUnlocked,
            unlockedAt: tp.unlockedAt,
          })) ?? [],
        }
      })
    }


    return NextResponse.json(formattedBingo)
  } catch (error) {
    console.error("Error fetching bingo data:", error)
    return NextResponse.json({ error: "An error occurred while fetching bingo data" }, { status: 500 })
  }
}
