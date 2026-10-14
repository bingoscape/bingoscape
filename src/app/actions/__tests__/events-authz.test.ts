/**
 * @jest-environment node
 */
import { expectFailure } from "@/server/__tests__/helpers/expect-failure"
import { and, eq } from "drizzle-orm"

import {
  assignEventToClan,
  assignParticipantToTeam,
  generateEventInviteLink,
  getEventParticipants,
  getParticipantDonations,
  getPendingRegistrationCount,
  getRegistrationRequests,
  removeParticipantDonation,
  updateEvent,
  updateParticipantBuyIn,
  updateParticipantDonation,
  updateParticipantRole,
} from "@/app/actions/events"
import { getServerAuthSession } from "@/server/auth"
import { getEvents } from "@/server/queries/events"
import { db } from "@/server/db"
import {
  clanMembers,
  clans,
  eventBuyIns,
  eventDonations,
  eventParticipants,
  eventRegistrationRequests,
  events,
  teamMembers,
  teams,
  users,
} from "@/server/db/schema"
import { withDb } from "@/lib/test-utils"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

const DAY_MS = 24 * 60 * 60 * 1000
const PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQ"

/**
 * Event A: creator, one admin, one management member, two players (one on a
 * team) and an outsider who is not part of the event. Event B belongs to
 * somebody else and carries a donation.
 */
async function seed() {
  const suffix = Math.random().toString(36).slice(2)
  const created = await db
    .insert(users)
    .values(
      [
        "creator",
        "admin",
        "manager",
        "player",
        "other",
        "outsider",
        "otherCreator",
      ].map((name) => ({
        name,
        email: `${name}-${suffix}@example.test`,
        password: PASSWORD_HASH,
      }))
    )
    .returning({ id: users.id, email: users.email })
  const idOf = (name: string) =>
    created.find((u) => u.email === `${name}-${suffix}@example.test`)!.id

  const start = new Date(Date.now() + DAY_MS)
  const end = new Date(Date.now() + 2 * DAY_MS)
  const [eventA, eventB] = await db
    .insert(events)
    .values([
      {
        title: "Event A",
        startDate: start,
        endDate: end,
        creatorId: idOf("creator"),
        minimumBuyIn: 100,
      },
      {
        title: "Event B",
        startDate: start,
        endDate: end,
        creatorId: idOf("otherCreator"),
      },
    ])
    .returning({ id: events.id })

  const participantsA = await db
    .insert(eventParticipants)
    .values([
      { eventId: eventA!.id, userId: idOf("creator"), role: "admin" },
      { eventId: eventA!.id, userId: idOf("admin"), role: "admin" },
      { eventId: eventA!.id, userId: idOf("manager"), role: "management" },
      { eventId: eventA!.id, userId: idOf("player"), role: "participant" },
      { eventId: eventA!.id, userId: idOf("other"), role: "participant" },
    ])
    .returning({ id: eventParticipants.id, userId: eventParticipants.userId })

  const [teamA1, teamA2, teamB] = await db
    .insert(teams)
    .values([
      { eventId: eventA!.id, name: "A1" },
      { eventId: eventA!.id, name: "A2" },
      { eventId: eventB!.id, name: "B" },
    ])
    .returning({ id: teams.id })
  await db
    .insert(teamMembers)
    .values([
      { teamId: teamA1!.id, eventId: eventA!.id, userId: idOf("player") },
    ])

  // The player also takes part in Event B, on a team there.
  const [playerInB] = await db
    .insert(eventParticipants)
    .values({ eventId: eventB!.id, userId: idOf("player") })
    .returning({ id: eventParticipants.id })
  await db
    .insert(teamMembers)
    .values({ teamId: teamB!.id, eventId: eventB!.id, userId: idOf("player") })
  const [donationB] = await db
    .insert(eventDonations)
    .values({ eventParticipantId: playerInB!.id, amount: 50 })
    .returning({ id: eventDonations.id })

  const [donationA] = await db
    .insert(eventDonations)
    .values({
      eventParticipantId: participantsA.find(
        (p) => p.userId === idOf("player")
      )!.id,
      amount: 10,
    })
    .returning({ id: eventDonations.id })

  await db.insert(eventRegistrationRequests).values({
    eventId: eventA!.id,
    userId: idOf("outsider"),
    message: "let me in",
  })

  return {
    idOf,
    eventA: eventA!.id,
    eventB: eventB!.id,
    teamA1: teamA1!.id,
    teamA2: teamA2!.id,
    teamB: teamB!.id,
    donationA: donationA!.id,
    donationB: donationB!.id,
  }
}

