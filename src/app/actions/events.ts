"use server"

import { eq, and, asc, sql, desc, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

import { getServerAuthSession } from "@/server/auth"
import { limitAction } from "@/server/rate-limit"
import type { EventRole as AuthzEventRole } from "@/lib/authz/roles"
import {
  actionFailure,
  authorize,
  denial,
  failure,
  hasPermission,
  membershipFailure,
  type ActionResult,
} from "@/server/authz"
import { getBoardReadAccess, getEventReadAccessFor } from "@/server/authz/read"
import {
  addMember,
  changeRole,
  removeMember,
  transferOwnership,
} from "@/server/authz/membership"
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
  eventDonations,
  users,
  bingos,
  eventRegistrationRequests,
  submissions,
  submissionComments,
  teamTileSubmissions,
  teamGoalProgress,
  teamTierProgress,
  goalValues,
  itemGoals,
  goals,
  goalGroups,
  tierXpRequirements,
  rowBonuses,
  columnBonuses,
  playerMetadata,
  discordWebhooks,
  notifications,
  eventRules,
} from "@/server/db/schema"
import { isClanManager } from "@/lib/clan"
import { logger } from "@/lib/logger"
import { applyBlindBoard } from "@/server/blind-board"

import type { EventCapabilities } from "@/lib/authz/capabilities"
import type { Event } from "@/types/model"
import { UserFacingError } from "@/lib/user-facing-error"

export interface EventData {
  /** `role` is for display; decisions use `capabilities`. */
  event: Event & { role?: EventRole }
  /** What the viewer may do in this Event, computed on the server. */
  capabilities: EventCapabilities
  totalPrizePool: number

  participantData?: {
    team: {
      id: string
      name: string
      memberCount: number
    } | null
    progress: {
      completedTiles: number
      totalTiles: number
    } | null
  }

  managerData?: {
    actionItems: {
      pendingRegistrations: number
      pendingSubmissions: number
    }
    eventStats: {
      totalParticipants: number
      activeTeams: number
    }
  }
}

export interface GetEventByIdResult {
  event: Event
  userRole: EventRole | null
}

// A type alias, not a re-export: a "use server" file may only export async
// functions at runtime, and a re-export is not erased by the bundler.
export type EventRole = AuthzEventRole

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
    return {
      success: false,
      error: "You must be logged in to create an event",
    }
  }
  const limited = await limitAction("eventCreate", session.user.id)
  if (limited) return limited

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const gameType = (formData.get("gameType") as "osrs" | "rs3") || "osrs"
  const startDateStr = formData.get("startDate") as string
  const endDateStr = formData.get("endDate") as string
  const registrationDeadlineStr = formData.get("registrationDeadline") as string
  const timezone = (formData.get("timezone") as string) || "UTC"
  const bpp = formData.get("basePrizePool") as string
  const mbi = formData.get("minimumBuyIn") as string
  const requiresApproval = formData.get("requiresApproval") === "true"

  if (!title || !startDateStr || !endDateStr) {
    return { success: false, error: "Missing required fields" }
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  const registrationDeadline = registrationDeadlineStr
    ? new Date(registrationDeadlineStr)
    : null

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
    return {
      success: false,
      error: "Registration deadline must be before the event end date",
    }
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
          gameType,
          startDate,
          endDate,
          registrationDeadline,
          timezone,
          basePrizePool,
          minimumBuyIn,
          creatorId: session.user.id,
          requiresApproval,
        })
        .returning()

      // The creator is the owner and an admin participant.
      const added = await addMember({
        scope: "event",
        parentId: createdEvent!.id,
        userId: session.user.id,
        role: "admin",
        actor: { kind: "system", userId: session.user.id },
        reason: "event created",
        tx,
      })
      if (!added.success) throw new Error(added.error)

      return createdEvent
    })

    revalidatePath("/")

    if (newEvent) {
      logger.info(
        {
          eventId: newEvent.id,
          creatorId: session.user.id,
          gameType: newEvent.gameType,
          requiresApproval: newEvent.requiresApproval,
          basePrizePool: newEvent.basePrizePool,
          minimumBuyIn: newEvent.minimumBuyIn,
        },
        "Event created successfully"
      )
    }

    return { success: !!newEvent }
  } catch (error) {
    logger.error(
      { error, action: "createEvent", userId: session.user.id },
      "Error creating event"
    )
    return { success: false, error: "Failed to create event" }
  }
}

/** Never load a full users row for a response: it carries the username and verified email. */
const USER_PUBLIC_COLUMNS = {
  columns: {
    id: true,
    name: true,
    email: true,
    image: true,
    runescapeName: true,
  },
} as const

/** Subquery: the participant rows of one event. */
function eventParticipantIds(eventId: string) {
  return db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId))
}

