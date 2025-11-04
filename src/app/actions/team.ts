"use server"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teams, teamMembers, eventParticipants, users, playerMetadata } from "@/server/db/schema"
import { eq, and, not, exists } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function createTeam(eventId: string, name: string) {
  const [team] = await db.insert(teams).values({ eventId, name }).returning()
  revalidatePath(`/events/${eventId}`)
  return team
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

  const metadataMap = new Map(metadataRecords.map(m => [m.userId, true]))

  // Add hasMetadata flag to team members
  const teamsWithMetadata = eventTeams.map(team => ({
    ...team,
    teamMembers: team.teamMembers.map(member => ({
      ...member,
      user: {
        ...member.user,
        hasMetadata: metadataMap.has(member.user.id),
      },
    })),
  }))

  return teamsWithMetadata
}

export async function addUserToTeam(teamId: string, userId: string) {
  const [member] = await db.insert(teamMembers).values({ teamId, userId }).returning()
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  })
  if (team) {
    revalidatePath(`/events/${team.event.id}`)
  }
  return member
}

export async function removeUserFromTeam(teamId: string, userId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  })
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
  if (team) {
    revalidatePath(`/events/${team.event.id}`)
  }
}

export async function deleteTeam(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  })
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
  await db.delete(teams).where(eq(teams.id, teamId))
  if (team) {
    revalidatePath(`/events/${team.event.id}`)
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

  const metadataMap = new Map(metadataRecords.map(m => [m.userId, true]))

  // Add hasMetadata flag to participants
  const participantsWithMetadata = participants.map(participant => ({
    ...participant,
    hasMetadata: metadataMap.has(participant.id),
  }))

  return participantsWithMetadata
}

export async function updateTeamName(teamId: string, newName: string) {
  try {
    const [updatedTeam] = await db.update(teams).set({ name: newName }).where(eq(teams.id, teamId)).returning()

    if (updatedTeam) {
      revalidatePath(`/events/${updatedTeam.eventId}`)
      return updatedTeam
    } else {
      throw new Error("Team not found")
    }
  } catch (error) {
    console.error("Error updating team name:", error)
    throw new Error("Failed to update team name")
  }
}

export async function updateTeamMember(teamId: string, userId: string, isLeader: boolean) {
  const [updatedMember] = await db
    .update(teamMembers)
    .set({ isLeader })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .returning()

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  })
  if (team) {
    revalidatePath(`/events/${team.event.id}`)
  }
  return updatedMember
}

export async function getCurrentTeamForUser(eventId: string) {
  try {
    const session = await getServerAuthSession()
    const userId = session!.user.id
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
    console.error("Error fetching current team for user:", error)
    throw new Error("Failed to fetch current team for user")
  }
}

// Let's update the assignParticipantToTeam function to ensure it properly updates the UI
export async function assignParticipantToTeam(eventId: string, userId: string, teamId: string) {
  try {
    // First, remove the user from any existing team in this event
    const existingTeamMember = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, userId),
      with: {
        team: true,
      },
    })

    if (existingTeamMember && existingTeamMember.team.eventId === eventId) {
      await db.delete(teamMembers).where(eq(teamMembers.id, existingTeamMember.id))
    }

    // Then, add the user to the new team
    if (teamId) {
      // Verify that the new team belongs to the correct event
      const newTeam = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
      })

      if (!newTeam) {
        throw new Error("Invalid team for this event")
      }

      await db.insert(teamMembers).values({
        teamId,
        userId,
        isLeader: false,
      })
    }

    // Revalidate the participants page to reflect the changes
    revalidatePath(`/events/${eventId}/participants`)
    // Also revalidate the event page
    revalidatePath(`/events/${eventId}`)
  } catch (error) {
    console.error("Error assigning participant to team:", error)
    throw new Error("Failed to assign participant to team")
  }
}

