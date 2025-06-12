"use server"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  events,
  tiles,
  eventParticipants,
  clanMembers,
  eventInvites,
  teamMembers,
  teams,
  eventBuyIns,
  users,
  bingos,
  eventRegistrationRequests,
} from "@/server/db/schema"
import { eq, and, asc, sum, sql, desc } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

export interface Image {
  id: string
  path: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Submission {
  id: string
  teamTileSubmissionId: string
  image: Image
  status: "pending" | "accepted" | "requires_interaction" | "declined"
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string | null
    runescapeName: string | null
  }
}

export interface TeamTileSubmission {
  id: string
  teamId: string
  status: "pending" | "accepted" | "requires_interaction" | "declined"
  createdAt: Date
  updatedAt: Date
  tileId: string
  reviewedBy: string | null
  submissions: Submission[]
  team: Team
}

export interface EventParticipant {
  eventId: string
  userId: string
  role: "admin" | "management" | "participant"
  createdAt: Date
  updatedAt: Date
}

export interface TeamProgress {
  id?: string
  updatedAt?: Date
  teamId: string
  goalId: string
  currentValue: number
}

export interface Goal {
  id: string
  description: string
  targetValue: number
  createdAt?: Date
  updatedAt?: Date
  tileId: string
  teamProgress: TeamProgress[]
}

export interface Tile {
  id: string
  title: string
  description: string
  headerImage: string | null
  weight: number
  index: number
  createdAt: Date
  updatedAt: Date
  bingoId: string
  isHidden: boolean
  teamTileSubmissions?: TeamTileSubmission[]
  goals?: Goal[]
}

export interface Bingo {
  id: string
  eventId: string
  title: string
  description: string | null
  rows: number
  columns: number
  codephrase: string
  createdAt: Date
  updatedAt: Date
  locked: boolean
  visible: boolean
  tiles?: Tile[]
}

export interface Clan {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  eventId: string
  createdAt: Date
  updatedAt: Date
}

export interface Event {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  creatorId: string | null
  clanId: string | null
  createdAt: Date
  updatedAt: Date
  locked: boolean
  public: boolean
  bingos?: Bingo[]
  clan?: Clan | null
  teams?: Team[]
  eventParticipants?: EventParticipant[]
  minimumBuyIn: number
  basePrizePool: number
  registrationDeadline: Date | null
  requiresApproval: boolean
}

export interface EventData {
  event: Event
  totalPrizePool: number
}

export interface GetEventByIdResult {
  event: Event
  userRole: EventRole | null
}

export type EventRole = "admin" | "management" | "participant"

export interface RegistrationRequest {
  id: string
  eventId: string
  userId: string
  status: "pending" | "approved" | "rejected"
  message: string | null
  adminNotes: string | null
  responseMessage: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    runescapeName: string | null
  }
  event: {
    id: string
    title: string
  }
  reviewer?: {
    id: string
    name: string | null
  } | null
}

export async function createEvent(formData: FormData) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "You must be logged in to create an event" }
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const startDateStr = formData.get("startDate") as string
  const endDateStr = formData.get("endDate") as string
  const registrationDeadlineStr = formData.get("registrationDeadline") as string
  const bpp = formData.get("basePrizePool") as string
  const mbi = formData.get("minimumBuyIn") as string
  const requiresApproval = formData.get("requiresApproval") === "true"

  if (!title || !startDateStr || !endDateStr) {
    return { success: false, error: "Missing required fields" }
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  const registrationDeadline = registrationDeadlineStr ? new Date(registrationDeadlineStr) : null

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Invalid date format" }
  }

  if (registrationDeadline && isNaN(registrationDeadline.getTime())) {
    return { success: false, error: "Invalid registration deadline format" }
  }

  if (endDate < startDate) {
    return { success: false, error: "End date must be after start date" }
  }

  if (registrationDeadline && registrationDeadline > endDate) {
    return { success: false, error: "Registration deadline must be before the event end date" }
  }

  const basePrizePool = Number.parseInt(bpp) ?? 0
  const minimumBuyIn = Number.parseInt(mbi) ?? 0

  try {
    const newEvent = await db.transaction(async (tx) => {
      const [createdEvent] = await tx
        .insert(events)
        .values({
          title: title,
          description: description || "",
          startDate,
          endDate,
          registrationDeadline,
          basePrizePool,
          minimumBuyIn,
          creatorId: session.user.id,
          requiresApproval,
        })
        .returning()

      // Add the user as an admin participant
      await tx.insert(eventParticipants).values({
        eventId: createdEvent!.id,
        userId: session.user.id,
        role: "admin",
      })

      return createdEvent
    })

    return { success: !!newEvent }
  } catch (error) {
    console.error("Error creating event:", error)
    return { success: false, error: "Failed to create event" }
  }
}