export async function assignEventToClan(
  eventId: string,
  clanId: string
): Promise<ActionResult> {
  // Only an admin of the event may attach it to a clan (`event:assign-clan`),
  // and only to a clan in which they hold a managing role (a plain member or
  // guest must not be able to attach events to the clan).
  const allowed = await authorize(eventId, "event:assign-clan")
  if (!allowed.success) return denial(allowed)

  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true },
    })

    if (!event) return failure("Event not found", "NOT_FOUND")

    const userClanMembership = await db.query.clanMembers.findFirst({
      where: and(
        eq(clanMembers.clanId, clanId),
        eq(clanMembers.userId, allowed.actor.userId)
      ),
    })

    if (!userClanMembership || !isClanManager(userClanMembership.role)) {
      return failure(
        "You don't have permission to assign this event to a clan",
        "FORBIDDEN"
      )
    }

    // Assign the event to the clan
    await db
      .update(events)
      .set({ clanId: clanId })
      .where(eq(events.id, eventId))

    revalidatePath(`/events/${eventId}`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error, eventId, clanId }, "Error assigning event to clan")
    return actionFailure(error, "Failed to assign the event to the clan")
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
    timezone?: string
    minimumBuyIn: number
    basePrizePool: number
    locked?: boolean
    public?: boolean
    requiresApproval?: boolean
  }
): Promise<ActionResult> {
  const allowed = await authorize(eventId, "event:update")
  if (!allowed.success) return denial(allowed)

  try {
    await db
      .update(events)
      .set({
        title: eventData.title,
        description: eventData.description,
        startDate: new Date(eventData.startDate),
        endDate: new Date(eventData.endDate),
        registrationDeadline: eventData.registrationDeadline
          ? new Date(eventData.registrationDeadline)
          : null,
        timezone: eventData.timezone,
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

    logger.info(
      {
        eventId,
        action: "updateEvent",
        locked: eventData.locked,
        public: eventData.public,
        requiresApproval: eventData.requiresApproval,
        basePrizePool: eventData.basePrizePool,
        minimumBuyIn: eventData.minimumBuyIn,
      },
      "Event updated successfully"
    )

    return { success: true as const }
  } catch (error) {
    logger.error(
      { error, eventId, action: "updateEvent" },
      "Error updating event"
    )
    return actionFailure(error, "Failed to update event")
  }
}

/** Whether the caller may join despite a lock or a passed deadline. */
async function canOverrideRegistration(eventId: string): Promise<boolean> {
  return hasPermission(eventId, "event:override-registration")
}

export async function isRegistrationOpen(eventId: string): Promise<{
  isOpen: boolean
  reason?: string
  canOverride: boolean
  requiresApproval?: boolean
}> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return {
      isOpen: false,
      reason: "You must be logged in to join events",
      canOverride: false,
    }
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  })

  if (!event) {
    return { isOpen: false, reason: "Event not found", canOverride: false }
  }

  // Check if the user is already a participant
  const existingParticipant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (existingParticipant) {
    return {
      isOpen: false,
      reason: "You are already a participant in this event",
      canOverride: false,
    }
  }

  // Check if the user already has a pending registration request
  if (event.requiresApproval) {
    const existingRequest = await db.query.eventRegistrationRequests.findFirst({
      where: and(
        eq(eventRegistrationRequests.eventId, eventId),
        eq(eventRegistrationRequests.userId, session.user.id),
        eq(eventRegistrationRequests.status, "pending")
      ),
    })

    if (existingRequest) {
      return {
        isOpen: false,
        reason:
          "You already have a pending registration request for this event",
        canOverride: false,
        requiresApproval: true,
      }
    }
  }

  // Check if the event is locked
  if (event.locked) {
    return {
      isOpen: false,
      reason: "This event is locked for registration",
      canOverride: await canOverrideRegistration(eventId),
      requiresApproval: event.requiresApproval,
    }
  }

  // Check if registration deadline has passed
  if (
    event.registrationDeadline &&
    new Date() > new Date(event.registrationDeadline)
  ) {
    return {
      isOpen: false,
      reason: `Registration deadline (${new Date(event.registrationDeadline).toLocaleString()}) has passed`,
      canOverride: await canOverrideRegistration(eventId),
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

export async function requestToJoinEvent(
  eventId: string,
  message = ""
): Promise<ActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return failure(
      "You must be logged in to request to join an event",
      "UNAUTHENTICATED"
    )
  }

  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })

    if (!event) return failure("Event not found", "NOT_FOUND")

    if (!event.requiresApproval) {
      return failure("This event does not require approval to join", "INVALID")
    }

    // Check if registration is open
    const registrationStatus = await isRegistrationOpen(eventId)
    if (!registrationStatus.isOpen) {
      return failure(
        registrationStatus.reason ?? "Registration is closed for this event",
        "CONFLICT"
      )
    }

    // Check if the user already has a pending request
    const existingRequest = await db.query.eventRegistrationRequests.findFirst({
      where: and(
        eq(eventRegistrationRequests.eventId, eventId),
        eq(eventRegistrationRequests.userId, session.user.id),
        eq(eventRegistrationRequests.status, "pending")
      ),
    })

    if (existingRequest) {
      return failure(
        "You already have a pending request to join this event",
        "CONFLICT"
      )
    }

    // Create a new registration request
    await db.insert(eventRegistrationRequests).values({
      eventId,
      userId: session.user.id,
      status: "pending",
      message: message || null,
    })

    return { success: true as const }
  } catch (error) {
    logger.error({ error, eventId }, "Error requesting to join event")
    return actionFailure(error, "Failed to send the join request")
  }
}

export async function joinEvent(eventId: string, override = false) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "You must be logged in to join an event" }
  }

  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })

    if (!event) {
      return { success: false, error: "Event not found" }
    }

    // If the event requires approval and we're not overriding, redirect to request flow
    if (event.requiresApproval && !override) {
      return {
        success: false,
        error:
          "This event requires approval to join. Please submit a registration request.",
      }
    }

    // Skip registration checks if override is true and user is admin
    if (!override) {
      const registrationStatus = await isRegistrationOpen(eventId)

      if (!registrationStatus.isOpen) {
        return {
          success: false,
          error:
            registrationStatus.reason ??
            "Registration is closed for this event",
        }
      }
    } else {
      // If override is true, verify the user may override (the Event's admin)
      if (!(await hasPermission(eventId, "event:override-registration"))) {
        return {
          success: false,
          error:
            "You don't have permission to override registration restrictions",
          code: "FORBIDDEN",
        }
      }
    }

    const existingParticipant = await db.query.eventParticipants.findFirst({
      where: (ep, { and, eq }) =>
        and(eq(ep.eventId, eventId), eq(ep.userId, session.user.id)),
    })

    if (existingParticipant) {
      return {
        success: false,
        error: "You are already a participant in this event",
      }
    }

    // A concurrent join may have won the race: the unique (event, user) index
    // turns the second insert into ALREADY_MEMBER instead of a duplicate row.
    const joined = await addMember({
      scope: "event",
      parentId: eventId,
      userId: session.user.id,
      role: "participant",
      actor: { kind: "self", userId: session.user.id },
      reason: "joined the event",
    })
    if (!joined.success) {
      return {
        success: false,
        error:
          joined.code === "ALREADY_MEMBER"
            ? "You are already a participant in this event"
            : joined.error,
      }
    }

    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error joining event")
    return actionFailure(error, "Failed to join event")
  }
}

