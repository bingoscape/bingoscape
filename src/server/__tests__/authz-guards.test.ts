/**
 * @jest-environment node
 *
 * Guards, actor loader and resolvers against real Postgres (testcontainers).
 * Only the auth session is mocked; the policy runs on rows the fixture wrote.
 */
import { eq } from "drizzle-orm"
import { z } from "zod"

import { getUserRole } from "@/app/actions/events"
import type { Permission } from "@/lib/authz/permissions"
import { getServerAuthSession } from "@/server/auth"
import {
  AuthzError,
  assertGoalInEvent,
  assertTeamLeaderOrManager,
  authorize,
  canReadTile,
  eventIdOfBingo,
  eventIdOfGoal,
  eventIdOfSubmission,
  eventIdOfTeam,
  eventIdOfTile,
  getEventActor,
  getEventRole,
  isEventManager,
  requireBingoAdmin,
  requireBingoAdminForGoal,
  requireBingoAdminForSubmission,
  requireBingoAdminForTile,
  requireEventAdmin,
  requireEventManager,
  requireEventMember,
  requirePermission,
  requireTeamMemberOrManager,
} from "@/server/authz"
import { eventAction } from "@/server/authz/action"
import { db } from "@/server/db"
import { events } from "@/server/db/schema"
import {
  createAuthzFixture,
  type AuthzFixture,
} from "@/server/__tests__/helpers/authz-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock

let f: AuthzFixture

beforeAll(async () => {
  f = await createAuthzFixture()
})
afterAll(async () => {
  await f.cleanup()
})

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

type UserKey = keyof AuthzFixture["users"]

describe("getEventActor", () => {
  it("reports an anonymous caller", async () => {
    signInAs(null)
    await expect(getEventActor(f.event1.id)).resolves.toEqual({
      status: "unauthenticated",
    })
  })

  it("reports an unknown Event", async () => {
    signInAs(f.users.admin)
    await expect(
      getEventActor("00000000-0000-4000-8000-000000000000")
    ).resolves.toEqual({ status: "not-found" })
  })

  it.each<[UserKey, "admin" | "management" | "participant" | null, boolean]>([
    // The creator's participant row says "participant"; they are admin anyway.
    ["creator", "admin", true],
    ["admin", "admin", false],
    ["management", "management", false],
    ["participant", "participant", false],
    ["leaderA", "participant", false],
    ["outsider", null, false],
    ["otherCreator", "admin", false],
  ])("%s in Event 1: role %s, owner %s", async (user, role, isOwner) => {
    // otherCreator owns Event 2 only, so they are a non-member of Event 1.
    const expectedRole = user === "otherCreator" ? null : role
    signInAs(f.users[user])
    const lookup = await getEventActor(f.event1.id)
    expect(lookup.status).toBe("ok")
    if (lookup.status !== "ok") return
    expect(lookup.actor).toMatchObject({
      userId: f.users[user],
      eventId: f.event1.id,
      role: expectedRole,
      isOwner: user === "otherCreator" ? false : isOwner,
    })
  })

  it("counts a creator without any participant row as admin and owner", async () => {
    signInAs(f.users.otherCreator)
    const lookup = await getEventActor(f.event2.id)
    expect(lookup).toMatchObject({
      status: "ok",
      actor: { role: "admin", isOwner: true, teams: [] },
    })
  })

  it("loads the Teams the user belongs to in that Event only", async () => {
    signInAs(f.users.leaderA)
    const lookup = await getEventActor(f.event1.id)
    expect(lookup).toMatchObject({
      status: "ok",
      actor: { teams: [{ teamId: f.event1.teamAId, isLeader: true }] },
    })

    signInAs(f.users.memberA)
    await expect(getEventActor(f.event1.id)).resolves.toMatchObject({
      actor: { teams: [{ teamId: f.event1.teamAId, isLeader: false }] },
    })

    signInAs(f.users.memberB)
    await expect(getEventActor(f.event2.id)).resolves.toMatchObject({
      actor: { role: null, teams: [] },
    })
  })

  it("scopes the role to the Event", async () => {
    signInAs(f.users.admin)
    await expect(getEventRole(f.event1.id)).resolves.toBe("admin")
    await expect(getEventRole(f.event2.id)).resolves.toBe("participant")
  })
})

