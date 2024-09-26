'use server'
import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { events, bingos, tiles, eventParticipants, clanMembers } from "@/server/db/schema";
import { UUID } from "crypto";
import { eq, and, inArray, or, asc } from "drizzle-orm";

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
    await db.insert(events).values({
      title: title,
      description: description || '',
      startDate,
      endDate,
      creatorId: session.user.id,
    })

    return { success: true }
  } catch (error) {
    console.error("Error creating event:", error)
    return { success: false, error: "Failed to create event" }
  }
}

export async function getEventWithBingos(eventId: UUID, userId: UUID) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      bingos: {
        with: {
          tiles: {
            orderBy: [asc(tiles.index)],
          },
        },
      },
      clan: true,
    },
  });

  if (!event) {
    return null;
  }

  const isEventAdmin = event.creatorId === userId;

  return {
    event,
    bingos: event.bingos,
    isEventAdmin,
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
    role: 'user',
  });

  return { success: true };
}
