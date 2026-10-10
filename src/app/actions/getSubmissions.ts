"use server"
import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import { teamTileSubmissions, teams } from "@/server/db/schema"
import { eq, inArray } from "drizzle-orm"
import type { TeamTileSubmission } from "@/types/model"
import { isEventManager } from "@/server/authz"

export async function getEventSubmissions(
  eventId: string
): Promise<TeamTileSubmission[]> {
  // All Teams' Submissions (with images and users) are for managers only.
  if (!(await isEventManager(eventId))) return []

  try {
    // 1. Get all teams for the event
    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
      columns: { id: true },
    })

    const teamIds = eventTeams.map((t) => t.id)

    if (teamIds.length === 0) {
      return []
    }

    // 2. Fetch all TeamTileSubmissions with related data
    const eventSubmissions = await db.query.teamTileSubmissions.findMany({
      where: inArray(teamTileSubmissions.teamId, teamIds),
      with: {
        team: true,
        tile: {
          with: {
            bingo: {
              columns: {
                id: true,
                title: true,
              },
            },
            goals: {
              with: {
                itemGoal: true,
              }
            },
          },
        },
        submissions: {
          with: {
            image: true,
            user: { columns: { id: true, name: true, runescapeName: true } },
            goal: true,
          },
        },
      },
    })

    return eventSubmissions as unknown as TeamTileSubmission[]
  } catch (error) {
    logger.error({ error }, "Error fetching event submissions:", error)
    throw new Error("Failed to fetch event submissions")
  }
}
