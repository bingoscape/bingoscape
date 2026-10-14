"use server"
import { getServerAuthSession } from "@/server/auth"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import { revalidateEventParticipants } from "@/server/revalidate-event-participants"
import {
  teams,
  teamMembers,
  eventParticipants,
  users,
  playerMetadata,
} from "@/server/db/schema"
import { eq, and, not, exists } from "drizzle-orm"
import { levelAllows } from "@/lib/authz/read-policy"
import { getEventReadAccessFor } from "@/server/authz/read"
import { authorize, denial, failure, hasPermission } from "@/server/authz"
import {
  assertTeamLimitForBattleship,
  battleshipErrorMessage,
} from "@/server/battleship"

export async function createTeam(eventId: string, name: string) {
  const allowed = await authorize(eventId, "team:manage")
  if (!allowed.success) return denial(allowed)

  try {
    const team = await db.transaction(async (tx) => {
      // Battleship events are played by exactly two teams.
      await assertTeamLimitForBattleship(tx, eventId)
      const [created] = await tx
        .insert(teams)
        .values({ eventId, name })
        .returning()
      return created
    })
    revalidateEventParticipants(eventId)

    if (team) {
      logger.info(
        {
          eventId,
          teamId: team.id,
          teamName: name,
          action: "createTeam",
        },
        "Team created successfully"
      )
    }

    return { success: true as const, data: team }
  } catch (error) {
    logger.error({ error }, "Error creating team", error)
    return failure(battleshipErrorMessage(error, "Failed to create team"))
  }
}

