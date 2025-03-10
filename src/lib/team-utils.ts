import { db } from "@/server/db"
import { teams, teamMembers } from "@/server/db/schema"
import { eq } from "drizzle-orm"

/**
 * Gets the team for a user in a specific event
 * @param userId The user ID
 * @param eventId The event ID
 * @returns The team object if found, null otherwise
 */
export async function getTeamForUserInEvent(userId: string, eventId: string) {
  try {
    const userTeam = await db.query.teams.findFirst({
      where: eq(teams.eventId, eventId),
      with: {
        teamMembers: {
          where: eq(teamMembers.userId, userId),
        },
      },
    })

    if (!userTeam || userTeam.teamMembers.length === 0) {
      return null
    }

    return {
      id: userTeam.id,
      name: userTeam.name,
      isLeader: userTeam.teamMembers[0]?.isLeader ?? false,
    }
  } catch (error) {
    console.error("Error getting team for user:", error)
    return null
  }
}