export async function generateEventInviteLink(
  eventId: string
): Promise<ActionResult<{ invite: typeof eventInvites.$inferSelect }>> {
  const allowed = await authorize(eventId, "event:invite")
  if (!allowed.success) return denial(allowed)
  const limited = await limitAction("inviteCreate", allowed.actor.userId)
  if (limited) return limited

  try {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })
    if (!event) return failure("Event does not exist!", "NOT_FOUND")

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

    if (!invite) return failure("Failed to generate the invite link")
    return { success: true as const, invite }
  } catch (error) {
    logger.error({ error, eventId }, "Error generating invite link")
    return actionFailure(error, "Failed to generate the invite link")
  }
}

export async function joinEventViaInvite(
  inviteCode: string
): Promise<
  ActionResult<{ event: typeof events.$inferSelect; pendingApproval: boolean }>
> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return failure("You must be logged in to join an event", "UNAUTHENTICATED")
  }
  const userId = session.user.id
  // Stops guessing of invite codes.
  const limited = await limitAction("inviteRedeem", userId)
  if (limited) return limited

  try {
    const invite = await db.query.eventInvites.findFirst({
      where: eq(eventInvites.inviteCode, inviteCode),
      with: {
        event: true,
      },
    })

    if (!invite || (invite.expiresAt && invite.expiresAt < new Date())) {
      return failure("Invalid or expired invite code", "NOT_FOUND")
    }

    const existingParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, invite.eventId),
        eq(eventParticipants.userId, userId)
      ),
    })

    if (existingParticipant) {
      return failure("You are already a participant in this event", "CONFLICT")
    }

    // If the event requires approval, create a registration request instead
    if (invite.event.requiresApproval) {
      await db.insert(eventRegistrationRequests).values({
        eventId: invite.eventId,
        userId,
        status: "pending",
        message: `Joined via invite code: ${inviteCode}`,
      })
      return {
        success: true as const,
        event: invite.event,
        pendingApproval: true,
      }
    }

    const joined = await addMember({
      scope: "event",
      parentId: invite.eventId,
      userId,
      role: "participant",
      actor: { kind: "self", userId },
      reason: "joined through an event invite",
    })
    if (!joined.success) {
      return failure(
        joined.code === "ALREADY_MEMBER"
          ? "You are already a participant in this event"
          : joined.error,
        joined.code === "ALREADY_MEMBER" ? "CONFLICT" : "FAILED"
      )
    }

    return {
      success: true as const,
      event: invite.event,
      pendingApproval: false,
    }
  } catch (error) {
    logger.error({ error }, "Error joining event via invite")
    return actionFailure(error, "Failed to join the event")
  }
}

export async function getEventParticipants(eventId: string) {
  // Carries buy-ins, donations and skill levels: managers only.
  // Deliberate: a denial reads as an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "participant:list"))) return []

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
          columns: { id: true, runescapeName: true },
        })

        // Get buy-in amount (if any)
        const buyInResult = await db
          .select({
            amount: sql<number>`COALESCE(${eventBuyIns.amount}, 0)`.as("buyIn"),
          })
          .from(eventBuyIns)
          .where(eq(eventBuyIns.eventParticipantId, participant.id))

        const buyIn = buyInResult[0]?.amount ?? 0

        // Get total donations for this participant
        const donationsResult = await db
          .select({
            total: sql<number>`COALESCE(SUM(${eventDonations.amount}), 0)`.as(
              "totalDonations"
            ),
          })
          .from(eventDonations)
          .where(eq(eventDonations.eventParticipantId, participant.id))

        const totalDonations = donationsResult[0]?.total ?? 0

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
          .innerJoin(
            teamMembers,
            and(
              eq(teamMembers.teamId, teams.id),
              eq(teamMembers.userId, participant.userId)
            )
          )
          .where(eq(teams.eventId, eventId))
          .limit(1)

        const t = team[0] ?? null
        // Only include team if it belongs to this event
        // const team = teamMember?.team.eventId === eventId ? teamMember.team : null

        // Get metadata (skillLevel)
        const metadata = await db.query.playerMetadata.findFirst({
          where: and(
            eq(playerMetadata.userId, participant.userId),
            eq(playerMetadata.eventId, eventId)
          ),
        })

        return {
          id: participant.userId,
          runescapeName:
            metadata?.runescapeNameOverride ?? user?.runescapeName ?? "",
          hasOverride: !!metadata?.runescapeNameOverride,
          originalRunescapeName: user?.runescapeName ?? "",
          role: participant.role,
          teamId: t != null ? t.id : null,
          teamName: t != null ? t.name : null,
          buyIn: buyIn,
          totalDonations: totalDonations,
          skillLevel: metadata?.skillLevel ?? null,
        }
      })
    )

    return participants
  } catch (error) {
    logger.error({ error }, "Error fetching event participants")
    throw new Error("Failed to fetch event participants")
  }
}

class ParticipantChangeError extends Error {}

export async function updateParticipantRole(
  eventId: string,
  userId: string,
  newRole: EventRole
): Promise<ActionResult> {
  // The caller is derived from the session, never from the target arguments.
  const allowed = await authorize(eventId, "participant:set-role")
  if (!allowed.success) return denial(allowed)

  try {
    // The helper locks the Event and re-checks the policy, the owner rules and
    // the last-admin rule under that lock.
    const result = await changeRole({
      scope: "event",
      parentId: eventId,
      userId,
      newRole,
      actor: { kind: "user", userId: allowed.actor.userId },
    })
    if (!result.success) {
      logger.warn(
        { code: result.code, eventId, userId, newRole },
        "Participant role change refused"
      )
      return membershipFailure(result)
    }
    revalidatePath(`/events/${eventId}/participants`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error, eventId, userId }, "Error updating participant role")
    return actionFailure(error, "Failed to update the participant role")
  }
}

/**
 * Hands the Event over to another participant (owner-only). The new owner
 * becomes `events.creator_id` and an admin; the previous owner stays an admin.
 */