export async function getTeamsByEventId(eventId: string) {
  // Anybody who may read the Event content gets the Teams (a public Event shows
  // its rosters). Only members also get the skill badges the roster shows;
  // visitors of a public Event get no player metadata. Judged on the strict
  // level, so the relaxed read policy never hands metadata to non-members.
  const access = await getEventReadAccessFor(eventId, "content")
  if (!access) return []
  const withMetadata = levelAllows(access.strictLevel, "member-data")

  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          // Never ship email / password hash to the client.
          user: {
            columns: { id: true, name: true, image: true, runescapeName: true },
          },
        },
      },
    },
  })

  // Fetch metadata status for all team members
  const metadataRecords = withMetadata
    ? await db.query.playerMetadata.findMany({
        where: and(eq(playerMetadata.eventId, eventId)),
      })
    : []

  const metadataMap = new Map(metadataRecords.map((m) => [m.userId, m]))

  // Add hasMetadata flag to team members
  const teamsWithMetadata = eventTeams.map((team) => ({
    ...team,
    teamMembers: team.teamMembers.map((member) => {
      const metadata = metadataMap.get(member.user.id)
      return {
        ...member,
        user: {
          ...member.user,
          hasMetadata: !!metadata,
          skillLevel: metadata?.skillLevel ?? null,
          runescapeName:
            metadata?.runescapeNameOverride ?? member.user.runescapeName,
          hasOverride: !!metadata?.runescapeNameOverride,
          originalRunescapeName: member.user.runescapeName,
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
      return failure("Team not found", "NOT_FOUND")
    }

    const allowed = await authorize(teamInfo.eventId, "team:manage")
    if (!allowed.success) return denial(allowed)

    // A Player is on at most one Team per Event (unique event_id + user_id).
    const [existing] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(
        and(eq(teams.eventId, teamInfo.eventId), eq(teamMembers.userId, userId))
      )
      .limit(1)
    if (existing) {
      return {
        success: false,
        error: "User is already on a team in this event",
      }
    }

    const [member] = await db
      .insert(teamMembers)
      .values({ teamId, eventId: teamInfo.eventId, userId })
      .onConflictDoNothing()
      .returning()
    if (!member) {
      return {
        success: false,
        error: "User is already on a team in this event",
      }
    }
    revalidateEventParticipants(teamInfo.event.id)
    logger.info(
      {
        eventId: teamInfo.event.id,
        teamId,
        userId,
        action: "addUserToTeam",
      },
      "User added to team successfully"
    )

    return { success: true as const, data: member }
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
      return failure("Team not found", "NOT_FOUND")
    }

    const allowed = await authorize(teamInfo.eventId, "team:manage")
    if (!allowed.success) return denial(allowed)

    await db
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
      )
    revalidateEventParticipants(teamInfo.event.id)
    logger.info(
      {
        eventId: teamInfo.event.id,
        teamId,
        userId,
        action: "removeUserFromTeam",
      },
      "User removed from team successfully"
    )

    return { success: true as const }
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
      return failure("Team not found", "NOT_FOUND")
    }

    const allowed = await authorize(teamInfo.eventId, "team:manage")
    if (!allowed.success) return denial(allowed)

    await db.transaction(async (tx) => {
      await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
      await tx.delete(teams).where(eq(teams.id, teamId))
    })

    revalidateEventParticipants(teamInfo.event.id)
    logger.info(
      {
        eventId: teamInfo.event.id,
        teamId,
        action: "deleteTeam",
      },
      "Team deleted successfully"
    )

    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error deleting team", error)
    return { success: false, error: "Failed to delete team" }
  }
}

/**
 * Participants of the event that are not on a team yet, with a flag for
 * whether they have player metadata (for the team builder).
 */
export async function getUnassignedParticipants(eventId: string) {
  // Deliberate: a denial reads as an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "participant:list"))) return []

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
              .where(
                and(
                  eq(teamMembers.userId, users.id),
                  eq(teams.eventId, eventId)
                )
              )
          )
        )
      )
    )

  // Fetch metadata status for all participants
  const metadataRecords = await db.query.playerMetadata.findMany({
    where: eq(playerMetadata.eventId, eventId),
  })

  const metadataMap = new Map(metadataRecords.map((m) => [m.userId, m]))

  // Add hasMetadata flag to participants
  const participantsWithMetadata = participants.map((participant) => {
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
      return failure("Team not found", "NOT_FOUND")
    }

    const allowed = await authorize(teamInfo.eventId, "team:manage")
    if (!allowed.success) return denial(allowed)

    const [updatedTeam] = await db
      .update(teams)
      .set({ name: newName })
      .where(eq(teams.id, teamId))
      .returning()

    if (updatedTeam) {
      revalidateEventParticipants(updatedTeam.eventId)
      return { success: true as const, data: updatedTeam }
    } else {
      return { success: false, error: "Team not found" }
    }
  } catch (error) {
    logger.error({ error }, "Error updating team name:", error)
    return { success: false, error: "Failed to update team name" }
  }
}

export async function updateTeamMember(
  teamId: string,
  userId: string,
  isLeader: boolean
) {
  try {
    const teamInfo = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: { event: true },
    })

    if (!teamInfo) {
      return failure("Team not found", "NOT_FOUND")
    }

    const allowed = await authorize(teamInfo.eventId, "team:manage")
    if (!allowed.success) return denial(allowed)

    const [updatedMember] = await db
      .update(teamMembers)
      .set({ isLeader })
      .where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
      )
      .returning()

    revalidateEventParticipants(teamInfo.event.id)
    return { success: true as const, data: updatedMember }
  } catch (error) {
    logger.error({ error }, "Error updating team member:", error)
    return { success: false, error: "Failed to update team member" }
  }
}

export async function getCurrentTeamForUser(eventId: string) {
  try {
    const session = await getServerAuthSession()
    if (!session?.user) return null

    const userId = session.user.id
    const result = await db
      .select({
        teamId: teamMembers.teamId,
        teamName: teams.name,
      })
      .from(eventParticipants)
      .innerJoin(teams, eq(teams.eventId, eventParticipants.eventId))
      .innerJoin(
        teamMembers,
        and(
          eq(teamMembers.teamId, teams.id),
          eq(teamMembers.userId, eventParticipants.userId)
        )
      )
      .where(
        and(
          eq(eventParticipants.userId, userId),
          eq(eventParticipants.eventId, eventId)
        )
      )
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
