'use server'
import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { events, tiles, eventParticipants, clanMembers, eventInvites, teamMembers, teams } from "@/server/db/schema";
import { type UUID } from "crypto";
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from 'nanoid';

export type EventRole = 'admin' | 'management' | 'participant';

export async function createEvent(formData: FormData) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "You must be logged in to create an event" }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string

  if (!title || !startDateStr || !endDateStr) {
    return { success: false, error: "Missing required fields" }
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Invalid date format" }
  }

  if (endDate < startDate) {
    return { success: false, error: "End date must be after start date" }
  }

  try {

    const newEvent = await db.transaction(async (tx) => {

      const [createdEvent] = await tx.insert(events).values({
        title: title,
        description: description || '',
        startDate,
        endDate,
        creatorId: session.user.id,
      }).returning();

      // Add the user as an admin participant
      await tx.insert(eventParticipants).values({
        eventId: createdEvent!.id,
        userId: session.user.id,
        role: 'admin',
      });

      return createdEvent;
    });

    return { success: !!newEvent }
  } catch (error) {
    console.error("Error creating event:", error)
    return { success: false, error: "Failed to create event" }
  }
}

export async function getEventById(eventId: UUID) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      bingos: {
        with: {
          tiles: {
            orderBy: [asc(tiles.index)],
            with: {
              teamTileSubmissions: true
            }
          },
        },
      },
      clan: true,
      teams: {
        columns: {
          id: true,
          name: true
        }
      },
    },
  });

  if (!event) {
    return null;
  }

  const userRole = await getUserRole(eventId)

  return {
    event,
    bingos: event.bingos,
    userRole,
  };
}

export async function assignEventToClan(eventId: string, clanId: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to assign events to clans");
  }

  // Check if the user is the event creator or a clan admin
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      clan: true,
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.creatorId !== session.user.id) {
    // Check if the user is a clan admin
    const userClanMembership = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, session.user.id))
    })

    if (!userClanMembership) {
      throw new Error("You don't have permission to assign this event to a clan");
    }
  }

  // Assign the event to the clan
  await db.update(events)
    .set({ clanId: clanId })
    .where(eq(events.id, eventId));

  return { success: true };
}

export async function getEvents(userId: string) {
  return await db.query.events.findMany({
    where: eq(events.creatorId, userId),
    orderBy: events.createdAt,
  })
}

export async function joinEvent(eventId: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to join an event");
  }

  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: (ep, { and, eq }) => and(
      eq(ep.eventId, eventId),
      eq(ep.userId, session.user.id)
    ),
  });

  if (existingParticipant) {
    throw new Error("You are already a participant in this event");
  }

  await db.insert(eventParticipants).values({
    eventId,
    userId: session.user.id,
    role: 'participant',
  });

  return { success: true };
}

export async function generateEventInviteLink(eventId: UUID) {
  const session = await getServerAuthSession();

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.creatorId !== session?.user.id) {
    throw new Error("Unauthorized to generate invite link for this event");
  }

  const inviteCode = nanoid(10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Invite expires in 7 days

  const [invite] = await db.insert(eventInvites).values({
    eventId,
    inviteCode,
    expiresAt,
  }).returning();

  return invite;
}

export async function joinEventViaInvite(inviteCode: string) {
  const invite = await db.query.eventInvites.findFirst({
    where: eq(eventInvites.inviteCode, inviteCode),
    with: {
      event: true,
    },
  });

  const session = await getServerAuthSession()
  if (!invite || (invite.expiresAt && invite.expiresAt < new Date())) {
    throw new Error("Invalid or expired invite code");
  }

  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, invite.eventId),
      eq(eventParticipants.userId, session?.user.id as UUID)
    ),
  });

  if (existingParticipant) {
    throw new Error("You are already a participant in this event");
  }

  await db.insert(eventParticipants).values({
    eventId: invite.eventId,
    userId: session!.user.id,
    role: 'participant',
  });

  return invite.event;
}

export async function getUserRole(eventId: string): Promise<EventRole> {

  const session = await getServerAuthSession();

  if (!session || !session.user) {
    throw new Error("User not authenticated");
  }

  try {
    // First, check if the user is the event creator (admin)
    const event = await db.query.events.findFirst({
      where: and(
        eq(events.id, eventId),
        eq(events.creatorId, session.user.id)
      ),
    });

    if (event) {
      return 'admin';
    }

    // If not the creator, check the event_participants table
    const participant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, session.user.id)
      ),
    });

    if (participant) {
      return participant.role as EventRole;
    }

    // If the user is not found in event_participants, they're not associated with this event
    throw new Error("User is not associated with this event");

  } catch (error) {
    console.error("Error fetching user role:", error);
    throw new Error("Failed to fetch user role");
  }
}

export async function getEventParticipants(eventId: string) {
  try {
    const participants = await db.query.eventParticipants.findMany({
      where: eq(eventParticipants.eventId, eventId),
      with: {
        user: true,
      },
    });

    return participants.map(p => ({
      id: p.userId,
      runescapeName: p.user.runescapeName ?? '',
      role: p.role,
      teamId: null, // We'll need to fetch this separately or join with teamMembers
    }));
  } catch (error) {
    console.error("Error fetching event participants:", error);
    throw new Error("Failed to fetch event participants");
  }
}

export async function updateParticipantRole(eventId: string, userId: string, newRole: 'admin' | 'management' | 'participant') {
  try {
    await db.update(eventParticipants)
      .set({ role: newRole })
      .where(and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, userId)
      ));
  } catch (error) {
    console.error("Error updating participant role:", error);
    throw new Error("Failed to update participant role");
  }
}


export async function assignParticipantToTeam(eventId: string, userId: string, teamId: string) {
  try {
    // First, remove the user from any existing team in this event
    const existingTeamMember = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, userId),
      with: {
        team: true,
      },
    });

    if (existingTeamMember && existingTeamMember.team.eventId === eventId) {
      await db.delete(teamMembers).where(eq(teamMembers.id, existingTeamMember.id));
    }

    // Then, add the user to the new team
    if (teamId) {
      // Verify that the new team belongs to the correct event
      const newTeam = await db.query.teams.findFirst({
        where: and(
          eq(teams.id, teamId),
          eq(teams.eventId, eventId)
        ),
      });

      if (!newTeam) {
        throw new Error("Invalid team for this event");
      }

      await db.insert(teamMembers).values({
        teamId,
        userId,
        isLeader: false,
      });
    }
  } catch (error) {
    console.error("Error assigning participant to team:", error);
    throw new Error("Failed to assign participant to team");
  }
}

export async function getEventParticipantsWithTeams(eventId: string) {
  try {
    const participants = await db.query.eventParticipants.findMany({
      where: eq(eventParticipants.eventId, eventId),
      with: {
        user: true,
      },
    });

    const teamMemberships = await db.query.teamMembers.findMany({
      with: {
        team: true,
      },
    });

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
    });

    return participants.map(p => {
      const teamMembership = teamMemberships.find(tm => tm.userId === p.userId && eventTeams.some(et => et.id === tm.teamId));
      return {
        id: p.userId,
        name: p.user.name ?? '',
        email: p.user.email,
        role: p.role,
        teamId: teamMembership?.teamId ?? null,
        teamName: teamMembership?.team.name ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching event participants with teams:", error);
    throw new Error("Failed to fetch event participants with teams");
  }
}

