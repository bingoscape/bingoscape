/**
 * @jest-environment node
 *
 * changeRole() and its sibling operations against real Postgres. The data is
 * committed (not rolled back) because the concurrency tests need several
 * connections; every test builds its own world and removes it afterwards.
 */
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/server/db"
import {
  addMember,
  changeRole,
  removeMember,
  transferOwnership,
} from "@/server/authz/membership"
import {
  RBAC_VERIFICATION_CHECKS,
  runRbacVerification,
} from "@/server/authz/verification"
import {
  clanMembers,
  clans,
  eventAuditLog,
  eventBuyIns,
  eventParticipants,
  events,
  roleChangeLog,
  teamMembers,
  teams,
} from "@/server/db/schema"
import {
  clanRole,
  createMembershipWorld,
  eventRole,
  ledgerOf,
  replayLedger,
  type MembershipWorld,
} from "@/server/__tests__/helpers/membership-fixture"

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

let w: MembershipWorld

beforeEach(async () => {
  w = await createMembershipWorld()
})

afterEach(async () => {
  await w.cleanup()
})

const user = (id: string) => ({ kind: "user", userId: id }) as const

async function eventLedger() {
  return ledgerOf(w.eventId)
}

async function auditRows() {
  return db
    .select()
    .from(eventAuditLog)
    .where(eq(eventAuditLog.eventId, w.eventId))
}

async function liveEventRoles(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, w.eventId))
  return Object.fromEntries(rows.map((r) => [r.userId, r.role]))
}

async function liveClanRoles(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(clanMembers)
    .where(eq(clanMembers.clanId, w.clanId))
  return Object.fromEntries(rows.map((r) => [r.userId, r.role]))
}

/** Makes the Event creator-less, like an Event whose creator account is gone. */
async function orphanEvent() {
  await db
    .update(events)
    .set({ creatorId: null })
    .where(eq(events.id, w.eventId))
}

describe("changeRole (Event)", () => {
  it("lets the owner promote and demote, and logs who changed what", async () => {
    const result = await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "management",
      actor: user(w.id.owner),
      reason: "needs finance access",
    })
    expect(result).toMatchObject({
      success: true,
      changed: true,
      oldRole: "participant",
      newRole: "management",
    })
    expect(await eventRole(w, "player")).toBe("management")

    const last = (await eventLedger()).at(-1)
    expect(last).toMatchObject({
      scopeType: "event",
      subjectUserId: w.id.player,
      actorUserId: w.id.owner,
      action: "change",
      oldRole: "participant",
      newRole: "management",
      source: "app",
      reason: "needs finance access",
    })
  })

  it("is a no-op, without a ledger row, when the role is unchanged", async () => {
    const before = (await eventLedger()).length
    const result = await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "participant",
      actor: user(w.id.owner),
    })
    expect(result).toMatchObject({ success: true, changed: false })
    expect((await eventLedger()).length).toBe(before)
  })

  it("rejects unknown roles and missing participants", async () => {
    expect(
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        newRole: "owner",
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "INVALID" })
    expect(
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.outsider,
        newRole: "participant",
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "NOT_FOUND" })
  })

  it.each(["manager", "player", "outsider"] as const)(
    "refuses %s: only admins change roles",
    async (who) => {
      const result = await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        newRole: "management",
        actor: user(w.id[who]),
      })
      expect(result).toMatchObject({ success: false, code: "FORBIDDEN" })
      expect(await eventRole(w, "player")).toBe("participant")
      const denied = (await auditRows()).filter((r) => r.outcome === "denied")
      expect(denied).toHaveLength(1)
      expect(denied[0]).toMatchObject({
        actorUserId: w.id[who],
        action: "event.member.change",
        permission: "participant:set-role",
      })
    }
  )

  it("lets only the owner grant admin; other admins can grant lower roles", async () => {
    const byAdmin = await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "admin",
      actor: user(w.id.admin),
    })
    expect(byAdmin).toMatchObject({ success: false, code: "OWNER_ONLY" })
    expect(await eventRole(w, "player")).toBe("participant")

    expect(
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        newRole: "management",
        actor: user(w.id.admin),
      })
    ).toMatchObject({ success: true })

    expect(
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        newRole: "admin",
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: true })
    // The refusal left a trace; the grant of admin is audited as a success.
    const outcomes = (await auditRows()).map((r) => r.outcome).sort()
    expect(outcomes).toEqual(["denied", "success"])
  })

  it("never demotes the owner, not even by themselves", async () => {
    for (const actor of [w.id.admin, w.id.owner]) {
      const result = await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.owner,
        newRole: "participant",
        actor: user(actor),
      })
      expect(result).toMatchObject({ success: false, code: "OWNER_PROTECTED" })
    }
    expect(await eventRole(w, "owner")).toBe("admin")
  })

  it("keeps at least one admin", async () => {
    await orphanEvent()
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.role, "admin")
        )
      )
    // Leave a single admin.
    await db.insert(eventParticipants).values({
      eventId: w.eventId,
      userId: w.id.admin,
      role: "admin",
    })

    const result = await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.admin,
      newRole: "participant",
      actor: { kind: "system" },
    })
    expect(result).toMatchObject({ success: false, code: "LAST_ADMIN" })
    expect(await eventRole(w, "admin")).toBe("admin")
  })

  it("exactly one of two simultaneous demotions of the last two admins succeeds", async () => {
    await orphanEvent()
    // Only admin and admin2 are admins.
    await db
      .update(eventParticipants)
      .set({ role: "participant" })
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, w.id.owner)
        )
      )

    const attempts = await Promise.all([
      changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin,
        newRole: "participant",
        actor: { kind: "system" },
      }),
      changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin2,
        newRole: "participant",
        actor: { kind: "system" },
      }),
    ])
    expect(attempts.filter((r) => r.success)).toHaveLength(1)
    const refused = attempts.find((r) => !r.success)
    expect(refused).toMatchObject({ success: false, code: "LAST_ADMIN" })
    const roles = Object.values(await liveEventRoles())
    expect(roles.filter((r) => r === "admin")).toHaveLength(1)
  })

  it("serialises simultaneous demotion and removal of the last two admins", async () => {
    await orphanEvent()
    await db
      .update(eventParticipants)
      .set({ role: "participant" })
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, w.id.owner)
        )
      )

    const attempts = await Promise.all([
      changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin,
        newRole: "management",
        actor: { kind: "system" },
      }),
      removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin2,
        actor: { kind: "system" },
      }),
    ])
    expect(attempts.filter((r) => r.success)).toHaveLength(1)
    expect(
      Object.values(await liveEventRoles()).filter((r) => r === "admin")
    ).toHaveLength(1)
  })
})