// Modify the getUserRole function to handle non-participants gracefully
export async function getUserRole(eventId: string): Promise<EventRole | null> {
  const session = await getServerAuthSession()

  if (!session || !session.user) {
    return null
  }

  try {
    // First, check if the user is the event creator (admin)
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.creatorId, session.user.id)),
    })

    if (event) {
      return "admin"
    }

    // If not the creator, check the event_participants table
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, session.user.id)),
    })

    if (participant) {
      return participant.role as EventRole
    }

    // If the user is not found in event_participants, return null instead of throwing an error
    return null
  } catch (error) {
    console.error("Error fetching user role:", error)
    return null
  }
}

// Modify the getEventById function to handle non-participants
export async function getEventById(eventId: string): Promise<GetEventByIdResult | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      bingos: {
        orderBy: [asc(bingos.createdAt)],
        with: {
          tiles: {
            orderBy: [asc(tiles.index)],
            with: {
              teamTileSubmissions: {
                with: {
                  submissions: {
                    with: {
                      image: true,
                      user: true
                    },
                  },
                  team: true,
                },
              },
              goals: {
                with: {
                  teamProgress: true,
                },
              },
            },
          },
        },
      },
      clan: true,
      teams: true,
    },
  })

  if (!event) {
    return null
  }

  const userRole = await getUserRole(eventId)

  return {
    event,
    userRole,
  }
}

export async function assignEventToClan(eventId: string, clanId: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to assign events to clans")
  }

  // Check if the user is the event creator or a clan admin
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      clan: true,
    },
  })

  if (!event) {
    throw new Error("Event not found")
  }

  if (event.creatorId !== session.user.id) {
    // Check if the user is a clan admin
    const userClanMembership = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, session.user.id)),
    })

    if (!userClanMembership) {
      throw new Error("You don't have permission to assign this event to a clan")
    }
  }

  // Assign the event to the clan
  await db.update(events).set({ clanId: clanId }).where(eq(events.id, eventId))

  return { success: true }
}

export async function getUserCreatedEvents() {
  const session = await getServerAuthSession()

  try {
    if (!session) {
      throw new Error("User needs to be authenticated")
    }
    const userId = session.user.id
    const userEvents = await db.query.events.findMany({
      where: (events, { eq }) => eq(events.creatorId, userId),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: true,
      },
      orderBy: events.createdAt,
    })

    const eventDataPromises = userEvents.map(async (event) => {
      const totalPrizePool = await getTotalBuyInsForEvent(event.id)
      return {
        event: {
          ...event,
          role: event.creatorId === userId ? "admin" : (event.eventParticipants[0]?.role ?? "participant"),
        },
        totalPrizePool,
      }
    })

    return await Promise.all(eventDataPromises)
  } catch (error) {
    console.error("Error fetching events:", error)
    throw new Error("Failed to fetch events")
  }
}

export async function getEvents(userId: string): Promise<EventData[]> {
  try {
    const userEvents = await db.query.events.findMany({
      where: (events, { or, eq, exists }) =>
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
        bingos: true,
      },
      orderBy: events.createdAt,
    })

    const eventDataPromises = userEvents.map(async (event) => {
      const totalPrizePool = await getTotalBuyInsForEvent(event.id)
      return {
        event: {
          ...event,
          role: event.creatorId === userId ? "admin" : (event.eventParticipants[0]?.role ?? "participant"),
        },
        totalPrizePool,
      }
    })

    return await Promise.all(eventDataPromises)
  } catch (error) {
    console.error("Error fetching events:", error)
    throw new Error("Failed to fetch events")
  }
}

