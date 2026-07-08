"use server"
import { getServerAuthSession } from "@/server/auth"
import { logger } from "@/lib/logger";
import { db } from "@/server/db"
import { teams, teamMembers, eventParticipants, users, playerMetadata } from "@/server/db/schema"
import { eq, and, not, exists } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getUserRole } from "./events"

export async function createTeam(eventId: string, name: string) {
  try {
    const role = await getUserRole(eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }
    const [team] = await db.insert(teams).values({ eventId, name }).returning()
    revalidatePath(`/events/${eventId}`)
    
    if (team) {
      logger.info({
        eventId,
        teamId: team.id,
        teamName: name,
        action: "createTeam"
      }, "Team created successfully")
    }
    
    return { success: true, data: team }
  } catch (error) {
    logger.error({ error }, "Error creating team", error)
    return { success: false, error: "Failed to create team" }
  }
}

export async function getTeamsByEventId(eventId: string) {
  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: true,
        },
      },
    },
  })

  // Fetch metadata status for all team members
  const metadataRecords = await db.query.playerMetadata.findMany({
    where: and(
      eq(playerMetadata.eventId, eventId)
    ),
  })

  const metadataMap = new Map(metadataRecords.map(m => [m.userId, m]))

  // Add hasMetadata flag to team members
  const teamsWithMetadata = eventTeams.map(team => ({
    ...team,
    teamMembers: team.teamMembers.map(member => {
      const metadata = metadataMap.get(member.user.id)
      return {
        ...member,
        user: {
          ...member.user,
          hasMetadata: !!metadata,
          skillLevel: metadata?.skillLevel ?? null,
        },
      }
    }),
  }))

  return teamsWithMetadata
}

export async function addUserToTeam(teamId: string, userId: string) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })
    
    if (!teamInfo) {
      return { success: false, error: "Team not found" }
    }
    
    const role = await getUserRole(teamInfo.eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    const [member] = await db.insert(teamMembers).values({ teamId, userId }).returning()
    revalidatePath(`/events/${teamInfo.event.id}`)
    logger.info({
      eventId: teamInfo.event.id,
      teamId,
      userId,
      action: "addUserToTeam"
    }, "User added to team successfully")
    
    return { success: true, data: member }
  } catch (error) {
    logger.error({ error }, "Error adding user to team", error)
    return { success: false, error: "Failed to add user to team" }
  }
}

export async function removeUserFromTeam(teamId: string, userId: string) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })
    
    if (!teamInfo) {
      return { success: false, error: "Team not found" }
    }
    
    const role = await getUserRole(teamInfo.eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    revalidatePath(`/events/${teamInfo.event.id}`)
    logger.info({
      eventId: teamInfo.event.id,
      teamId,
      userId,
      action: "removeUserFromTeam"
    }, "User removed from team successfully")
    
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error removing user from team", error)
    return { success: false, error: "Failed to remove user from team" }
  }
}

export async function deleteTeam(teamId: string) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })
    
    if (!teamInfo) {
      return { success: false, error: "Team not found" }
    }
    
    const role = await getUserRole(teamInfo.eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
    await db.delete(teams).where(eq(teams.id, teamId))
    
    revalidatePath(`/events/${teamInfo.event.id}`)
    logger.info({
      eventId: teamInfo.event.id,
      teamId,
      action: "deleteTeam"
    }, "Team deleted successfully")
    
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting team", error)
    return { success: false, error: "Failed to delete team" }
  }
}

export async function getEventParticipants(eventId: string) {
  const participants = await db
    .select({
      id: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
    })
    .from(users)
    .innerJoin(eventParticipants, eq(users.id, eventParticipants.userId))
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        not(
          exists(
            db
              .select()
              .from(teamMembers)
              .innerJoin(teams, eq(teams.id, teamMembers.teamId))
              .where(and(eq(teamMembers.userId, users.id), eq(teams.eventId, eventId))),
          ),
        ),
      ),
    )

  // Fetch metadata status for all participants
  const metadataRecords = await db.query.playerMetadata.findMany({
    where: eq(playerMetadata.eventId, eventId),
  })

  const metadataMap = new Map(metadataRecords.map(m => [m.userId, m]))

  // Add hasMetadata flag to participants
  const participantsWithMetadata = participants.map(participant => {
    const metadata = metadataMap.get(participant.id)
    return {
      ...participant,
      hasMetadata: !!metadata,
      skillLevel: metadata?.skillLevel ?? null,
    }
  })

  return participantsWithMetadata
}