describe("getUserRole (compatibility shim) delegates to the actor loader", () => {
  it.each<[UserKey, string | null]>([
    ["creator", "admin"],
    ["admin", "admin"],
    ["management", "management"],
    ["participant", "participant"],
    ["outsider", null],
  ])("%s -> %s", async (user, expected) => {
    signInAs(f.users[user])
    await expect(getUserRole(f.event1.id)).resolves.toBe(expected)
    await expect(getUserRole(f.event1.id)).resolves.toBe(
      await getEventRole(f.event1.id)
    )
  })

  it("is null when signed out or for an unknown Event", async () => {
    signInAs(null)
    await expect(getUserRole(f.event1.id)).resolves.toBeNull()
    signInAs(f.users.admin)
    await expect(
      getUserRole("00000000-0000-4000-8000-000000000000")
    ).resolves.toBeNull()
  })
})

describe("authorize / requirePermission", () => {
  const ALLOWED: Record<string, UserKey[]> = {
    "event:view": ["creator", "admin", "management", "participant"],
    "event:update": ["creator", "admin"],
    "participant:set-role": ["creator", "admin"],
    "finance:write": ["creator", "admin", "management"],
    "webhook:manage": ["creator", "admin", "management"],
    "board:view-secret": ["creator", "admin", "management"],
    "submission:comment": ["creator", "admin", "management"],
  }
  const USERS: UserKey[] = [
    "creator",
    "admin",
    "management",
    "participant",
    "outsider",
  ]

  it.each(
    Object.keys(ALLOWED).flatMap((permission) =>
      USERS.map((user) => [permission, user] as const)
    )
  )("%s as %s", async (permission, user) => {
    signInAs(f.users[user])
    const result = await authorize(f.event1.id, permission as Permission)
    const allowed = ALLOWED[permission]!.includes(user)
    expect(result.success).toBe(allowed)
    if (!result.success) {
      expect(result).toMatchObject({
        code: "FORBIDDEN",
        error: "Forbidden: insufficient permissions",
      })
    }
  })

  it("returns UNAUTHENTICATED without a session", async () => {
    signInAs(null)
    await expect(authorize(f.event1.id, "event:view")).resolves.toEqual({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Unauthorized",
    })
  })

  it("returns NOT_FOUND for an unknown Event", async () => {
    signInAs(f.users.admin)
    await expect(
      authorize("00000000-0000-4000-8000-000000000000", "event:view")
    ).resolves.toMatchObject({ success: false, code: "NOT_FOUND" })
  })

  it("evaluates Team scoped permissions against the actor's own Teams", async () => {
    signInAs(f.users.leaderA)
    await expect(
      authorize(f.event1.id, "team:lead", { teamId: f.event1.teamAId })
    ).resolves.toMatchObject({ success: true })
    await expect(
      authorize(f.event1.id, "team:lead", { teamId: f.event1.teamBId })
    ).resolves.toMatchObject({ success: false, code: "FORBIDDEN" })

    signInAs(f.users.memberA)
    await expect(
      authorize(f.event1.id, "team:lead", { teamId: f.event1.teamAId })
    ).resolves.toMatchObject({ success: false, code: "FORBIDDEN" })
    await expect(
      authorize(f.event1.id, "submission:create", { teamId: f.event1.teamAId })
    ).resolves.toMatchObject({ success: true })
  })

  it("does not carry admin rights into another Event", async () => {
    signInAs(f.users.admin)
    await expect(authorize(f.event2.id, "event:update")).resolves.toMatchObject(
      { success: false, code: "FORBIDDEN" }
    )
  })

  it("requirePermission returns the actor or throws a typed AuthzError", async () => {
    signInAs(f.users.management)
    await expect(
      requirePermission(f.event1.id, "finance:write")
    ).resolves.toMatchObject({ role: "management" })

    const error = await requirePermission(f.event1.id, "event:update").catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(AuthzError)
    expect(error).toMatchObject({ code: "FORBIDDEN" })

    signInAs(null)
    await expect(
      requirePermission(f.event1.id, "event:view")
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" })

    signInAs(f.users.admin)
    await expect(
      requirePermission("00000000-0000-4000-8000-000000000000", "event:view")
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("existing helpers keep their behaviour", () => {
  it("requireEventManager: admin, management and the creator pass", async () => {
    for (const user of ["creator", "admin", "management"] as const) {
      signInAs(f.users[user])
      await expect(requireEventManager(f.event1.id)).resolves.toBe(f.event1.id)
      await expect(isEventManager(f.event1.id)).resolves.toBe(true)
    }
    for (const user of ["participant", "outsider"] as const) {
      signInAs(f.users[user])
      await expect(requireEventManager(f.event1.id)).rejects.toThrow(
        "Forbidden: admin or management role required"
      )
      await expect(isEventManager(f.event1.id)).resolves.toBe(false)
    }
    signInAs(null)
    await expect(requireEventManager(f.event1.id)).rejects.toThrow(
      "Unauthorized"
    )
  })

  it("requireEventAdmin / requireEventMember", async () => {
    signInAs(f.users.creator)
    await expect(requireEventAdmin(f.event1.id)).resolves.toBe(f.event1.id)
    signInAs(f.users.management)
    await expect(requireEventAdmin(f.event1.id)).rejects.toThrow(
      "Forbidden: admin role required"
    )
    await expect(requireEventMember(f.event1.id)).resolves.toBe("management")
    signInAs(f.users.outsider)
    await expect(requireEventMember(f.event1.id)).rejects.toThrow(
      "Forbidden: not a member of this event"
    )
  })

  it("manager of Event 1 cannot reach the rows of Event 2", async () => {
    signInAs(f.users.management)
    await expect(requireBingoAdmin(f.event1.bingoId)).resolves.toBe(f.event1.id)
    await expect(requireBingoAdminForTile(f.event1.tileId)).resolves.toBe(
      f.event1.id
    )
    await expect(requireBingoAdminForGoal(f.event1.goalId)).resolves.toBe(
      f.event1.id
    )
    await expect(
      requireBingoAdminForSubmission(f.event1.submissionId)
    ).resolves.toBe(f.event1.id)

    await expect(requireBingoAdmin(f.event2.bingoId)).rejects.toBeInstanceOf(
      AuthzError
    )
    await expect(requireBingoAdminForTile(f.event2.tileId)).rejects.toThrow(
      "Forbidden"
    )
    await expect(requireBingoAdminForGoal(f.event2.goalId)).rejects.toThrow(
      "Forbidden"
    )
  })

  it("admin of Event 1 is only a participant of Event 2", async () => {
    signInAs(f.users.admin)
    await expect(requireBingoAdminForTile(f.event2.tileId)).rejects.toThrow(
      "Forbidden: admin or management role required"
    )
  })

  it("Team helpers: member, leader and manager rules", async () => {
    signInAs(f.users.memberA)
    await expect(requireTeamMemberOrManager(f.event1.teamAId)).resolves.toBe(
      f.event1.id
    )
    await expect(requireTeamMemberOrManager(f.event1.teamBId)).rejects.toThrow(
      "Forbidden: not a member of this team"
    )
    await expect(assertTeamLeaderOrManager(f.event1.teamAId)).rejects.toThrow(
      "only the team leader or an event manager"
    )

    signInAs(f.users.leaderA)
    await expect(assertTeamLeaderOrManager(f.event1.teamAId)).resolves.toBe(
      f.event1.id
    )
    await expect(assertTeamLeaderOrManager(f.event1.teamBId)).rejects.toThrow(
      "Forbidden: not a member of this team"
    )

    signInAs(f.users.management)
    await expect(assertTeamLeaderOrManager(f.event1.teamBId)).resolves.toBe(
      f.event1.id
    )
    await expect(requireTeamMemberOrManager(f.event2.teamId)).rejects.toThrow(
      "Forbidden: not a member of this team"
    )
  })

  it("canReadTile: unhidden Tiles are readable, unknown Tiles are not", async () => {
    signInAs(f.users.outsider)
    await expect(canReadTile(f.event1.tileId)).resolves.toBe(true)
    await expect(
      canReadTile("00000000-0000-4000-8000-000000000000")
    ).resolves.toBe(false)
  })
})

describe("resolvers", () => {
  it("derive the Event from the database", async () => {
    await expect(eventIdOfBingo(f.event1.bingoId)).resolves.toBe(f.event1.id)
    await expect(eventIdOfTile(f.event2.tileId)).resolves.toBe(f.event2.id)
    await expect(eventIdOfGoal(f.event1.goalId)).resolves.toBe(f.event1.id)
    await expect(eventIdOfSubmission(f.event1.submissionId)).resolves.toBe(
      f.event1.id
    )
    await expect(eventIdOfTeam(f.event2.teamId)).resolves.toBe(f.event2.id)
  })

  it("throw NOT_FOUND for unknown rows", async () => {
    const missing = "00000000-0000-4000-8000-000000000000"
    for (const resolve of [
      eventIdOfBingo,
      eventIdOfTile,
      eventIdOfGoal,
      eventIdOfSubmission,
      eventIdOfTeam,
    ]) {
      await expect(resolve(missing)).rejects.toMatchObject({
        name: "AuthzError",
        code: "NOT_FOUND",
      })
    }
  })

  it("assertGoalInEvent refuses a Goal of another Event", async () => {
    await expect(
      assertGoalInEvent(f.event1.goalId, f.event1.id)
    ).resolves.toBeUndefined()
    await expect(
      assertGoalInEvent(f.event2.goalId, f.event1.id)
    ).rejects.toThrow("Goal not found")
  })
})

describe("eventAction", () => {
  const titleOf = async () =>
    (
      await db.query.events.findFirst({
        where: eq(events.id, f.event1.id),
        columns: { title: true },
      })
    )?.title

  const rename = eventAction({
    schema: z.object({ eventId: z.string(), title: z.string().min(1) }),
    permission: "event:update",
    eventIdOf: (input) => input.eventId,
  }).action(async ({ parsedInput, ctx }) => {
    await ctx.tx
      .update(events)
      .set({ title: parsedInput.title })
      .where(eq(events.id, parsedInput.eventId))
    if (parsedInput.title === "boom") throw new Error("action failed")
    return { role: ctx.actor.role, isOwner: ctx.actor.isOwner }
  })

  it("runs the action as an authorised actor inside a transaction", async () => {
    const original = await titleOf()
    signInAs(f.users.creator)
    const result = await rename({ eventId: f.event1.id, title: "renamed" })
    expect(result?.data).toEqual({ role: "admin", isOwner: true })
    expect(await titleOf()).toBe("renamed")
    await db
      .update(events)
      .set({ title: original! })
      .where(eq(events.id, f.event1.id))
  })

  it("denies a caller without the permission and changes nothing", async () => {
    const original = await titleOf()
    signInAs(f.users.management)
    const result = await rename({ eventId: f.event1.id, title: "nope" })
    expect(result?.serverError).toBe("Forbidden: insufficient permissions")
    expect(await titleOf()).toBe(original)
  })

  it("denies anonymous callers and non-members", async () => {
    signInAs(null)
    expect(
      (await rename({ eventId: f.event1.id, title: "nope" }))?.serverError
    ).toBe("Unauthorized")
    signInAs(f.users.outsider)
    expect(
      (await rename({ eventId: f.event1.id, title: "nope" }))?.serverError
    ).toBe("Forbidden: insufficient permissions")
  })

  it("rejects invalid input before touching the policy", async () => {
    signInAs(f.users.creator)
    const result = await rename({ eventId: f.event1.id, title: "" })
    expect(result?.validationErrors).toBeDefined()
    expect(result?.data).toBeUndefined()
  })

  it("rolls the transaction back when the action fails", async () => {
    const original = await titleOf()
    signInAs(f.users.creator)
    const result = await rename({ eventId: f.event1.id, title: "boom" })
    expect(result?.data).toBeUndefined()
    expect(result?.serverError).toBeDefined()
    expect(await titleOf()).toBe(original)
  })
})
