"use server"
import { db } from "@/server/db";
import { teams, teamMembers, eventParticipants, users } from "@/server/db/schema";
import { eq, and, not, exists } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createTeam(eventId: string, name: string) {
  const [team] = await db.insert(teams).values({ eventId, name }).returning();
  revalidatePath(`/events/${eventId}`);
  return team;
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
  });
  return eventTeams;
}

export async function addUserToTeam(teamId: string, userId: string) {
  const [member] = await db.insert(teamMembers).values({ teamId, userId }).returning();
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  });
  if (team) {
    revalidatePath(`/events/${team.event.id}`);
  }
  return member;
}

export async function removeUserFromTeam(teamId: string, userId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  });
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  if (team) {
    revalidatePath(`/events/${team.event.id}`);
  }
}

export async function deleteTeam(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  });
  await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  await db.delete(teams).where(eq(teams.id, teamId));
  if (team) {
    revalidatePath(`/events/${team.event.id}`);
  }
}

export async function getEventParticipants(eventId: string) {
  const participants = await db.select({
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
            db.select()
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
    );

  return participants;
}


export async function updateTeamMember(teamId: string, userId: string, isLeader: boolean) {
  const [updatedMember] = await db
    .update(teamMembers)
    .set({ isLeader })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .returning();

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { event: true },
  });
  if (team) {
    revalidatePath(`/events/${team.event.id}`);
  }
  return updatedMember;
}