describe("addMember / removeMember (Event)", () => {
  it("lets a player join on their own, only as a participant", async () => {
    const ceiling = await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "admin",
      actor: { kind: "self", userId: w.id.outsider },
    })
    expect(ceiling).toMatchObject({ success: false, code: "ROLE_CEILING" })
    expect(await eventRole(w, "outsider")).toBeNull()

    const other = await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "participant",
      actor: { kind: "self", userId: w.id.player },
    })
    expect(other).toMatchObject({ success: false, code: "ROLE_CEILING" })

    const joined = await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "participant",
      actor: { kind: "self", userId: w.id.outsider },
    })
    expect(joined).toMatchObject({ success: true, changed: true })
    expect((await eventLedger()).at(-1)).toMatchObject({
      subjectUserId: w.id.outsider,
      action: "add",
      oldRole: null,
      newRole: "participant",
      actorUserId: w.id.outsider,
    })

    expect(
      await addMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.outsider,
        role: "participant",
        actor: { kind: "self", userId: w.id.outsider },
      })
    ).toMatchObject({ success: false, code: "ALREADY_MEMBER" })
  })

  it("does not let a manager add a role above their own", async () => {
    const asAdmin = await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "admin",
      actor: user(w.id.manager),
    })
    expect(asAdmin).toMatchObject({ success: false, code: "ROLE_CEILING" })
    expect(await eventRole(w, "outsider")).toBeNull()

    const ok = await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "management",
      actor: user(w.id.manager),
    })
    expect(ok).toMatchObject({ success: true })
  })

  it("does not let a plain participant add anyone", async () => {
    expect(
      await addMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.outsider,
        role: "participant",
        actor: user(w.id.player),
      })
    ).toMatchObject({ success: false, code: "FORBIDDEN" })
  })

  it("lets managers remove participants, but not admins, and never the owner", async () => {
    expect(
      await removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin,
        actor: user(w.id.manager),
      })
    ).toMatchObject({ success: false, code: "ROLE_CEILING" })
    expect(
      await removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.owner,
        actor: user(w.id.admin),
      })
    ).toMatchObject({ success: false, code: "OWNER_PROTECTED" })
    expect(
      await removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        actor: user(w.id.manager),
      })
    ).toMatchObject({ success: true, oldRole: "participant", newRole: null })
    expect(await eventRole(w, "player")).toBeNull()
    expect((await eventLedger()).at(-1)).toMatchObject({
      subjectUserId: w.id.player,
      action: "remove",
      oldRole: "participant",
      newRole: null,
    })
  })

  it("removes the member's Team place and buy-in with the membership", async () => {
    const [team] = await db
      .insert(teams)
      .values({ eventId: w.eventId, name: "Team" })
      .returning({ id: teams.id })
    await db
      .insert(teamMembers)
      .values({ teamId: team!.id, eventId: w.eventId, userId: w.id.player })
    const [participant] = await db
      .select({ id: eventParticipants.id })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.userId, w.id.player)
        )
      )
    await db
      .insert(eventBuyIns)
      .values({ eventParticipantId: participant!.id, amount: 100 })

    await removeMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      actor: user(w.id.owner),
    })

    expect(
      await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, team!.id))
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(eventBuyIns)
        .where(eq(eventBuyIns.eventParticipantId, participant!.id))
    ).toHaveLength(0)
  })

  it("refuses to remove the last admin of an Event without a creator", async () => {
    await orphanEvent()
    await db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, w.eventId),
          eq(eventParticipants.role, "admin")
        )
      )
    await db
      .insert(eventParticipants)
      .values({ eventId: w.eventId, userId: w.id.admin, role: "admin" })
    expect(
      await removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.admin,
        actor: { kind: "system" },
      })
    ).toMatchObject({ success: false, code: "LAST_ADMIN" })
  })
})

