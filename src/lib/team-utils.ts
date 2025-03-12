import { db } from "@/server/db"
import { teams, teamMembers } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

/**
 * Gets the team for a user in a specific event
 * @param userId The user ID
 * @param eventId The event ID
 * @returns The team object if found, null otherwise
 */
export async function getTeamForUserInEvent(userId: string, eventId: string) {
  try {
    // Use select syntax with a join between teams and teamMembers
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        isLeader: teamMembers.isLeader,
      })
      .from(teams)
      .innerJoin(teamMembers, and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId)))
      .where(eq(teams.eventId, eventId))
      .limit(1)


    console.log(result);

    // If no results found, return null
    if (result.length === 0) {
      return null
    }

    // Return the first (and only) result
    return result[0]
  } catch (error) {
    console.error("Error getting team for user:", error)
    return null
  }
}