export async function updateTeamName(teamId: string, newName: string) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })
    
    if (!teamInfo) {
      return { success: false, error: "Team not found" }
    }
    
    const role = await getUserRole(teamInfo.eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    const [updatedTeam] = await db.update(teams).set({ name: newName }).where(eq(teams.id, teamId)).returning()

    if (updatedTeam) {
      revalidatePath(`/events/${updatedTeam.eventId}`)
      return { success: true, data: updatedTeam }
    } else {
      return { success: false, error: "Team not found" }
    }
  } catch (error) {
    logger.error({ error }, "Error updating team name:", error)
    return { success: false, error: "Failed to update team name" }
  }
}

export async function updateTeamMember(teamId: string, userId: string, isLeader: boolean) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })
    
    if (!teamInfo) {
      return { success: false, error: "Team not found" }
    }
    
    const role = await getUserRole(teamInfo.eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    const [updatedMember] = await db
      .update(teamMembers)
      .set({ isLeader })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .returning()

    revalidatePath(`/events/${teamInfo.event.id}`)
    return { success: true, data: updatedMember }
  } catch (error) {
    logger.error({ error }, "Error updating team member:", error)
    return { success: false, error: "Failed to update team member" }
  }
}

export async function getCurrentTeamForUser(eventId: string) {
  try {
    const session = await getServerAuthSession()
    if (!session?.user) return null;
    
    const userId = session.user.id
    const result = await db
      .select({
        teamId: teamMembers.teamId,
        teamName: teams.name,
      })
      .from(eventParticipants)
      .innerJoin(teams, eq(teams.eventId, eventParticipants.eventId))
      .innerJoin(teamMembers, and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, eventParticipants.userId)))
      .where(and(eq(eventParticipants.userId, userId), eq(eventParticipants.eventId, eventId)))
      .limit(1)
      .execute()

    if (result.length === 0) {
      return null // User is not part of any team for this event
    }

    return {
      id: result[0]!.teamId,
      name: result[0]!.teamName,
    }
  } catch (error) {
    logger.error({ error }, "Error fetching current team for user:", error)
    throw new Error("Failed to fetch current team for user") // Keep throw for queries if expected
  }
}

export async function assignParticipantToTeam(eventId: string, userId: string, teamId: string) {
  try {
    const role = await getUserRole(eventId)
    if (role !== "admin" && role !== "management") {
      return { success: false, error: "Unauthorized" }
    }

    await db.transaction(async (tx) => {
      // First, remove the user from any existing team in this event
      const existingTeamMember = await tx.query.teamMembers.findFirst({
        where: eq(teamMembers.userId, userId),
        with: {
          team: true,
        },
      })

      if (existingTeamMember && existingTeamMember.team.eventId === eventId) {
        await tx.delete(teamMembers).where(eq(teamMembers.id, existingTeamMember.id))
      }

      // Then, add the user to the new team
      if (teamId) {
        // Verify that the new team belongs to the correct event
        const newTeam = await tx.query.teams.findFirst({
          where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
        })

        if (!newTeam) {
          throw new Error("Invalid team for this event")
        }

        await tx.insert(teamMembers).values({
          teamId,
          userId,
          isLeader: false,
        })
      }
    });

    // Revalidate the participants page to reflect the changes
    revalidatePath(`/events/${eventId}/participants`)
    // Also revalidate the event page
    revalidatePath(`/events/${eventId}`)
    
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error assigning participant to team:", error)
    return { success: false, error: "Failed to assign participant to team" }
  }
}