export async function transferEventOwnership(
  eventId: string,
  newOwnerId: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized", code: "UNAUTHENTICATED" }
  }
  if (!eventId || !newOwnerId) {
    return { success: false, error: "Missing event or user", code: "INVALID" }
  }

  const result = await transferOwnership({
    scope: "event",
    parentId: eventId,
    newOwnerId,
    actor: { kind: "user", userId: session.user.id },
  })
  if (!result.success) {
    return { success: false, error: result.error, code: result.code }
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath(`/events/${eventId}/participants`)
  return { success: true as const }
}

export async function assignParticipantToTeam(
  eventId: string,
  userId: string,
  teamId: string
): Promise<ActionResult> {
  const allowed = await authorize(eventId, "participant:assign-team")
  if (!allowed.success) return denial(allowed)

  try {
    await db.transaction(async (tx) => {
      // The target must take part in this event.
      const participant = await tx.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId)
        ),
        columns: { id: true },
      })
      if (!participant) {
        throw new ParticipantChangeError("User is not a participant")
      }

      // Verify that the new team belongs to the correct event
      if (teamId) {
        const newTeam = await tx.query.teams.findFirst({
          where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
        })
        if (!newTeam) {
          throw new ParticipantChangeError("Invalid team for this event")
        }
      }

      // Remove the user from every team of this event (and only this event)
      const eventTeamIds = tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.eventId, eventId))
      await tx
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, userId),
            inArray(teamMembers.teamId, eventTeamIds)
          )
        )

      if (teamId) {
        await tx.insert(teamMembers).values({
          teamId,
          eventId,
          userId,
          isLeader: false,
        })
      }
    })
    revalidatePath(`/events/${eventId}/participants`)
    revalidatePath(`/events/${eventId}`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error assigning participant to team")
    if (error instanceof ParticipantChangeError) {
      return failure(error.message, "INVALID")
    }
    return actionFailure(error, "Failed to assign participant to team")
  }
}

export async function updateParticipantBuyIn(
  eventId: string,
  participantId: string,
  hasPaid: boolean
): Promise<ActionResult<{ buyInAmount: number }>> {
  const allowed = await authorize(eventId, "finance:write")
  if (!allowed.success) return denial(allowed)

  try {
    const buyInAmount = await db.transaction(async (tx) => {
      // First, get the minimum buy-in for the event
      const event = await tx.query.events.findFirst({
        where: eq(events.id, eventId),
      })

      if (!event) {
        throw new UserFacingError("Event not found")
      }

      // Find the eventParticipant
      const eventParticipant = await tx.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, participantId)
        ),
      })

      if (!eventParticipant) {
        throw new UserFacingError("Participant not found for this event")
      }

      // Calculate buy-in amount: use minimum buy-in if paid, 0 if not paid
      const amount = hasPaid ? event.minimumBuyIn : 0

      // Check if a buy-in record already exists
      const existingBuyIn = await tx.query.eventBuyIns.findFirst({
        where: eq(eventBuyIns.eventParticipantId, eventParticipant.id),
      })

      if (existingBuyIn) {
        // Update existing record
        await tx
          .update(eventBuyIns)
          .set({
            amount: amount,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(eventBuyIns.id, existingBuyIn.id))
      } else {
        // Insert new record only if they're paying
        if (hasPaid) {
          await tx.insert(eventBuyIns).values({
            eventParticipantId: eventParticipant.id,
            amount: amount,
          })
        }
      }
      return amount
    })

    revalidatePath(`/events/${eventId}`)
    revalidatePath(`/`)

    return { success: true as const, buyInAmount }
  } catch (error) {
    logger.error({ error }, "Error updating participant buy-in:", error)
    return error instanceof UserFacingError
      ? failure(error.message)
      : actionFailure(error, "Failed to update participant buy-in")
  }
}