export async function updateEvent(
  eventId: string,
  eventData: {
    title: string
    description: string | null
    startDate: string
    endDate: string
    registrationDeadline: string | null
    minimumBuyIn: number
    basePrizePool: number
    locked?: boolean
    public?: boolean
    requiresApproval?: boolean
  },
) {
  try {
    await db
      .update(events)
      .set({
        title: eventData.title,
        description: eventData.description,
        startDate: new Date(eventData.startDate),
        endDate: new Date(eventData.endDate),
        registrationDeadline: eventData.registrationDeadline ? new Date(eventData.registrationDeadline) : null,
        minimumBuyIn: eventData.minimumBuyIn,
        basePrizePool: eventData.basePrizePool,
        locked: eventData.locked,
        public: eventData.public,
        requiresApproval: eventData.requiresApproval,
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

export async function isRegistrationOpen(eventId: string): Promise<{
  isOpen: boolean
  reason?: string
  canOverride: boolean
  requiresApproval?: boolean
}> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { isOpen: false, reason: "You must be logged in to join events", canOverride: false }
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    return { isOpen: false, reason: "Event not found", canOverride: false }
  }

  // Check if the user is already a participant
  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, session.user.id)),
  })

  if (existingParticipant) {
    return { isOpen: false, reason: "You are already a participant in this event", canOverride: false }
  }

  // Check if the user already has a pending registration request
  if (event.requiresApproval) {
    const existingRequest = await db.query.eventRegistrationRequests.findFirst({
      where: and(
        eq(eventRegistrationRequests.eventId, eventId),
        eq(eventRegistrationRequests.userId, session.user.id),
        eq(eventRegistrationRequests.status, "pending"),
      ),
    })

    if (existingRequest) {
      return {
        isOpen: false,
        reason: "You already have a pending registration request for this event",
        canOverride: false,
        requiresApproval: true,
      }
    }
  }

  // Check if the event is locked
  if (event.locked) {
    // Check if the user is an admin (can override)
    const isAdmin = event.creatorId === session.user.id
    return {
      isOpen: false,
      reason: "This event is locked for registration",
      canOverride: isAdmin,
      requiresApproval: event.requiresApproval,
    }
  }

  // Check if registration deadline has passed
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    // Check if the user is an admin (can override)
    const isAdmin = event.creatorId === session.user.id
    return {
      isOpen: false,
      reason: `Registration deadline (${new Date(event.registrationDeadline).toLocaleString()}) has passed`,
      canOverride: isAdmin,
      requiresApproval: event.requiresApproval,
    }
  }

  // Check if the event has ended
  if (new Date() > new Date(event.endDate)) {
    return {
      isOpen: false,
      reason: "This event has ended",
      canOverride: false,
      requiresApproval: event.requiresApproval,
    }
  }

  return {
    isOpen: true,
    canOverride: false,
    requiresApproval: event.requiresApproval,
  }
}

export async function requestToJoinEvent(eventId: string, message = "") {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to request to join an event")
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    throw new Error("Event not found")
  }

  if (!event.requiresApproval) {
    throw new Error("This event does not require approval to join")
  }

  // Check if registration is open
  const registrationStatus = await isRegistrationOpen(eventId)
  if (!registrationStatus.isOpen) {
    throw new Error(registrationStatus.reason ?? "Registration is closed for this event")
  }

  // Check if the user already has a pending request
  const existingRequest = await db.query.eventRegistrationRequests.findFirst({
    where: and(
      eq(eventRegistrationRequests.eventId, eventId),
      eq(eventRegistrationRequests.userId, session.user.id),
      eq(eventRegistrationRequests.status, "pending"),
    ),
  })

  if (existingRequest) {
    throw new Error("You already have a pending request to join this event")
  }

  // Create a new registration request
  await db.insert(eventRegistrationRequests).values({
    eventId,
    userId: session.user.id,
    status: "pending",
    message: message || null,
  })

  return { success: true }
}

export async function joinEvent(eventId: string, override = false) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to join an event")
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    throw new Error("Event not found")
  }

  // If the event requires approval and we're not overriding, redirect to request flow
  if (event.requiresApproval && !override) {
    throw new Error("This event requires approval to join. Please submit a registration request.")
  }

  // Skip registration checks if override is true and user is admin
  if (!override) {
    const registrationStatus = await isRegistrationOpen(eventId)

    if (!registrationStatus.isOpen) {
      throw new Error(registrationStatus.reason ?? "Registration is closed for this event")
    }
  } else {
    // If override is true, verify the user is an admin
    if (event.creatorId !== session.user.id) {
      throw new Error("You don't have permission to override registration restrictions")
    }
  }

  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: (ep, { and, eq }) => and(eq(ep.eventId, eventId), eq(ep.userId, session.user.id)),
  })

  if (existingParticipant) {
    throw new Error("You are already a participant in this event")
  }

  await db.insert(eventParticipants).values({
    eventId,
    userId: session.user.id,
    role: "participant",
  })

  return { success: true }
}

