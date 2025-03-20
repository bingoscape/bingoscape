import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { teams, eventParticipants, events, teamTileSubmissions, tiles, teamMembers, bingos } from "@/server/db/schema"
import { eq, asc } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"

// Get all events for the authenticated user
export async function GET(req: Request) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  try {
    // Get all events where the user is a participant or creator
    const userEvents = await db.query.events.findMany({
      where: (events, { or, eq, exists, and }) =>
        or(
          eq(events.creatorId, userId),
          exists(
            db
              .select()
              .from(eventParticipants)
              .where(and(eq(eventParticipants.eventId, events.id), eq(eventParticipants.userId, userId))),
          ),
        ),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: {
          where: eq(bingos.visible, true),
          with: {
            tiles: {
              orderBy: [asc(tiles.index)],
              with: {
                teamTileSubmissions: true,
                goals: {
                  with: {
                    teamProgress: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: events.createdAt,
    })

    // Get the user's team for each event
    const eventsWithTeams = await Promise.all(
      userEvents.map(async (eventData) => {
        // Find the user's team in this event
        const userTeam = await db.query.teams.findFirst({
          where: (teams, { exists, and, eq }) =>
            and(
              eq(teams.eventId, eventData.id),
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

        // Get all team tile submissions for this team
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

        // Process each bingo and its tiles
        eventData.bingos.forEach((bingo) => {
          bingo.tiles.forEach((tile) => {
            // Find submission for this tile
            const submission = teamSubmissions.find((sub) => sub.tileId === tile.id)

            tileSubmissionMap[tile.id] = {
              id: tile.id,
              status: submission ? submission.status : "not_submitted",
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
        })

        // Process goal progress for this team
        const goalProgressMap: Record<
          string,
          {
            id: string
            currentValue: number
            targetValue: number
            description: string
            progress: number // percentage
          }
        > = {}

        eventData.bingos.forEach((bingo) => {
          bingo.tiles.forEach((tile) => {
            if (tile.goals && tile.goals.length > 0) {
              tile.goals.forEach((goal) => {
                const teamProgress = goal.teamProgress.find((tp) => userTeam && tp.teamId === userTeam.id)
                const currentValue = teamProgress?.currentValue ?? 0
                const progress =
                  goal.targetValue > 0 ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100)) : 0

                goalProgressMap[goal.id] = {
                  id: goal.id,
                  currentValue,
                  targetValue: goal.targetValue,
                  description: goal.description,
                  progress,
                }
              })
            }
          })
        })

        return {
          id: eventData.id,
          title: eventData.title,
          description: eventData.description,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          createdAt: eventData.createdAt,
          updatedAt: eventData.updatedAt,
          locked: eventData.locked,
          public: eventData.public,
          basePrizePool: eventData.basePrizePool,
          minimumBuyIn: eventData.minimumBuyIn,
          clan: eventData.clan,
          role: eventData.creatorId === userId ? "admin" : (eventData.eventParticipants[0]?.role ?? "participant"),
          userTeam: !!userTeam ? {
            name: userTeam.name,
            members: userTeam.teamMembers.map((member) => ({
              isLeader: member.isLeader,
              runescapeName: member.user.runescapeName,
            }))
          } : null,
          bingos: eventData.bingos.map((bingo) => ({
            id: bingo.id,
            title: bingo.title,
            description: bingo.description,
            rows: bingo.rows,
            columns: bingo.columns,
            codephrase: bingo.codephrase,
            locked: bingo.locked,
            visible: bingo.visible,
            tiles: bingo.tiles.map((tile) => ({
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
                  progress: goalProgressMap[goal.id] ?? null,
                })) ?? [],
            })),
          })),
        }
      }),
    )

    return NextResponse.json(eventsWithTeams.filter((event) => event.bingos.length > 0))
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