// Add this new server action to remove a participant from an event
export async function removeParticipantFromEvent(
  eventId: string,
  userId: string
): Promise<ActionResult> {
  const allowed = await authorize(eventId, "participant:remove")
  if (!allowed.success) return denial(allowed)

  try {
    // Also removes the participant's Team places, buy-ins and donations.
    const removed = await removeMember({
      scope: "event",
      parentId: eventId,
      userId,
      actor: { kind: "user", userId: allowed.actor.userId },
    })
    if (!removed.success) return membershipFailure(removed)

    revalidatePath(`/events/${eventId}/participants`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error removing participant:", error)
    return actionFailure(error, "Failed to remove participant")
  }
}

/**
 * Add clan members to an event as participants
 * Only available for events associated with a clan
 */
export async function addClanMembersToEvent(
  eventId: string,
  userIds: string[]
): Promise<
  ActionResult<{ added: number; skipped: number; skippedUsers: string[] }>
> {
  const allowed = await authorize(eventId, "participant:add", {
    newRole: "participant",
  })
  if (!allowed.success) return denial(allowed)

  try {
    // Get the event and verify it has a clan
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: {
        id: true,
        clanId: true,
      },
    })

    if (!event) {
      return { success: false, error: "Event not found" }
    }

    if (!event.clanId) {
      return {
        success: false,
        error: "Event is not associated with a clan",
      }
    }

    // Verify all users are members of the clan
    const clanMemberships = await db
      .select({ userId: clanMembers.userId })
      .from(clanMembers)
      .where(
        and(
          eq(clanMembers.clanId, event.clanId),
          sql`${clanMembers.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )

    const validUserIds = clanMemberships.map((m) => m.userId)
    const invalidUserIds = userIds.filter((id) => !validUserIds.includes(id))

    if (invalidUserIds.length > 0) {
      return {
        success: false,
        error: "Some users are not members of the clan",
      }
    }

    // Check which users are already participants
    const existingParticipants = await db
      .select({
        userId: eventParticipants.userId,
        userName: users.name,
      })
      .from(eventParticipants)
      .innerJoin(users, eq(eventParticipants.userId, users.id))
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          sql`${eventParticipants.userId} IN (${sql.join(
            userIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )

    const existingUserIds = existingParticipants.map((p) => p.userId)
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id))

    // Add new participants, all or none
    if (newUserIds.length > 0) {
      await db.transaction(async (tx) => {
        for (const userId of newUserIds) {
          const added = await addMember({
            scope: "event",
            parentId: eventId,
            userId,
            role: "participant",
            actor: { kind: "user", userId: allowed.actor.userId },
            reason: "added from the event's clan",
            tx,
          })
          // A concurrent join is not an error.
          if (!added.success && added.code !== "ALREADY_MEMBER") {
            throw new Error(added.error)
          }
        }
      })
    }

    revalidatePath(`/events/${eventId}/participants`)

    // Build response message
    const added = newUserIds.length
    const skipped = existingUserIds.length
    const skippedUsers = existingParticipants.map(
      (p) => p.userName ?? "Unknown"
    )

    return {
      success: true as const,
      added,
      skipped,
      skippedUsers,
    }
  } catch (error) {
    logger.error({ error }, "Error adding clan members to event")
    return actionFailure(error, "Failed to add clan members to event")
  }
}

// Registration request management functions
export async function getRegistrationRequests(
  eventId: string,
  filters: {
    status?: "pending" | "approved" | "rejected"
    search?: string
  } = {}
): Promise<RegistrationRequest[]> {
  // Deliberate: a denial reads as an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "registration:review"))) return []

  try {
    const query = db.query.eventRegistrationRequests.findMany({
      where: (reqs, { and, eq }) => {
        const conditions = [eq(reqs.eventId, eventId)]

        if (filters.status) {
          conditions.push(eq(reqs.status, filters.status))
        }

        return and(...conditions)
      },
      with: {
        user: USER_PUBLIC_COLUMNS,
        event: true,
        reviewer: USER_PUBLIC_COLUMNS,
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
          req.message?.toLowerCase().includes(searchTerm)
      )
    }

    return requests
  } catch (error) {
    logger.error({ error }, "Error fetching registration requests:", error)
    throw new Error("Failed to fetch registration requests")
  }
}

export async function approveRegistrationRequest(
  requestId: string,
  responseMessage?: string
): Promise<ActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return failure(
      "You must be logged in to approve registration requests",
      "UNAUTHENTICATED"
    )
  }
  const reviewerId = session.user.id

  try {
    return await db.transaction(async (tx) => {
      // Get the request
      const request = await tx.query.eventRegistrationRequests.findFirst({
        where: eq(eventRegistrationRequests.id, requestId),
      })

      if (!request) {
        return failure("Registration request not found", "NOT_FOUND")
      }

      // The Event comes from the request, never from the client.
      const allowed = await authorize(request.eventId, "registration:review")
      if (!allowed.success) return denial(allowed)

      // Update the request status
      await tx
        .update(eventRegistrationRequests)
        .set({
          status: "approved",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          responseMessage: responseMessage ?? null,
          updatedAt: new Date(),
        })
        .where(eq(eventRegistrationRequests.id, requestId))

      // Add the user as a participant
      const existingParticipant = await tx.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, request.eventId),
          eq(eventParticipants.userId, request.userId)
        ),
      })

      if (!existingParticipant) {
        const added = await addMember({
          scope: "event",
          parentId: request.eventId,
          userId: request.userId,
          role: "participant",
          actor: { kind: "user", userId: reviewerId },
          reason: "registration request approved",
          tx,
        })
        if (!added.success && added.code !== "ALREADY_MEMBER") {
          throw new Error(added.error)
        }
      }

      revalidatePath(`/events/${request.eventId}`)
      revalidatePath(`/events/${request.eventId}/registrations`)

      return { success: true as const }
    })
  } catch (error) {
    logger.error({ error, requestId }, "Error approving registration request")
    return actionFailure(error, "Failed to approve the registration request")
  }
}

export async function rejectRegistrationRequest(
  requestId: string,
  responseMessage?: string
): Promise<ActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return failure(
      "You must be logged in to reject registration requests",
      "UNAUTHENTICATED"
    )
  }

  try {
    const request = await db.query.eventRegistrationRequests.findFirst({
      where: eq(eventRegistrationRequests.id, requestId),
    })
    if (!request) {
      return failure("Registration request not found", "NOT_FOUND")
    }

    const allowed = await authorize(request.eventId, "registration:review")
    if (!allowed.success) return denial(allowed)

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

    return { success: true as const }
  } catch (error) {
    logger.error({ error, requestId }, "Error rejecting registration request")
    return actionFailure(error, "Failed to reject the registration request")
  }
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
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (existingParticipant) {
    return { status: "approved" }
  }

  // Check for registration request
  const request = await db.query.eventRegistrationRequests.findFirst({
    where: and(
      eq(eventRegistrationRequests.eventId, eventId),
      eq(eventRegistrationRequests.userId, session.user.id),
      // Only surface a pending request — rejected or previously-approved-then-kicked
      // users should be treated as "not_requested" so they can re-apply or accept invites.
      eq(eventRegistrationRequests.status, "pending")
    ),
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

export async function getPendingRegistrationCount(
  eventId: string
): Promise<number> {
  // Deliberate: a denial reads as zero (see guards.ts).
  if (!(await hasPermission(eventId, "registration:review"))) return 0

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventRegistrationRequests)
      .where(
        and(
          eq(eventRegistrationRequests.eventId, eventId),
          eq(eventRegistrationRequests.status, "pending")
        )
      )
      .limit(1)

    return Number(result[0]?.count ?? 0)
  } catch (error) {
    logger.error({ error }, "Error counting pending registrations:", error)
    return 0
  }
}

