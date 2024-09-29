'use server'

import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { clans, clanMembers, users, events } from "@/server/db/schema";
import { eq, and, count, sql } from "drizzle-orm";

export async function createClan(name: string, description: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to create a clan");
  }

  const newClan = await db.transaction(async (tx) => {
    const [clan] = await tx.insert(clans).values({
      name,
      description,
      ownerId: session.user.id,
    }).returning();

    await tx.insert(clanMembers).values({
      clanId: clan!.id,
      userId: session.user.id,
      isMain: true,
      role: 'admin'
    });

    return clan;
  });

  return newClan;
}

export async function joinClan(clanId: string, isMain = false) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to join a clan");
  }

  if (isMain) {
    const existingMainClan = await db.select().from(clanMembers)
      .where(and(eq(clanMembers.userId, session.user.id), eq(clanMembers.isMain, true)))
      .limit(1);

    if (existingMainClan.length > 0) {
      throw new Error("You already have a main clan");
    }
  }

  await db.insert(clanMembers).values({
    clanId,
    userId: session.user.id,
    isMain,
  });

  return { success: true };
}

export async function leaveClan(clanId: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to leave a clan");
  }

  const clan = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clan[0]!.ownerId === session.user.id) {
    throw new Error("Clan owner cannot leave the clan");
  }

  await db.delete(clanMembers)
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, session.user.id)));

  return { success: true };
}

export async function getUserClans() {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to view your clans");
  }

  const userClans = await db.select({
    clan: clans,
    isMain: clanMembers.isMain,
    owner: users,
    memberCount: count(clanMembers.id),
  })
    .from(clans)
    .innerJoin(clanMembers, eq(clans.id, clanMembers.clanId))
    .innerJoin(users, eq(users.id, clans.ownerId))
    .where(eq(clanMembers.userId, session.user.id))
    .groupBy(clans.id, clanMembers.isMain, users.id);

  return userClans;
}

export async function getClanEvents(clanId: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to view clan events");
  }

  // Check if the user is a member of the clan
  const userMembership = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.clanId, clanId),
      eq(clanMembers.userId, session.user.id)
    ),
  });

  if (!userMembership) {
    throw new Error("You are not a member of this clan");
  }

  const clanEvents = await db.query.events.findMany({
    where: eq(events.clanId, clanId),
    with: {
      creator: true,
      eventParticipants: {
        columns: {
          userId: true,
        },
      },
    },
    orderBy: (events, { desc }) => [desc(events.startDate)],
  });

  return clanEvents;
}

export async function getClanDetails(clanId: string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("You must be logged in to view clan details");
  }

  const userMembership = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.clanId, clanId),
      eq(clanMembers.userId, session.user.id)
    ),
  });

  if (!userMembership) {
    throw new Error("You are not a member of this clan");
  }

  const clanDetails = await db.select({
    id: clans.id,
    name: clans.name,
    description: clans.description,
    ownerId: clans.ownerId,
    memberCount: count(clanMembers.id),
    eventCount: count(events.id),
  })
    .from(clans)
    .leftJoin(clanMembers, eq(clans.id, clanMembers.clanId))
    .leftJoin(events, eq(clans.id, events.clanId))
    .where(eq(clans.id, clanId))
    .groupBy(clans.id)
    .limit(1);

  if (clanDetails.length === 0) {
    throw new Error("Clan not found");
  }

  const owner = await db.query.users.findFirst({
    where: eq(users.id, clanDetails[0]!.ownerId),
    columns: {
      id: true,
      name: true,
      image: true,
      runescapeName: true
    },
  });

  return {
    ...clanDetails[0],
    userMembership,
    owner,
  };
}

export async function getClanMembers(clanId: string) {
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
      role: clanMembers.role,
    })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .where(eq(clanMembers.clanId, clanId))
    .orderBy(
      sql`CASE 
        WHEN ${clanMembers.role} = 'admin' THEN 1
        WHEN ${clanMembers.role} = 'management' THEN 2
        WHEN ${clanMembers.role} = 'member' THEN 3
        WHEN ${clanMembers.role} = 'guest' THEN 4
        ELSE 5
      END`
    );

  return members;
}

export async function updateMemberRole(clanId: string, memberId: string, newRole: 'admin' | 'management' | 'member' | 'guest') {
  await db.update(clanMembers)
    .set({ role: newRole })
    .where(
      and(
        eq(clanMembers.clanId, clanId),
        eq(clanMembers.userId, memberId)
      )
    );
}
