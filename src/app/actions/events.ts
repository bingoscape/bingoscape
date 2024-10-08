'use server'
import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { events, tiles, eventParticipants, clanMembers, eventInvites, teamMembers, teams, eventBuyIns, users } from "@/server/db/schema";
import { eq, and, asc, sum, sql } from "drizzle-orm";
import { nanoid } from 'nanoid';
import { revalidatePath } from "next/cache";

export interface Image {
  id: string;
  path: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Submission {
  id: string;
  teamTileSubmissionId: string;
  image: Image;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamTileSubmission {
  id: string;
  teamId: string;
  status: 'pending' | 'accepted' | 'requires_interaction' | 'declined';
  createdAt: Date;
  updatedAt: Date;
  tileId: string;
  reviewedBy: string | null;
  submissions: Submission[];
  team: Team;
}

export interface EventParticipant {
  eventId: string,
  userId: string,
  role: 'admin' | 'management' | 'participant',
  createdAt: Date,
  updatedAt: Date,
}

export interface TeamProgress {
  id?: string;
  updatedAt?: Date;
  teamId: string;
  goalId: string;
  currentValue: number;
}

export interface Goal {
  id: string;
  description: string;
  targetValue: number;
  createdAt?: Date;
  updatedAt?: Date;
  tileId: string;
  teamProgress: TeamProgress[];
}

export interface Tile {
  id: string;
  title: string;
  description: string;
  headerImage: string | null;
  weight: number;
  index: number;
  createdAt: Date;
  updatedAt: Date;
  bingoId: string;
  teamTileSubmissions?: TeamTileSubmission[];
  goals?: Goal[];
}

export interface Bingo {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  rows: number;
  columns: number;
  codephrase: string;
  createdAt: Date;
  updatedAt: Date;
  locked: boolean;
  visible: boolean;
  tiles?: Tile[];
}

export interface Clan {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  creatorId: string;
  clanId: string | null;
  createdAt: Date;
  updatedAt: Date;
  locked: boolean;
  visible: boolean;
  bingos?: Bingo[];
  clan?: Clan | null;
  teams?: Team[];
  eventParticipants?: EventParticipant[];
  minimumBuyIn: number;
  basePrizePool: number;
}

export interface EventData {
  event: Event;
  totalPrizePool: number;
}

export interface GetEventByIdResult {
  event: Event;
  userRole: EventRole;
}

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
  const bpp = formData.get('basePrizePool') as string
  const mbi = formData.get('minimumBuyIn') as string

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

  const basePrizePool = parseInt(bpp) ?? 0;
  const minimumBuyIn = parseInt(mbi) ?? 0;

  try {

    const newEvent = await db.transaction(async (tx) => {

      const [createdEvent] = await tx.insert(events).values({
        title: title,
        description: description || '',
        startDate,
        endDate,
        basePrizePool,
        minimumBuyIn,
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

export async function getEventById(eventId: string): Promise<GetEventByIdResult | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      bingos: {
        with: {
          tiles: {
            orderBy: [asc(tiles.index)],
            with: {
              teamTileSubmissions: {
                with: {
                  submissions: {
                    with: {
                      image: true
                    }
                  },
                  team: true
                }
              },
              goals: {
                with: {
                  teamProgress: true
                }
              }
            }
          },
        },
      },
      clan: true,
      teams: true,
    },
  });

  if (!event) {
    return null;
  }

  const userRole = await getUserRole(eventId)

  return {
    event,
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


export async function getUserCreatedEvents() {
  const session = await getServerAuthSession();

  try {
    if (!session) {
      throw new Error("User needs to be authenticated")
    }
    const userId = session.user.id;
    const userEvents = await db.query.events.findMany({
      where: (events, { eq }) => eq(events.creatorId, userId),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: true
      },
      orderBy: events.createdAt,
    });

    const eventDataPromises = userEvents.map(async (event) => {
      const totalPrizePool = await getTotalBuyInsForEvent(event.id);
      return {
        event: {
          ...event,
          role: event.creatorId === userId ? 'admin' : event.eventParticipants[0]?.role ?? 'participant',
        },
        totalPrizePool,
      };
    });

    return await Promise.all(eventDataPromises);
  } catch (error) {
    console.error("Error fetching events:", error);
    throw new Error("Failed to fetch events");
  }
}

export async function getEvents(userId: string): Promise<EventData[]> {
  try {
    const userEvents = await db.query.events.findMany({
      where: (events, { or, eq, exists }) => or(
        eq(events.creatorId, userId),
        exists(
          db.select()
            .from(eventParticipants)
            .where(and(
              eq(eventParticipants.eventId, events.id),
              eq(eventParticipants.userId, userId)
            ))
        )
      ),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: true,
      },
      orderBy: events.createdAt,
    });

    const eventDataPromises = userEvents.map(async (event) => {
      const totalPrizePool = await getTotalBuyInsForEvent(event.id);
      return {
        event: {
          ...event,
          role: event.creatorId === userId ? 'admin' : event.eventParticipants[0]?.role ?? 'participant',
        },
        totalPrizePool,
      };
    });

    return await Promise.all(eventDataPromises);
  } catch (error) {
    console.error("Error fetching events:", error);
    throw new Error("Failed to fetch events");
  }
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

export async function generateEventInviteLink(eventId: string) {
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
      eq(eventParticipants.userId, session!.user.id)
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
    const participants = await db
      .select({
        userId: eventParticipants.userId,
        runescapeName: users.runescapeName,
        role: eventParticipants.role,
        buyIn: sql<number>`COALESCE(${eventBuyIns.amount}, 0)`.as('buyIn'),
        teamId: teamMembers.teamId,
        teamName: teams.name,
      })
      .from(eventParticipants)
      .leftJoin(users, eq(eventParticipants.userId, users.id))
      .leftJoin(
        eventBuyIns,
        eq(eventBuyIns.eventParticipantId, eventParticipants.id)
      )
      .leftJoin(teamMembers, eq(eventParticipants.userId, teamMembers.userId))
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(eventParticipants.eventId, eventId))
      .orderBy(eventParticipants.userId)

    return participants.map(p => ({
      id: p.userId,
      runescapeName: p.runescapeName ?? '',
      role: p.role,
      teamId: p.teamId ?? null,
      teamName: p.teamName ?? null,
      buyIn: p.buyIn,
    }))
  } catch (error) {
    console.error("Error fetching event participants:", error)
    throw new Error("Failed to fetch event participants")
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

export async function getTotalBuyInsForEvent(eventId: string): Promise<number> {
  try {
    const result = await db
      .select({
        total: sum(eventBuyIns.amount)
      })
      .from(eventBuyIns)
      .innerJoin(
        eventParticipants,
        eq(eventBuyIns.eventParticipantId, eventParticipants.id)
      )
      .where(eq(eventParticipants.eventId, eventId))

    // Convert the result to a number, or return 0 if it's null
    const total = result[0]?.total ? Number(result[0].total) : 0

    // Check if the parsed result is a valid number
    if (isNaN(total)) {
      console.error("Invalid sum result for event buy-ins")
      return 0
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId)
    })

    return total + (event?.basePrizePool ?? 0)
  } catch (error) {
    console.error("Error calculating total buy-ins for event:", error)
    return 0
  }
}


export async function updateParticipantBuyIn(eventId: string, participantId: string, buyIn: number) {
  try {
    // First, get the minimum buy-in for the event
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId)
    })