describe("transferOwnership (Event)", () => {
  it("hands the Event to another participant, who becomes admin", async () => {
    const result = await transferOwnership({
      scope: "event",
      parentId: w.eventId,
      newOwnerId: w.id.player,
      actor: user(w.id.owner),
    })
    expect(result).toMatchObject({
      success: true,
      changed: true,
      previousOwnerId: w.id.owner,
    })
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, w.eventId))
    expect(event?.creatorId).toBe(w.id.player)
    expect(await eventRole(w, "player")).toBe("admin")
    // The previous owner stays an admin ...
    expect(await eventRole(w, "owner")).toBe("admin")
    expect((await eventLedger()).at(-1)).toMatchObject({
      subjectUserId: w.id.player,
      action: "transfer_ownership",
      oldRole: "participant",
      newRole: "admin",
      actorUserId: w.id.owner,
    })
    expect((await auditRows()).at(-1)).toMatchObject({
      action: "event.transfer_ownership",
      outcome: "success",
    })

    // ... and is no longer protected: the new owner may demote them.
    expect(
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.owner,
        newRole: "participant",
        actor: user(w.id.player),
      })
    ).toMatchObject({ success: true })
    // The old owner has lost the owner-only powers.
    expect(
      await transferOwnership({
        scope: "event",
        parentId: w.eventId,
        newOwnerId: w.id.owner,
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "FORBIDDEN" })
  })

  it("is owner-only: other admins and managers are refused", async () => {
    for (const who of ["admin", "manager", "player", "outsider"] as const) {
      const result = await transferOwnership({
        scope: "event",
        parentId: w.eventId,
        newOwnerId: w.id.player,
        actor: user(w.id[who]),
      })
      expect(result).toMatchObject({ success: false })
    }
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, w.eventId))
    expect(event?.creatorId).toBe(w.id.owner)
    expect(
      (await auditRows()).filter((r) => r.outcome === "denied").length
    ).toBeGreaterThanOrEqual(2)
  })

  it("needs a participant as the new owner", async () => {
    expect(
      await transferOwnership({
        scope: "event",
        parentId: w.eventId,
        newOwnerId: w.id.outsider,
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "NOT_A_MEMBER" })
  })

  it("lets the oldest admin act as owner when the creator account is gone", async () => {
    await orphanEvent()
    // admin, admin2 and the former owner row are admins; the oldest row is the
    // owner's (created first by the fixture), so the stand-in is `owner`.
    const notOldest = await transferOwnership({
      scope: "event",
      parentId: w.eventId,
      newOwnerId: w.id.player,
      actor: user(w.id.admin2),
    })
    expect(notOldest).toMatchObject({ success: false, code: "OWNER_ONLY" })

    const oldest = await transferOwnership({
      scope: "event",
      parentId: w.eventId,
      newOwnerId: w.id.admin2,
      actor: user(w.id.owner),
    })
    expect(oldest).toMatchObject({ success: true, previousOwnerId: w.id.owner })
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, w.eventId))
    expect(event?.creatorId).toBe(w.id.admin2)
  })
})