// Donation management functions
export async function addParticipantDonation(
  eventId: string,
  participantId: string,
  amount: number,
  description?: string
): Promise<ActionResult<{ data: typeof eventDonations.$inferSelect }>> {
  const allowed = await authorize(eventId, "finance:write")
  if (!allowed.success) return denial(allowed)

  try {
    // Find the eventParticipant
    const eventParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, participantId)
      ),
    })

    if (!eventParticipant) {
      return failure("Participant not found for this event", "NOT_FOUND")
    }

    // Insert new donation record
    const [donation] = await db
      .insert(eventDonations)
      .values({
        eventParticipantId: eventParticipant.id,
        amount,
        description,
      })
      .returning()

    revalidatePath(`/events/${eventId}/participants`)
    revalidatePath(`/events/${eventId}`)

    return { success: true as const, data: donation! }
  } catch (error) {
    logger.error({ error }, "Error adding donation:", error)
    return actionFailure(error, "Failed to add the donation")
  }
}

export async function updateParticipantDonation(
  eventId: string,
  donationId: string,
  amount: number,
  description?: string
): Promise<ActionResult<{ data: typeof eventDonations.$inferSelect }>> {
  const allowed = await authorize(eventId, "finance:write")
  if (!allowed.success) return denial(allowed)

  try {
    // Scoped to this event: a manager can't touch another event's donations
    const [donation] = await db
      .update(eventDonations)
      .set({
        amount,
        description,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(eventDonations.id, donationId),
          inArray(
            eventDonations.eventParticipantId,
            eventParticipantIds(eventId)
          )
        )
      )
      .returning()

    if (!donation) return failure("Donation not found", "NOT_FOUND")

    revalidatePath(`/events/${eventId}/participants`)
    revalidatePath(`/events/${eventId}`)

    return { success: true as const, data: donation }
  } catch (error) {
    logger.error({ error }, "Error updating donation:", error)
    return actionFailure(error, "Failed to update the donation")
  }
}

export async function removeParticipantDonation(
  eventId: string,
  donationId: string
): Promise<ActionResult> {
  const allowed = await authorize(eventId, "finance:write")
  if (!allowed.success) return denial(allowed)

  try {
    // Remove donation record
    // Scoped to this event: a manager can't touch another event's donations
    const removed = await db
      .delete(eventDonations)
      .where(
        and(
          eq(eventDonations.id, donationId),
          inArray(
            eventDonations.eventParticipantId,
            eventParticipantIds(eventId)
          )
        )
      )
      .returning({ id: eventDonations.id })
    if (removed.length === 0) return failure("Donation not found", "NOT_FOUND")

    revalidatePath(`/events/${eventId}/participants`)
    revalidatePath(`/events/${eventId}`)

    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error removing donation:", error)
    return actionFailure(error, "Failed to remove the donation")
  }
}

export async function getParticipantDonations(
  eventId: string,
  participantId: string
) {
  // Deliberate: a denial reads as an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "finance:read"))) return []

  try {
    // Find the eventParticipant
    const eventParticipant = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.userId, participantId)
      ),
    })

    if (!eventParticipant) {
      return []
    }

    // Get all donations for this participant
    const donations = await db.query.eventDonations.findMany({
      where: eq(eventDonations.eventParticipantId, eventParticipant.id),
      orderBy: [desc(eventDonations.createdAt)],
    })

    return donations
  } catch (error) {
    logger.error({ error }, "Error fetching participant donations:", error)
    return []
  }
}

export async function calculateEventPrizePool(eventId: string) {
  // The prize pool is on the public Event page too: anybody who may read the
  // Event content may read it; everybody else gets the empty result.
  if (!(await getEventReadAccessFor(eventId, "content"))) {
    return {
      basePrizePool: 0,
      totalBuyIns: 0,
      totalDonations: 0,
      totalPrizePool: 0,
    }
  }

  try {
    // Get base prize pool from event
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })

    if (!event) {
      throw new Error("Event not found")
    }

    const basePrizePool = event.basePrizePool

    // Calculate total buy-ins
    const buyInsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${eventBuyIns.amount}), 0)`,
      })
      .from(eventBuyIns)
      .innerJoin(
        eventParticipants,
        eq(eventBuyIns.eventParticipantId, eventParticipants.id)
      )
      .where(eq(eventParticipants.eventId, eventId))

    const totalBuyIns = Number(buyInsResult[0]?.total ?? 0)

    // Calculate total donations
    const donationsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${eventDonations.amount}), 0)`,
      })
      .from(eventDonations)
      .innerJoin(
        eventParticipants,
        eq(eventDonations.eventParticipantId, eventParticipants.id)
      )
      .where(eq(eventParticipants.eventId, eventId))

    const totalDonations = Number(donationsResult[0]?.total ?? 0)

    const totalPrizePool = basePrizePool + totalBuyIns + totalDonations

    const all = {
      basePrizePool,
      totalBuyIns,
      totalDonations,
      totalPrizePool,
    }
    // console.table(all);
    return all
  } catch (error) {
    logger.error({ error }, "Error calculating event prize pool:", error)
    return {
      basePrizePool: 0,
      totalBuyIns: 0,
      totalDonations: 0,
      totalPrizePool: 0,
    }
  }
}

/**
 * Delete an event and all associated data (admin only)
 *
 * This function performs a complete cascade deletion of an event and all related records.
 * Only event administrators (creators or users with admin role) can delete events.
 *
 * Note: Pre-deletion notifications are not implemented because the notifications table
 * schema requires tileId and teamId (both notNull), making it impossible to create
 * event-level notifications without schema changes.
 *
 * @param eventId - The ID of the event to delete
 * @returns Promise with success status and optional error message
 */