const NON_MANAGERS = ["anonymous", "outsider", "player"] as const

function userFor(
  who: string,
  idOf: (name: string) => string
): string | null {
  return who === "anonymous" ? null : idOf(who)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("updateEvent", () => {
  it.each([...NON_MANAGERS, "manager"])("rejects %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(userFor(who, f.idOf))

      await expectFailure(updateEvent(f.eventA, {
          title: "Hijacked",
          description: null,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          registrationDeadline: null,
          minimumBuyIn: 0,
          basePrizePool: 999,
          public: true,
        }))

      const event = await db.query.events.findFirst({
        where: eq(events.id, f.eventA),
      })
      expect(event?.title).toBe("Event A")
      expect(event?.minimumBuyIn).toBe(100)
    })
  })

  it.each(["creator", "admin"])("allows %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf(who))

      await updateEvent(f.eventA, {
        title: "Renamed",
        description: null,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        registrationDeadline: null,
        minimumBuyIn: 100,
        basePrizePool: 0,
      })

      const event = await db.query.events.findFirst({
        where: eq(events.id, f.eventA),
      })
      expect(event?.title).toBe("Renamed")
    })
  })

  it("does not let an admin of another event edit this one", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("otherCreator"))

      await expectFailure(updateEvent(f.eventA, {
          title: "Hijacked",
          description: null,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          registrationDeadline: null,
          minimumBuyIn: 0,
          basePrizePool: 0,
        }))
    })
  })
})

describe("updateParticipantBuyIn", () => {
  it.each(NON_MANAGERS)("rejects %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(userFor(who, f.idOf))

      const result = await updateParticipantBuyIn(
        f.eventA,
        f.idOf("player"),
        true
      )

      expect(result.success).toBe(false)
      expect(await db.select().from(eventBuyIns)).toHaveLength(0)
    })
  })

  it("lets a manager mark a buy-in as paid", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      const result = await updateParticipantBuyIn(
        f.eventA,
        f.idOf("player"),
        true
      )

      expect(result.success).toBe(true)
      expect(await db.select().from(eventBuyIns)).toHaveLength(1)
    })
  })
})

describe("assignParticipantToTeam", () => {
  it.each(NON_MANAGERS)("rejects %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(userFor(who, f.idOf))

      await expectFailure(assignParticipantToTeam(f.eventA, f.idOf("other"), f.teamA1))

      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, f.teamA1),
      })
      expect(members).toHaveLength(1)
    })
  })

  it("moves a player between teams without touching their other event", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await assignParticipantToTeam(f.eventA, f.idOf("player"), f.teamA2)

      const inA = await db.query.teamMembers.findMany({
        where: and(eq(teamMembers.userId, f.idOf("player"))),
        with: { team: true },
      })
      // One team in A (the new one) and the untouched team of Event B.
      expect(inA.map((m) => m.team.name).sort()).toEqual(["A2", "B"])
    })
  })

  it("never leaves a player on two teams of the same event", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      // The player's first membership row is in Event B.
      await assignParticipantToTeam(f.eventA, f.idOf("player"), f.teamA2)
      await assignParticipantToTeam(f.eventA, f.idOf("player"), f.teamA1)

      const inA = await db.query.teamMembers.findMany({
        where: eq(teamMembers.userId, f.idOf("player")),
        with: { team: true },
      })
      expect(inA.filter((m) => m.team.eventId === f.eventA)).toHaveLength(1)
    })
  })

  it("rejects users who are not part of the event", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await expectFailure(assignParticipantToTeam(f.eventA, f.idOf("outsider"), f.teamA1), "not a participant")
    })
  })

  it("rejects a team of another event", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await expectFailure(assignParticipantToTeam(f.eventA, f.idOf("other"), f.teamB), "Invalid team")
    })
  })
})