describe("Clan", () => {
  it("lets admins change roles and logs them", async () => {
    const result = await changeRole({
      scope: "clan",
      parentId: w.clanId,
      userId: w.id.player,
      newRole: "management",
      actor: user(w.id.admin),
    })
    expect(result).toMatchObject({ success: true, oldRole: "member" })
    expect(await clanRole(w, "player")).toBe("management")
    expect((await ledgerOf(w.clanId)).at(-1)).toMatchObject({
      scopeType: "clan",
      action: "change",
      oldRole: "member",
      newRole: "management",
      actorUserId: w.id.admin,
    })
  })

  it.each(["manager", "player", "outsider"] as const)(
    "refuses %s: only clan admins change roles",
    async (who) => {
      const result = await changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.player,
        newRole: "management",
        actor: user(w.id[who]),
      })
      expect(result).toMatchObject({ success: false, code: "FORBIDDEN" })
    }
  )

  it("keeps the clan owner an admin and the clan non-empty of admins", async () => {
    expect(
      await changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.owner,
        newRole: "member",
        actor: user(w.id.admin),
      })
    ).toMatchObject({ success: false, code: "OWNER_PROTECTED" })

    // Demoting `admin` leaves only the owner; demoting the owner is protected.
    expect(
      await changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.admin,
        newRole: "member",
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: true })

    await db.update(clans).set({ ownerId: null }).where(eq(clans.id, w.clanId))
    expect(
      await changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.owner,
        newRole: "member",
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "LAST_ADMIN" })
  })

  it("exactly one of two simultaneous demotions of the last two clan admins succeeds", async () => {
    await db.update(clans).set({ ownerId: null }).where(eq(clans.id, w.clanId))
    // Admins: owner and admin. Run the race from both sides at once.
    const attempts = await Promise.all([
      changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.owner,
        newRole: "member",
        actor: user(w.id.admin),
      }),
      changeRole({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.admin,
        newRole: "member",
        actor: user(w.id.owner),
      }),
    ])
    // The second change fails either with LAST_ADMIN or, if the first demoted
    // its actor, with FORBIDDEN (a demoted admin may no longer change roles).
    expect(attempts.filter((r) => r.success)).toHaveLength(1)
    expect(
      Object.values(await liveClanRoles()).filter((r) => r === "admin")
    ).toHaveLength(1)
  })

  it("never lets the owner leave and keeps the last admin", async () => {
    expect(
      await removeMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.owner,
        actor: { kind: "self", userId: w.id.owner },
      })
    ).toMatchObject({
      success: false,
      code: "OWNER_PROTECTED",
      error: "The clan owner can't leave the clan",
    })

    expect(
      await removeMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.player,
        actor: { kind: "self", userId: w.id.player },
      })
    ).toMatchObject({ success: true })
    expect(await clanRole(w, "player")).toBeNull()

    // Last admin of an ownerless clan.
    await db.update(clans).set({ ownerId: null }).where(eq(clans.id, w.clanId))
    await db
      .delete(clanMembers)
      .where(
        and(
          eq(clanMembers.clanId, w.clanId),
          eq(clanMembers.userId, w.id.admin)
        )
      )
    expect(
      await removeMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.owner,
        actor: { kind: "self", userId: w.id.owner },
      })
    ).toMatchObject({ success: false, code: "LAST_ADMIN" })
  })

  it("joins as a member only and reports duplicates", async () => {
    expect(
      await addMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.outsider,
        role: "admin",
        actor: { kind: "self", userId: w.id.outsider },
      })
    ).toMatchObject({ success: false, code: "ROLE_CEILING" })
    expect(
      await addMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.outsider,
        role: "member",
        isMain: true,
        actor: { kind: "self", userId: w.id.outsider },
      })
    ).toMatchObject({ success: true })
    expect(
      await addMember({
        scope: "clan",
        parentId: w.clanId,
        userId: w.id.outsider,
        role: "member",
        actor: { kind: "self", userId: w.id.outsider },
      })
    ).toMatchObject({ success: false, code: "ALREADY_MEMBER" })
  })

  it("transfers clan ownership to a member, who becomes admin", async () => {
    expect(
      await transferOwnership({
        scope: "clan",
        parentId: w.clanId,
        newOwnerId: w.id.player,
        actor: user(w.id.admin),
      })
    ).toMatchObject({ success: false, code: "OWNER_ONLY" })
    expect(
      await transferOwnership({
        scope: "clan",
        parentId: w.clanId,
        newOwnerId: w.id.outsider,
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: false, code: "NOT_A_MEMBER" })

    expect(
      await transferOwnership({
        scope: "clan",
        parentId: w.clanId,
        newOwnerId: w.id.player,
        actor: user(w.id.owner),
      })
    ).toMatchObject({ success: true, changed: true })
    const [clan] = await db.select().from(clans).where(eq(clans.id, w.clanId))
    expect(clan?.ownerId).toBe(w.id.player)
    expect(await clanRole(w, "player")).toBe("admin")
    expect((await ledgerOf(w.clanId)).at(-1)).toMatchObject({
      action: "transfer_ownership",
      oldRole: "member",
      newRole: "admin",
    })
  })
})

