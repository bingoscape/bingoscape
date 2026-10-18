/**
 * @jest-environment node
 */
import { computeCapabilities } from "@/lib/authz/capabilities"
import {
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/authz/permissions"
import {
  buildEventActor,
  can,
  evaluatePolicy,
  type EventActor,
  type PolicyResource,
} from "@/lib/authz/policy"
import { isManagerRole, type EventRole } from "@/lib/authz/roles"

const EVENT_ID = "event-1"
const TEAM_A = "team-a"
const TEAM_B = "team-b"

function actor(
  role: EventRole | null,
  overrides: Partial<EventActor> = {}
): EventActor {
  return {
    userId: "user-1",
    eventId: EVENT_ID,
    role,
    isOwner: false,
    teams: [],
    ...overrides,
  }
}

// Written out by hand, independent of ROLE_PERMISSIONS: this is the behaviour
// the inline role checks enforced before the policy layer existed.
const MANAGER_CAN: Permission[] = [
  "event:view",
  "participant:list",
  "participant:add",
  "participant:remove",
  "participant:assign-team",
  "registration:review",
  "stats:read",
  "player-metadata:read",
  "player-metadata:write",
  "player-metadata:write-own",
  "finance:read",
  "finance:write",
  "webhook:manage",
  "team:manage",
  "team:access",
  "team:lead",
  "board:manage",
  "board:view-secret",
  "submission:create",
  "submission:review",
  "submission:comment",
  "submission:read-comments",
  "submission:create-on-behalf",
  "draft:view",
  "draft:manage",
]
const ADMIN_ONLY: Permission[] = [
  "event:update",
  "event:invite",
  "event:assign-clan",
  "event:manage-rules",
  "event:override-registration",
  "participant:set-role",
]
// Admin permissions that only the Event owner can use (RBAC 3/8).
const OWNER_ONLY: Permission[] = [
  "event:delete",
  "event:grant-admin",
  "event:transfer-ownership",
]
const EXPECTED: Record<EventRole, Permission[]> = {
  admin: [...MANAGER_CAN, ...ADMIN_ONLY],
  management: MANAGER_CAN,
  participant: ["event:view", "player-metadata:write-own", "draft:view"],
}

describe("role -> permission matrix (no resource)", () => {
  const cases = (["admin", "management", "participant"] as const).flatMap(
    (role) => PERMISSIONS.map((permission) => [role, permission] as const)
  )

  it.each(cases)("%s / %s", (role, permission) => {
    expect(can(actor(role), permission)).toBe(
      EXPECTED[role].includes(permission)
    )
  })

  it("covers every permission exactly once per role", () => {
    const owner = [...ADMIN_ONLY, ...MANAGER_CAN, ...OWNER_ONLY]
    expect(new Set(ROLE_PERMISSIONS.admin)).toEqual(new Set(owner))
    expect(ROLE_PERMISSIONS.admin).toHaveLength(owner.length)
    for (const role of ["management", "participant"] as const) {
      expect(new Set(ROLE_PERMISSIONS[role])).toEqual(new Set(EXPECTED[role]))
      expect(ROLE_PERMISSIONS[role]).toHaveLength(EXPECTED[role].length)
    }
  })

  it.each(PERMISSIONS)("the owner (admin) / %s", (permission) => {
    expect(can(actor("admin", { isOwner: true }), permission)).toBe(
      [...EXPECTED.admin, ...OWNER_ONLY].includes(permission)
    )
  })

  it("keeps today's management rights: buy-ins and donations yes, roles no", () => {
    expect(can(actor("management"), "finance:write")).toBe(true)
    expect(can(actor("management"), "finance:read")).toBe(true)
    expect(can(actor("management"), "participant:set-role")).toBe(false)
  })

  it.each(PERMISSIONS)("a signed-out caller cannot %s", (permission) => {
    expect(can(null, permission)).toBe(false)
  })

  it.each(PERMISSIONS)("a non-member cannot %s", (permission) => {
    expect(can(actor(null), permission)).toBe(false)
  })
})

describe("relational rules", () => {
  it.each<[EventRole, EventRole, boolean]>([
    ["admin", "admin", true],
    ["admin", "management", true],
    ["admin", "participant", true],
    ["management", "admin", false],
    ["management", "management", true],
    ["management", "participant", true],
  ])("%s removing a %s: %s", (role, targetRole, allowed) => {
    expect(can(actor(role), "participant:remove", { targetRole })).toBe(allowed)
  })

  it.each<[EventRole, EventRole, EventRole, boolean]>([
    // actor, target's current role, new role
    // Granting admin is owner-only, see "owner-only permissions".
    ["admin", "participant", "admin", false],
    ["admin", "admin", "participant", true],
    ["admin", "management", "management", true],
    // Only admins hold participant:set-role at all today.
    ["management", "participant", "management", false],
    ["participant", "participant", "participant", false],
  ])("%s changing a %s to %s: %s", (role, targetRole, newRole, allowed) => {
    expect(
      can(actor(role), "participant:set-role", { targetRole, newRole })
    ).toBe(allowed)
  })

  it("never grants a role above the actor's own", () => {
    // A hypothetical map that lets management set roles: the relational rule
    // must still stop them granting admin or touching an admin.
    const map = {
      ...ROLE_PERMISSIONS,
      management: ["participant:set-role"],
    } as const
    const manager = actor("management")
    const evaluate = (resource: PolicyResource) =>
      evaluatePolicy(manager, "participant:set-role", resource, new Set(), map)

    expect(evaluate({ newRole: "admin" })).toBe(false)
    expect(evaluate({ newRole: "participant" })).toBe(true)
    expect(evaluate({ targetRole: "admin", newRole: "participant" })).toBe(
      false
    )
  })
})

describe("Team scoped permissions", () => {
  const leader = actor("participant", {
    teams: [{ teamId: TEAM_A, isLeader: true }],
  })
  const member = actor("participant", {
    teams: [{ teamId: TEAM_A, isLeader: false }],
  })

  it("a Team member may submit and read comments for their own Team only", () => {
    for (const permission of [
      "submission:create",
      "submission:read-comments",
      "team:access",
    ] as const) {
      expect(can(member, permission, { teamId: TEAM_A })).toBe(true)
      expect(can(member, permission, { teamId: TEAM_B })).toBe(false)
      // Without a resource only the role grant counts.
      expect(can(member, permission)).toBe(false)
    }
  })

  it("only the Team leader may lead their Team", () => {
    expect(can(leader, "team:lead", { teamId: TEAM_A })).toBe(true)
    expect(can(member, "team:lead", { teamId: TEAM_A })).toBe(false)
    expect(can(leader, "team:lead", { teamId: TEAM_B })).toBe(false)
  })

  it("a Team member gets nothing beyond their own Team's permissions", () => {
    for (const permission of [
      "team:manage",
      "submission:review",
      "submission:comment",
      "finance:read",
      "board:view-secret",
    ] as const) {
      expect(can(leader, permission, { teamId: TEAM_A })).toBe(false)
    }
  })

  it("only the leader of the on-turn Team holds draft:pick, whatever the Event role", () => {
    expect(can(leader, "draft:pick", { teamId: TEAM_A })).toBe(true)
    expect(can(leader, "draft:pick", { teamId: TEAM_B })).toBe(false)
    expect(can(member, "draft:pick", { teamId: TEAM_A })).toBe(false)
    // No resource, no pick: the on-turn Team is part of the question.
    expect(can(leader, "draft:pick")).toBe(false)
    for (const role of ["admin", "management", "participant"] as const) {
      expect(can(actor(role), "draft:pick")).toBe(false)
      expect(can(actor(role), "draft:pick", { teamId: TEAM_A })).toBe(false)
    }
    expect(
      can(actor("admin", { isOwner: true }), "draft:pick", { teamId: TEAM_A })
    ).toBe(false)
  })

  it("every member may view the draft; only managers manage it", () => {
    for (const role of ["admin", "management", "participant"] as const) {
      expect(can(actor(role), "draft:view")).toBe(true)
    }
    expect(can(actor("admin"), "draft:manage")).toBe(true)
    expect(can(actor("management"), "draft:manage")).toBe(true)
    expect(can(actor("participant"), "draft:manage")).toBe(false)
    // Leading a Team does not manage the draft.
    expect(can(leader, "draft:manage", { teamId: TEAM_A })).toBe(false)
    expect(can(null, "draft:view")).toBe(false)
  })

  it("a manager needs no Team membership", () => {
    expect(
      can(actor("management"), "submission:create", { teamId: TEAM_B })
    ).toBe(true)
    expect(can(actor("management"), "team:lead", { teamId: TEAM_B })).toBe(true)
  })

  it("a non-member Team member (no Event role) still gets Team permissions", () => {
    const teamOnly = actor(null, {
      teams: [{ teamId: TEAM_A, isLeader: true }],
    })
    expect(can(teamOnly, "team:access", { teamId: TEAM_A })).toBe(true)
    expect(can(teamOnly, "event:view")).toBe(false)
  })
})

describe("owner-only permissions", () => {
  const ownerOnly = new Set<Permission>(["event:delete"])

  it("covers delete Event, grant admin and transfer ownership", () => {
    expect([...OWNER_ONLY_PERMISSIONS].sort()).toEqual([...OWNER_ONLY].sort())
    for (const permission of OWNER_ONLY) {
      expect(can(actor("admin"), permission)).toBe(false)
      expect(can(actor("admin", { isOwner: true }), permission)).toBe(true)
    }
    // Everything else an admin may do stays with every admin.
    expect(can(actor("admin"), "event:update")).toBe(true)
    expect(can(actor("admin"), "participant:remove")).toBe(true)
  })

  it("only the owner grants the admin role, by set-role or add", () => {
    const admin = actor("admin")
    const owner = actor("admin", { isOwner: true })
    for (const permission of [
      "participant:set-role",
      "participant:add",
    ] as const) {
      expect(can(admin, permission, { newRole: "admin" })).toBe(false)
      expect(can(owner, permission, { newRole: "admin" })).toBe(true)
      expect(can(admin, permission, { newRole: "management" })).toBe(true)
    }
  })

  it("nobody adds a participant above their own role", () => {
    expect(
      can(actor("management"), "participant:add", { newRole: "participant" })
    ).toBe(true)
    expect(
      can(actor("management"), "participant:add", { newRole: "management" })
    ).toBe(true)
    expect(
      can(actor("management"), "participant:add", { newRole: "admin" })
    ).toBe(false)
  })

  it("needs isOwner when a permission is marked owner-only", () => {
    const admin = actor("admin")
    const owner = actor("admin", { isOwner: true })
    expect(evaluatePolicy(admin, "event:delete", {}, ownerOnly)).toBe(false)
    expect(evaluatePolicy(owner, "event:delete", {}, ownerOnly)).toBe(true)
    expect(evaluatePolicy(admin, "event:update", {}, ownerOnly)).toBe(true)
  })
})

describe("buildEventActor", () => {
  const base = { userId: "u", eventId: EVENT_ID }

  it.each<[EventRole | null]>([
    [null],
    ["participant"],
    ["management"],
    ["admin"],
  ])(
    "the creator is the owner and holds exactly the role of their row (%s)",
    (participantRole) => {
      const result = buildEventActor({
        ...base,
        creatorId: "u",
        participantRole,
      })
      expect(result.role).toBe(participantRole)
      expect(result.isOwner).toBe(true)
    }
  )

  it("a creator without a participant row cannot act (no implicit admin)", () => {
    const orphan = buildEventActor({
      ...base,
      creatorId: "u",
      participantRole: null,
    })
    expect(can(orphan, "event:update")).toBe(false)
    expect(can(orphan, "event:delete")).toBe(false)
  })

  it("keeps the participant role for everybody else", () => {
    expect(
      buildEventActor({
        ...base,
        creatorId: "x",
        participantRole: "management",
      })
    ).toMatchObject({ role: "management", isOwner: false })
    expect(
      buildEventActor({ ...base, creatorId: "x", participantRole: null })
    ).toMatchObject({ role: null, isOwner: false })
  })

  it("an Event without a creator has no owner, unless a fallback is given", () => {
    expect(
      buildEventActor({ ...base, creatorId: null, participantRole: "admin" })
    ).toMatchObject({ role: "admin", isOwner: false })
    expect(
      buildEventActor({
        ...base,
        creatorId: null,
        ownerFallbackId: "u",
        participantRole: "admin",
      })
    ).toMatchObject({ role: "admin", isOwner: true })
  })

  it("ignores the fallback while a creator exists", () => {
    expect(
      buildEventActor({
        ...base,
        creatorId: "x",
        ownerFallbackId: "u",
        participantRole: "admin",
      })
    ).toMatchObject({ role: "admin", isOwner: false })
  })

  it("defaults to no Teams", () => {
    expect(
      buildEventActor({ ...base, creatorId: null, participantRole: null }).teams
    ).toEqual([])
  })
})

describe("isManagerRole", () => {
  it.each<[EventRole | null | undefined, boolean]>([
    ["admin", true],
    ["management", true],
    ["participant", false],
    [null, false],
    [undefined, false],
  ])("%s -> %s", (role, expected) => {
    expect(isManagerRole(role)).toBe(expected)
  })
})

describe("computeCapabilities", () => {
  it("is serialisable and mirrors can()", () => {
    const caps = computeCapabilities(actor("management"))
    expect(JSON.parse(JSON.stringify(caps))).toEqual(caps)
    expect(caps).toMatchObject({
      role: "management",
      isOwner: false,
      isManager: true,
      isAdmin: false,
    })
    for (const permission of PERMISSIONS) {
      expect(caps.can[permission]).toBe(can(actor("management"), permission))
    }
  })

  it("flags the owner", () => {
    const caps = computeCapabilities(actor("admin", { isOwner: true }))
    expect(caps).toMatchObject({
      isOwner: true,
      isAdmin: true,
      isManager: true,
    })
    expect(caps.can["participant:set-role"]).toBe(true)
  })

  it("grants nothing to a signed-out caller", () => {
    const caps = computeCapabilities(null)
    expect(caps).toMatchObject({
      role: null,
      isOwner: false,
      isManager: false,
      isAdmin: false,
    })
    expect(Object.values(caps.can).every((v) => v === false)).toBe(true)
  })
})