    if (!event) {
      throw new Error("Event not found")
    }

    // Find the eventParticipant
    const eventParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, participantId)
      )
    })

    if (!eventParticipant) {
      throw new Error("Participant not found for this event")
    }

    // Check if a buy-in record already exists
    const existingBuyIn = await db.query.eventBuyIns.findFirst({
      where: eq(eventBuyIns.eventParticipantId, eventParticipant.id)
    })

    if (existingBuyIn) {
      // Update existing record
      await db
        .update(eventBuyIns)
        .set({
          amount: buyIn,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(eventBuyIns.id, existingBuyIn.id))
    } else {
      // Insert new record
      await db
        .insert(eventBuyIns)
        .values({
          eventParticipantId: eventParticipant.id,
          amount: buyIn,
        })
    }
    revalidatePath(`/events/${eventId}`)
    revalidatePath(`/`)

    return { success: true }
  } catch (error) {
    console.error("Error updating participant buy-in:", error)
    throw error
  }
}

export async function updateEvent(eventId: string, eventData: {
  title: string
  description: string | null
  startDate: string
  endDate: string
  minimumBuyIn: number
  basePrizePool: number
  locked?: boolean
  visible?: boolean
}) {
  try {
    await db.update(events)
      .set({
        title: eventData.title,
        description: eventData.description,
        startDate: new Date(eventData.startDate),
        endDate: new Date(eventData.endDate),
        minimumBuyIn: eventData.minimumBuyIn,
        basePrizePool: eventData.basePrizePool,
        locked: eventData.locked,
        visible: eventData.visible,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))

    // Revalidate the event page to reflect the changes
    revalidatePath(`/events/${eventId}`)

    return { success: true }
  } catch (error) {
    console.error("Error updating event:", error)
    throw new Error("Failed to update event")
  }
}