export async function generateEventInviteLink(eventId: string) {
  const session = await getServerAuthSession()

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    throw new Error("Event does not exist!")
  }

  const userRoleInEvent = (await getEventParticipants(event.id)).find((p) => p.id === session?.user.id)?.role

  const hasPermission = userRoleInEvent === "admin" || event.creatorId === session?.user.id

  if (!hasPermission) {
    throw new Error("Unauthorized to generate invite link for this event")
  }

  const inviteCode = nanoid(10)

  const expiresAt = event.registrationDeadline ?? event.endDate

  const [invite] = await db
    .insert(eventInvites)
    .values({
      eventId,
      inviteCode,
      expiresAt,
    })
    .returning()

  return invite
}

export async function joinEventViaInvite(inviteCode: string) {
  const invite = await db.query.eventInvites.findFirst({
    where: eq(eventInvites.inviteCode, inviteCode),
    with: {
      event: true,
    },
  })

  const session = await getServerAuthSession()
  if (!invite || (invite.expiresAt && invite.expiresAt < new Date())) {
    throw new Error("Invalid or expired invite code")
  }

  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.eventId, invite.eventId), eq(eventParticipants.userId, session!.user.id)),
  })

  if (existingParticipant) {
    throw new Error("You are already a participant in this event")
  }

  // If the event requires approval, create a registration request instead
  if (invite.event.requiresApproval) {
    await db.insert(eventRegistrationRequests).values({
      eventId: invite.eventId,
      userId: session!.user.id,
      status: "pending",
      message: `Joined via invite code: ${inviteCode}`,
    })
    return { ...invite.event, pendingApproval: true }
  }

  await db.insert(eventParticipants).values({
    eventId: invite.eventId,
    userId: session!.user.id,
    role: "participant",
  })

  return { ...invite.event, pendingApproval: false }
}

export async function getEventParticipants(eventId: string) {
  try {
    // First, get all unique participants for this event
    const eventParticipantsList = await db
      .select({
        id: eventParticipants.id,
        userId: eventParticipants.userId,
        role: eventParticipants.role,
      })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId))

    // Process each participant individually to avoid duplicates
    const participants = await Promise.all(
      eventParticipantsList.map(async (participant) => {
        // Get user info
        const user = await db.query.users.findFirst({
          where: eq(users.id, participant.userId),
        })

        // Get buy-in amount (if any)
        const buyInResult = await db
          .select({
            amount: sql<number>`COALESCE(${eventBuyIns.amount}, 0)`.as("buyIn"),
          })
          .from(eventBuyIns)
          .where(eq(eventBuyIns.eventParticipantId, participant.id))

        const buyIn = buyInResult[0]?.amount ?? 0

        // Get team info (if any) - Make sure we're getting the latest team assignment
        // const teamMember = await db.query.teamMembers.findFirst({
        //   where: eq(teamMembers.userId, participant.userId),
        //   with: {
        //     team: true,
        //   },
        //   orderBy: [desc(teamMembers.createdAt)], // Get the most recent team assignment

        // Use select syntax with a join between teams and teamMembers
        const team = await db
          .select({
            id: teams.id,
            name: teams.name,
            isLeader: teamMembers.isLeader,
          })
          .from(teams)
          .innerJoin(teamMembers, and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, participant.userId)))
          .where(eq(teams.eventId, eventId))
          .limit(1)

        console.log("team", team)

        const t = team[0] ?? null
        // Only include team if it belongs to this event
        // const team = teamMember?.team.eventId === eventId ? teamMember.team : null

        return {
          id: participant.userId,
          runescapeName: user?.runescapeName ?? "",
          role: participant.role,
          teamId: t != null ? t.id : null,
          teamName: t != null ? t.name : null,
          buyIn: buyIn,
        }
      }),
    )

    return participants
  } catch (error) {
    console.error("Error fetching event participants:", error)
    throw new Error("Failed to fetch event participants")
  }
}