describe("updateParticipantRole", () => {
  it("rejects an anonymous caller targeting the event creator", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(null)

      await expectFailure(updateParticipantRole(f.eventA, f.idOf("creator"), "participant"))
    })
  })

  it.each(["outsider", "player", "manager"])(
    "rejects %s promoting themselves",
    async (who) => {
      await withDb(async () => {
        const f = await seed()
        signInAs(f.idOf(who))

        await expectFailure(updateParticipantRole(f.eventA, f.idOf(who), "admin"))

        const row = await db.query.eventParticipants.findFirst({
          where: and(
            eq(eventParticipants.eventId, f.eventA),
            eq(eventParticipants.userId, f.idOf(who))
          ),
        })
        expect(row?.role ?? "participant").not.toBe("admin")
      })
    }
  )

  it("lets an admin promote a participant", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("admin"))

      await updateParticipantRole(f.eventA, f.idOf("player"), "management")

      const row = await db.query.eventParticipants.findFirst({
        where: and(
          eq(eventParticipants.eventId, f.eventA),
          eq(eventParticipants.userId, f.idOf("player"))
        ),
      })
      expect(row?.role).toBe("management")
    })
  })

  it("never demotes the event creator", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("admin"))

      await expectFailure(updateParticipantRole(f.eventA, f.idOf("creator"), "participant"), "creator")
    })
  })

  it("keeps at least one admin when the event has no creator", async () => {
    await withDb(async () => {
      const f = await seed()
      // Orphaned event: the creator account is gone, one explicit admin left.
      await db
        .update(events)
        .set({ creatorId: null })
        .where(eq(events.id, f.eventA))
      await db
        .delete(eventParticipants)
        .where(
          and(
            eq(eventParticipants.eventId, f.eventA),
            eq(eventParticipants.userId, f.idOf("creator"))
          )
        )
      signInAs(f.idOf("admin"))

      await expectFailure(updateParticipantRole(f.eventA, f.idOf("admin"), "participant"), "at least one admin")

      // With a second admin the first one may step down.
      await updateParticipantRole(f.eventA, f.idOf("manager"), "admin")
      await updateParticipantRole(f.eventA, f.idOf("admin"), "participant")
    })
  })
})

describe("manager-only reads", () => {
  it.each(NON_MANAGERS)("deny %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(userFor(who, f.idOf))

      expect(await getEventParticipants(f.eventA)).toEqual([])
      expect(await getParticipantDonations(f.eventA, f.idOf("player"))).toEqual(
        []
      )
      expect(await getPendingRegistrationCount(f.eventA)).toBe(0)
      expect(await getRegistrationRequests(f.eventA)).toEqual([])
    })
  })

  it("serve a manager", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      expect((await getEventParticipants(f.eventA)).length).toBeGreaterThan(0)
      expect(
        await getParticipantDonations(f.eventA, f.idOf("player"))
      ).toHaveLength(1)
      expect(await getPendingRegistrationCount(f.eventA)).toBe(1)
    })
  })

  it("registration requests never carry the password hash", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      const requests = await getRegistrationRequests(f.eventA)

      expect(requests).toHaveLength(1)
      expect(JSON.stringify(requests)).not.toContain(PASSWORD_HASH)
      expect(JSON.stringify(requests)).not.toContain("password")
    })
  })
})