export async function deleteEventByAdmin(
  eventId: string
): Promise<ActionResult> {
  // Deleting an Event is owner-only (the creator, or the oldest admin of an
  // Event whose creator account is gone).
  const allowed = await authorize(eventId, "event:delete")
  if (!allowed.success) {
    return failure(
      allowed.code === "FORBIDDEN"
        ? "Only the event owner can delete this event"
        : allowed.error,
      allowed.code
    )
  }

  try {
    // Get event details for validation
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        bingos: true,
      },
    })

    if (!event) {
      return { success: false, error: "Event not found" }
    }

    // Perform deletion in transaction for atomicity
    await db.transaction(async (tx) => {
      // Level 6 (deepest dependencies) - Delete submission comments
      await tx.delete(submissionComments).where(
        sql`${submissionComments.submissionId} IN (
          SELECT ${submissions.id} FROM ${submissions}
          WHERE ${submissions.teamTileSubmissionId} IN (
            SELECT ${teamTileSubmissions.id} FROM ${teamTileSubmissions}
            WHERE ${teamTileSubmissions.tileId} IN (
              SELECT ${tiles.id} FROM ${tiles}
              WHERE ${tiles.bingoId} IN (
                SELECT ${bingos.id} FROM ${bingos}
                WHERE ${bingos.eventId} = ${eventId}
              )
            )
          )
        )`
      )

      // Delete notifications related to this event
      // Note: This will cascade delete via foreign key constraints
      await tx.delete(notifications).where(eq(notifications.eventId, eventId))

      // Level 5 - Delete submissions
      await tx.delete(submissions).where(
        sql`${submissions.teamTileSubmissionId} IN (
          SELECT ${teamTileSubmissions.id} FROM ${teamTileSubmissions}
          WHERE ${teamTileSubmissions.tileId} IN (
            SELECT ${tiles.id} FROM ${tiles}
            WHERE ${tiles.bingoId} IN (
              SELECT ${bingos.id} FROM ${bingos}
              WHERE ${bingos.eventId} = ${eventId}
            )
          )
        )`
      )

      // Delete team goal progress
      await tx.delete(teamGoalProgress).where(
        sql`${teamGoalProgress.goalId} IN (
          SELECT ${goals.id} FROM ${goals}
          WHERE ${goals.tileId} IN (
            SELECT ${tiles.id} FROM ${tiles}
            WHERE ${tiles.bingoId} IN (
              SELECT ${bingos.id} FROM ${bingos}
              WHERE ${bingos.eventId} = ${eventId}
            )
          )
        )`
      )

      // Delete team tier progress
      await tx.delete(teamTierProgress).where(
        sql`${teamTierProgress.bingoId} IN (
          SELECT ${bingos.id} FROM ${bingos}
          WHERE ${bingos.eventId} = ${eventId}
        )`
      )

      // Level 4 - Delete team tile submissions
      await tx.delete(teamTileSubmissions).where(
        sql`${teamTileSubmissions.tileId} IN (
          SELECT ${tiles.id} FROM ${tiles}
          WHERE ${tiles.bingoId} IN (
            SELECT ${bingos.id} FROM ${bingos}
            WHERE ${bingos.eventId} = ${eventId}
          )
        )`
      )

      // Delete event buy-ins (through eventParticipants)
      await tx.delete(eventBuyIns).where(
        sql`${eventBuyIns.eventParticipantId} IN (
          SELECT ${eventParticipants.id} FROM ${eventParticipants}
          WHERE ${eventParticipants.eventId} = ${eventId}
        )`
      )

      // Delete event donations (through eventParticipants)
      await tx.delete(eventDonations).where(
        sql`${eventDonations.eventParticipantId} IN (
          SELECT ${eventParticipants.id} FROM ${eventParticipants}
          WHERE ${eventParticipants.eventId} = ${eventId}
        )`
      )

      // Level 3 - Delete goal values
      await tx.delete(goalValues).where(
        sql`${goalValues.goalId} IN (
          SELECT ${goals.id} FROM ${goals}
          WHERE ${goals.tileId} IN (
            SELECT ${tiles.id} FROM ${tiles}
            WHERE ${tiles.bingoId} IN (
              SELECT ${bingos.id} FROM ${bingos}
              WHERE ${bingos.eventId} = ${eventId}
            )
          )
        )`
      )

      // Delete item goals
      await tx.delete(itemGoals).where(
        sql`${itemGoals.goalId} IN (
          SELECT ${goals.id} FROM ${goals}
          WHERE ${goals.tileId} IN (
            SELECT ${tiles.id} FROM ${tiles}
            WHERE ${tiles.bingoId} IN (
              SELECT ${bingos.id} FROM ${bingos}
              WHERE ${bingos.eventId} = ${eventId}
            )
          )
        )`
      )

      // Delete goals (must be after goalValues and itemGoals)
      await tx.delete(goals).where(
        sql`${goals.tileId} IN (
          SELECT ${tiles.id} FROM ${tiles}
          WHERE ${tiles.bingoId} IN (
            SELECT ${bingos.id} FROM ${bingos}
            WHERE ${bingos.eventId} = ${eventId}
          )
        )`
      )

      // Delete goal groups
      await tx.delete(goalGroups).where(
        sql`${goalGroups.tileId} IN (
          SELECT ${tiles.id} FROM ${tiles}
          WHERE ${tiles.bingoId} IN (
            SELECT ${bingos.id} FROM ${bingos}
            WHERE ${bingos.eventId} = ${eventId}
          )
        )`
      )

      // Delete team members
      await tx.delete(teamMembers).where(
        sql`${teamMembers.teamId} IN (
          SELECT ${teams.id} FROM ${teams}
          WHERE ${teams.eventId} = ${eventId}
        )`
      )

      // Level 2 - Delete tiles
      await tx.delete(tiles).where(
        sql`${tiles.bingoId} IN (
          SELECT ${bingos.id} FROM ${bingos}
          WHERE ${bingos.eventId} = ${eventId}
        )`
      )

      // Delete tier XP requirements
      await tx.delete(tierXpRequirements).where(
        sql`${tierXpRequirements.bingoId} IN (
          SELECT ${bingos.id} FROM ${bingos}
          WHERE ${bingos.eventId} = ${eventId}
        )`
      )

      // Delete row bonuses
      await tx.delete(rowBonuses).where(
        sql`${rowBonuses.bingoId} IN (
          SELECT ${bingos.id} FROM ${bingos}
          WHERE ${bingos.eventId} = ${eventId}
        )`
      )

      // Delete column bonuses
      await tx.delete(columnBonuses).where(
        sql`${columnBonuses.bingoId} IN (
          SELECT ${bingos.id} FROM ${bingos}
          WHERE ${bingos.eventId} = ${eventId}
        )`
      )

      // Delete teams
      await tx.delete(teams).where(eq(teams.eventId, eventId))

      // The participants go with the Event itself (ON DELETE CASCADE); the
      // membership trigger skips cascades of a vanished Event.

      // Delete registration requests
      await tx
        .delete(eventRegistrationRequests)
        .where(eq(eventRegistrationRequests.eventId, eventId))

      // Delete event invites
      await tx.delete(eventInvites).where(eq(eventInvites.eventId, eventId))

      // Delete player metadata
      await tx.delete(playerMetadata).where(eq(playerMetadata.eventId, eventId))

      // Delete Discord webhooks
      await tx
        .delete(discordWebhooks)
        .where(eq(discordWebhooks.eventId, eventId))

      // Level 1 - Delete bingos
      await tx.delete(bingos).where(eq(bingos.eventId, eventId))

      // Level 0 - Finally delete the event itself
      await tx.delete(events).where(eq(events.id, eventId))
    })

    // Revalidate cache paths
    revalidatePath("/")
    revalidatePath("/events")

    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error deleting event:", error)
    return actionFailure(error, "Failed to delete event")
  }
}