export async function updateParticipantRole(
  eventId: string,
  userId: string,
  newRole: "admin" | "management" | "participant",
) {
  try {
    const userRoleInEvent = await getUserRole(eventId)
    const event = await getEventById(eventId)
    const hasPermission = userRoleInEvent === "admin" || event?.event.creatorId === userId

    if (!hasPermission) {
      throw new Error("You don't have permission to update participant roles")
    }

    await db
      .update(eventParticipants)
      .set({ role: newRole })
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)))
  } catch (error) {
    console.error("Error updating participant role:", error)
    throw new Error("Failed to update participant role")
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
  } catch (error) {
    console.error("Error assigning participant to team:", error)
    throw new Error("Failed to assign participant to team")
  }
}

export async function getEventParticipantsWithTeams(eventId: string) {
  try {
    const participants = await db.query.eventParticipants.findMany({
      where: eq(eventParticipants.eventId, eventId),
      with: {
        user: true,
      },
    })

    const teamMemberships = await db.query.teamMembers.findMany({
      with: {
        team: true,
      },
    })

    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
    })

    return participants.map((p) => {
      const teamMembership = teamMemberships.find(
        (tm) => tm.userId === p.userId && eventTeams.some((et) => et.id === tm.teamId),
      )
      return {
        id: p.userId,
        name: p.user.name ?? "",
        email: p.user.email,
        role: p.role,
        teamId: teamMembership?.teamId ?? null,
        teamName: teamMembership?.team.name ?? null,
      }
    })
  } catch (error) {
    console.error("Error fetching event participants with teams:", error)
    throw new Error("Failed to fetch event participants with teams")
  }
}

export async function getTotalBuyInsForEvent(eventId: string): Promise<number> {
  try {
    const result = await db
      .select({
        total: sum(eventBuyIns.amount),
      })
      .from(eventBuyIns)
      .innerJoin(eventParticipants, eq(eventBuyIns.eventParticipantId, eventParticipants.id))
      .where(eq(eventParticipants.eventId, eventId))

    // Convert the result to a number, or return 0 if it's null
    const total = result[0]?.total ? Number(result[0].total) : 0

    // Check if the parsed result is a valid number
    if (isNaN(total)) {
      console.error("Invalid sum result for event buy-ins")
      return 0
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
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
      where: eq(events.id, eventId),
    })

    if (!event) {
      throw new Error("Event not found")
    }

    // Find the eventParticipant
    const eventParticipant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, participantId)),
    })

    if (!eventParticipant) {
      throw new Error("Participant not found for this event")
    }

    // Check if a buy-in record already exists
    const existingBuyIn = await db.query.eventBuyIns.findFirst({
      where: eq(eventBuyIns.eventParticipantId, eventParticipant.id),
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
      await db.insert(eventBuyIns).values({
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

// Add this new server action to remove a participant from an event
export async function removeParticipantFromEvent(eventId: string, userId: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to remove participants")
  }

  // Check if the current user has admin or management permissions
  const userRole = await getUserRole(eventId)
  if (userRole !== "admin" && userRole !== "management") {
    throw new Error("You don't have permission to remove participants")
  }

  try {
    // Find the participant record
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)),
    })

    if (!participant) {
      throw new Error("Participant not found")
    }

    // Check if trying to remove an admin (only admins can remove other admins)
    if (participant.role === "admin" && userRole !== "admin") {
      throw new Error("Only admins can remove other admins")
    }

    // Remove the participant from any teams they might be in
    const teamMemberships = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, userId),
      with: {
        team: true,
      },
    })

    // Only remove from teams in this event
    for (const membership of teamMemberships) {
      if (membership.team.eventId === eventId) {
        await db.delete(teamMembers).where(eq(teamMembers.id, membership.id))
      }
    }

    // Remove any buy-ins
    await db.delete(eventBuyIns).where(eq(eventBuyIns.eventParticipantId, participant.id))

    // Remove the participant from the event
    await db.delete(eventParticipants).where(eq(eventParticipants.id, participant.id))

    revalidatePath(`/events/${eventId}/participants`)
    return { success: true }
  } catch (error) {
    console.error("Error removing participant:", error)
    throw error
  }
}