describe("donations are scoped to the event", () => {
  it("does not let a manager of event A edit a donation of event B", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await expectFailure(updateParticipantDonation(f.eventA, f.donationB, 9999, "pwned"))

      const donation = await db.query.eventDonations.findFirst({
        where: eq(eventDonations.id, f.donationB),
      })
      expect(donation?.amount).toBe(50)
    })
  })

  it("does not let a manager of event A delete a donation of event B", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await removeParticipantDonation(f.eventA, f.donationB)

      const donation = await db.query.eventDonations.findFirst({
        where: eq(eventDonations.id, f.donationB),
      })
      expect(donation).toBeDefined()
    })
  })

  it("still lets a manager manage the donations of their own event", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("manager"))

      await updateParticipantDonation(f.eventA, f.donationA, 25, "ok")
      const updated = await db.query.eventDonations.findFirst({
        where: eq(eventDonations.id, f.donationA),
      })
      expect(updated?.amount).toBe(25)

      await removeParticipantDonation(f.eventA, f.donationA)
      expect(
        await db.query.eventDonations.findFirst({
          where: eq(eventDonations.id, f.donationA),
        })
      ).toBeUndefined()
    })
  })
})

describe("generateEventInviteLink", () => {
  it.each([...NON_MANAGERS, "manager"])("rejects %s", async (who) => {
    await withDb(async () => {
      const f = await seed()
      signInAs(userFor(who, f.idOf))

      await expectFailure(generateEventInviteLink(f.eventA))
    })
  })

  it("lets an admin create an invite", async () => {
    await withDb(async () => {
      const f = await seed()
      signInAs(f.idOf("admin"))

      const result = await generateEventInviteLink(f.eventA)
      expect(result.success && result.invite.eventId).toBe(f.eventA)
    })
  })
})

describe("assignEventToClan", () => {
  async function seedClan(f: Awaited<ReturnType<typeof seed>>) {
    const [clan] = await db
      .insert(clans)
      .values({ name: "Clan", ownerId: f.idOf("other") })
      .returning({ id: clans.id })
    await db.insert(clanMembers).values([
      { clanId: clan!.id, userId: f.idOf("admin"), role: "admin" },
      { clanId: clan!.id, userId: f.idOf("manager"), role: "management" },
      { clanId: clan!.id, userId: f.idOf("player"), role: "guest" },
      { clanId: clan!.id, userId: f.idOf("outsider"), role: "admin" },
    ])
    return clan!.id
  }

  it.each(["player", "outsider", "manager"])(
    "rejects %s",
    async (who) => {
      await withDb(async () => {
        const f = await seed()
        const clanId = await seedClan(f)
        signInAs(f.idOf(who))

        await expectFailure(assignEventToClan(f.eventA, clanId))

        const event = await db.query.events.findFirst({
          where: eq(events.id, f.eventA),
        })
        expect(event?.clanId).toBeNull()
      })
    }
  )

  it("lets an event admin who manages the clan attach the event", async () => {
    await withDb(async () => {
      const f = await seed()
      const clanId = await seedClan(f)
      signInAs(f.idOf("admin"))

      await assignEventToClan(f.eventA, clanId)

      const event = await db.query.events.findFirst({
        where: eq(events.id, f.eventA),
      })
      expect(event?.clanId).toBe(clanId)
    })
  })
})

describe("getEvents", () => {
  it("only lists the events of the signed-in user", async () => {
    await withDb(async () => {
      const f = await seed()

      signInAs(null)
      expect(await getEvents(f.idOf("creator"))).toEqual([])

      signInAs(f.idOf("outsider"))
      expect(await getEvents(f.idOf("creator"))).toEqual([])

      signInAs(f.idOf("creator"))
      expect((await getEvents(f.idOf("creator"))).length).toBeGreaterThan(0)
    })
  })
})