// ─── Event Rules ────────────────────────────────────────────────────────────

export interface EventRule {
  id: string
  eventId: string
  content: string
  orderIndex: number
  createdAt: Date
  updatedAt: Date
}

export async function getEventRules(eventId: string): Promise<EventRule[]> {
  // Participants (and managers) read the rules. Deliberate: a denial reads as
  // an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "event:view"))) return []

  return db.query.eventRules.findMany({
    where: eq(eventRules.eventId, eventId),
    orderBy: asc(eventRules.orderIndex),
  })
}

export async function createEventRule(
  eventId: string,
  content: string
): Promise<ActionResult<{ rule: EventRule }>> {
  try {
    const allowed = await authorize(eventId, "event:manage-rules")
    if (!allowed.success) return denial(allowed)

    const trimmed = content.trim()
    if (!trimmed)
      return { success: false, error: "Rule content cannot be empty" }
    if (trimmed.length > 500)
      return { success: false, error: "Rule cannot exceed 500 characters" }

    // Determine next orderIndex
    const existing = await db.query.eventRules.findMany({
      where: eq(eventRules.eventId, eventId),
      orderBy: desc(eventRules.orderIndex),
      limit: 1,
    })
    const nextIndex = existing.length > 0 ? existing[0]!.orderIndex + 1 : 0

    const [rule] = await db
      .insert(eventRules)
      .values({ eventId, content: trimmed, orderIndex: nextIndex })
      .returning()

    revalidatePath(`/events/${eventId}`)
    return { success: true as const, rule: rule! }
  } catch (error) {
    logger.error({ error }, "Error creating event rule")
    return { success: false, error: "Failed to create rule" }
  }
}

export async function updateEventRule(
  ruleId: string,
  eventId: string,
  content: string
): Promise<ActionResult> {
  try {
    const allowed = await authorize(eventId, "event:manage-rules")
    if (!allowed.success) return denial(allowed)

    const trimmed = content.trim()
    if (!trimmed)
      return { success: false, error: "Rule content cannot be empty" }
    if (trimmed.length > 500)
      return { success: false, error: "Rule cannot exceed 500 characters" }

    await db
      .update(eventRules)
      .set({ content: trimmed, updatedAt: new Date() })
      .where(and(eq(eventRules.id, ruleId), eq(eventRules.eventId, eventId)))

    revalidatePath(`/events/${eventId}`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error updating event rule")
    return { success: false, error: "Failed to update rule" }
  }
}

export async function deleteEventRule(
  ruleId: string,
  eventId: string
): Promise<ActionResult> {
  try {
    const allowed = await authorize(eventId, "event:manage-rules")
    if (!allowed.success) return denial(allowed)

    await db
      .delete(eventRules)
      .where(and(eq(eventRules.id, ruleId), eq(eventRules.eventId, eventId)))

    revalidatePath(`/events/${eventId}`)
    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error deleting event rule")
    return { success: false, error: "Failed to delete rule" }
  }
}

/**
 * The Tiles of a Board for the mini board: id, position, title and image, plus
 * whether the viewer's own Team completed them. The viewer must be able to read
 * the Board (a visible Board of an Event they may read, any Board for
 * managers); hidden Tiles keep their cell but lose their content, and a
 * battleship Board is blind until its Event starts.
 */
export async function getMiniBoardTiles(bingoId: string) {
  const boardAccess = await getBoardReadAccess(bingoId)
  if (!boardAccess) return []

  const session = await getServerAuthSession()
  const { eventId } = boardAccess.board
  const callerIsManager = boardAccess.isManager

  const userTeam = session?.user
    ? await db
        .select({ teamId: teams.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(
          and(
            eq(teamMembers.userId, session.user.id),
            eq(teams.eventId, eventId)
          )
        )
        .limit(1)
    : []

  const teamId = userTeam[0]?.teamId

  const rawTiles = await db.query.tiles.findMany({
    where: eq(tiles.bingoId, bingoId),
    columns: {
      id: true,
      index: true,
      isHidden: true,
      title: true,
      headerImage: true,
    },
    orderBy: (tiles, { asc }) => [asc(tiles.index)],
  })

  // Hidden Tiles keep their grid cell but never leak their content, and a
  // battleship Board is blind until its Event starts.
  const allTiles = applyBlindBoard(
    rawTiles.map((tile) =>
      tile.isHidden && !callerIsManager
        ? { ...tile, title: "", headerImage: null }
        : tile
    ),
    boardAccess.blind
  )

  if (!teamId) {
    return allTiles.map((tile) => ({
      ...tile,
      isCompleted: false,
    }))
  }

  const submissions = await db.query.teamTileSubmissions.findMany({
    where: eq(teamTileSubmissions.teamId, teamId),
    columns: {
      tileId: true,
      status: true,
    },
  })

  const submissionMap = new Map(submissions.map((s) => [s.tileId, s.status]))

  return allTiles.map((tile) => {
    const status = submissionMap.get(tile.id) || "none"
    return {
      ...tile,
      isCompleted: status === "completed",
    }
  })
}