// Registration request management functions
export async function getRegistrationRequests(
  eventId: string,
  filters: {
    status?: "pending" | "approved" | "rejected"
    search?: string
  } = {},
): Promise<RegistrationRequest[]> {
  try {
    const session = await getServerAuthSession()
    if (!session || !session.user) {
      throw new Error("You must be logged in to view registration requests")
    }

    // Check if user is admin or management for this event
    const userRole = await getUserRole(eventId)
    if (userRole !== "admin" && userRole !== "management") {
      throw new Error("You don't have permission to view registration requests")
    }

    const query = db.query.eventRegistrationRequests.findMany({
      where: (reqs, { and, eq, like, or }) => {
        const conditions = [eq(reqs.eventId, eventId)]

        if (filters.status) {
          conditions.push(eq(reqs.status, filters.status))
        }

        return and(...conditions)
      },
      with: {
        user: true,
        event: true,
        reviewer: true,
      },
      orderBy: [desc(eventRegistrationRequests.createdAt)],
    })

    let requests = await query

    // Apply search filter in memory if provided
    if (filters.search && filters.search.trim() !== "") {
      const searchTerm = filters.search.toLowerCase()
      requests = requests.filter(
        (req) =>
          req.user.name?.toLowerCase().includes(searchTerm) ??
          req.user.email?.toLowerCase().includes(searchTerm) ??
          req.user.runescapeName?.toLowerCase().includes(searchTerm) ??
          req.message?.toLowerCase().includes(searchTerm),
      )
    }

    return requests
  } catch (error) {
    console.error("Error fetching registration requests:", error)
    throw new Error("Failed to fetch registration requests")
  }
}

export async function approveRegistrationRequest(requestId: string, responseMessage?: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to approve registration requests")
  }

  return await db.transaction(async (tx) => {
    // Get the request
    const request = await tx.query.eventRegistrationRequests.findFirst({
      where: eq(eventRegistrationRequests.id, requestId),
    })

    if (!request) {
      throw new Error("Registration request not found")
    }

    // Check if user is admin or management for this event
    const userRole = await getUserRole(request.eventId)
    if (userRole !== "admin" && userRole !== "management") {
      throw new Error("You don't have permission to approve registration requests")
    }

    // Update the request status
    await tx
      .update(eventRegistrationRequests)
      .set({
        status: "approved",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        responseMessage: responseMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrationRequests.id, requestId))

    // Add the user as a participant
    const existingParticipant = await tx.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, request.eventId), eq(eventParticipants.userId, request.userId)),
    })

    if (!existingParticipant) {
      await tx.insert(eventParticipants).values({
        eventId: request.eventId,
        userId: request.userId,
        role: "participant",
      })
    }

    revalidatePath(`/events/${request.eventId}`)
    revalidatePath(`/events/${request.eventId}/registrations`)

    return { success: true }
  })
}

export async function rejectRegistrationRequest(requestId: string, responseMessage?: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to reject registration requests")
  }

  // Get the request
  const request = await db.query.eventRegistrationRequests.findFirst({
    where: eq(eventRegistrationRequests.id, requestId),
  })

  if (!request) {
    throw new Error("Registration request not found")
  }

  // Check if user is admin or management for this event
  const userRole = await getUserRole(request.eventId)
  if (userRole !== "admin" && userRole !== "management") {
    throw new Error("You don't have permission to reject registration requests")
  }

  // Update the request status
  await db
    .update(eventRegistrationRequests)
    .set({
      status: "rejected",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      responseMessage: responseMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(eventRegistrationRequests.id, requestId))

  revalidatePath(`/events/${request.eventId}/registrations`)

  return { success: true }
}

export async function getUserRegistrationStatus(eventId: string): Promise<{
  status: "not_requested" | "pending" | "approved" | "rejected"
  message?: string
  responseMessage?: string
  eventTitle?: string
}> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { status: "not_requested" }
  }

  // Check if user is already a participant
  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, session.user.id)),
  })

  if (existingParticipant) {
    return { status: "approved" }
  }

  // Check for registration request
  const request = await db.query.eventRegistrationRequests.findFirst({
    where: and(eq(eventRegistrationRequests.eventId, eventId), eq(eventRegistrationRequests.userId, session.user.id)),
    orderBy: [desc(eventRegistrationRequests.createdAt)],
    with: {
      event: true,
    },
  })

  if (!request) {
    return { status: "not_requested" }
  }

  return {
    status: request.status,
    message: request.message ?? undefined,
    eventTitle: request.event.title,
    responseMessage: request.responseMessage ?? undefined,
  }
}

export async function getPendingRegistrationCount(eventId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventRegistrationRequests)
      .where(and(eq(eventRegistrationRequests.eventId, eventId), eq(eventRegistrationRequests.status, "pending")))
      .limit(1)

    return result[0]?.count ?? 0
  } catch (error) {
    console.error("Error counting pending registrations:", error)
    return 0
  }
}