describe("sources, transactions and the ledger", () => {
  it("records the super-admin source and the acting admin", async () => {
    const result = await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "admin",
      actor: { kind: "system", userId: w.id.outsider },
      source: "super_admin",
      reason: "support request",
    })
    expect(result).toMatchObject({ success: true })
    expect((await eventLedger()).at(-1)).toMatchObject({
      source: "super_admin",
      actorUserId: w.id.outsider,
      newRole: "admin",
      reason: "support request",
    })
  })

  it("applies the owner and last-admin rules to system actors too", async () => {
    expect(
      await removeMember({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.owner,
        actor: { kind: "system" },
        source: "super_admin",
      })
    ).toMatchObject({ success: false, code: "OWNER_PROTECTED" })
  })

  it("joins the caller's transaction and rolls back with it", async () => {
    const ledgerBefore = (await eventLedger()).length
    class Rollback extends Error {}
    await expect(
      db.transaction(async (tx) => {
        const result = await changeRole({
          scope: "event",
          parentId: w.eventId,
          userId: w.id.player,
          newRole: "management",
          actor: user(w.id.owner),
          tx,
        })
        expect(result).toMatchObject({ success: true })
        throw new Rollback()
      })
    ).rejects.toBeInstanceOf(Rollback)
    expect(await eventRole(w, "player")).toBe("participant")
    expect((await eventLedger()).length).toBe(ledgerBefore)
  })

  it("resets the audit source once the operation is done", async () => {
    await db.transaction(async (tx) => {
      await changeRole({
        scope: "event",
        parentId: w.eventId,
        userId: w.id.player,
        newRole: "management",
        actor: user(w.id.owner),
        tx,
      })
      const rows = await tx.execute<{ source: string | null }>(
        sql`select nullif(current_setting('app.audit_source', true), '') as source`
      )
      expect([...rows][0]?.source).toBeNull()
    })
  })

  it("replaying the ledger reproduces the live state", async () => {
    await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "management",
      actor: user(w.id.owner),
    })
    await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player2,
      newRole: "admin",
      actor: user(w.id.owner),
    })
    await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player2,
      newRole: "participant",
      actor: user(w.id.owner),
    })
    await removeMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.manager,
      actor: user(w.id.admin),
    })
    await addMember({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      role: "participant",
      actor: { kind: "self", userId: w.id.outsider },
    })
    await transferOwnership({
      scope: "event",
      parentId: w.eventId,
      newOwnerId: w.id.admin,
      actor: user(w.id.owner),
    })
    await changeRole({
      scope: "clan",
      parentId: w.clanId,
      userId: w.id.player,
      newRole: "guest",
      actor: user(w.id.owner),
    })
    await removeMember({
      scope: "clan",
      parentId: w.clanId,
      userId: w.id.manager,
      actor: user(w.id.owner),
    })

    expect(await replayLedger(w.eventId)).toEqual(await liveEventRoles())
    expect(await replayLedger(w.clanId)).toEqual(await liveClanRoles())

    // The reconciliation query agrees (filtered to this world: other suites
    // share the database and write memberships without a ledger).
    const results = await runRbacVerification(
      async (query) =>
        [...(await db.execute(sql.raw(query)))] as Record<string, unknown>[],
      RBAC_VERIFICATION_CHECKS.filter((c) => c.id === "ledger_drift")
    )
    const mine = (results[0]?.rows ?? []).filter((row) =>
      w.scopeIds.includes(String(row.scope_id))
    )
    expect(mine).toEqual([])
  })

  it("does not write a denial row for plain validation errors", async () => {
    await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.outsider,
      newRole: "participant",
      actor: user(w.id.owner),
    })
    expect(await auditRows()).toHaveLength(0)
  })

  it("keeps the ledger append-only: one row per change", async () => {
    const before = (await eventLedger()).length
    await changeRole({
      scope: "event",
      parentId: w.eventId,
      userId: w.id.player,
      newRole: "management",
      actor: user(w.id.owner),
    })
    expect(
      await db
        .select()
        .from(roleChangeLog)
        .where(eq(roleChangeLog.scopeId, w.eventId))
    ).toHaveLength(before + 1)
  })
})
