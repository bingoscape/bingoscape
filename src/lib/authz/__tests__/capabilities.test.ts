/**
 * @jest-environment node
 */
import {
  capabilitiesForMembership,
  computeCapabilities,
  type EventCapabilities,
} from "@/lib/authz/capabilities"
import type { EventActor } from "@/lib/authz/policy"
import { eventRoleLabel, type EventRole } from "@/lib/authz/roles"

function actor(
  role: EventRole | null,
  overrides: Partial<EventActor> = {}
): EventActor {
  return {
    userId: "user-1",
    eventId: "event-1",
    role,
    isOwner: false,
    teams: [],
    ...overrides,
  }
}

type Flags = Omit<
  EventCapabilities,
  "role" | "isOwner" | "isManager" | "isAdmin" | "can"
>

// Written out by hand: the UI affordances each role had before capabilities
// were computed on the server (with the three corrections noted below).
const NONE: Flags = {
  canViewManagerPages: false,
  canManageParticipants: false,
  canAssignTeams: false,
  canRemoveParticipants: false,
  canChangeRoles: false,
  canReviewRegistrations: false,
  canEditBoard: false,
  canReviewSubmissions: false,
  canManageTeams: false,
  canManageFinance: false,
  canEditEvent: false,
  canInvite: false,
  canAssignClan: false,
  canManageRules: false,
  canDeleteEvent: false,
  canViewDraft: false,
  canManageDraft: false,
  canPick: false,
  assignableRoles: [],
  removableRoles: [],
}

const MANAGER: Flags = {
  ...NONE,
  canViewManagerPages: true,
  canManageParticipants: true,
  canAssignTeams: true,
  canRemoveParticipants: true,
  canReviewRegistrations: true,
  canEditBoard: true,
  canReviewSubmissions: true,
  canManageTeams: true,
  canManageFinance: true,
  canViewDraft: true,
  canManageDraft: true,
  // Management cannot remove an admin.
  removableRoles: ["management", "participant"],
}

function flagsOf(caps: EventCapabilities): Flags {
  const { role, isOwner, isManager, isAdmin, can, ...flags } = caps
  void role
  void isOwner
  void isManager
  void isAdmin
  void can
  return flags
}

describe("computeCapabilities: named capabilities per role", () => {
  it("gives a signed-out caller and a non-member nothing", () => {
    expect(flagsOf(computeCapabilities(null))).toEqual(NONE)
    expect(flagsOf(computeCapabilities(actor(null)))).toEqual(NONE)
  })

  it("gives a participant no manager page and no control", () => {
    const caps = computeCapabilities(actor("participant"))
    // Every member may open the draft room, nothing else.
    expect(flagsOf(caps)).toEqual({ ...NONE, canViewDraft: true })
    expect(caps.role).toBe("participant")
    expect(caps.isManager).toBe(false)
  })

  it("gives management the manager pages but not the admin controls", () => {
    expect(flagsOf(computeCapabilities(actor("management")))).toEqual(MANAGER)
  })

  it("gives a non-owner admin every admin control except the owner-only ones", () => {
    const caps = computeCapabilities(actor("admin"))
    expect(flagsOf(caps)).toEqual({
      ...MANAGER,
      canChangeRoles: true,
      canEditEvent: true,
      canInvite: true,
      canAssignClan: true,
      canManageRules: true,
      // Delete and granting admin belong to the owner.
      canDeleteEvent: false,
      assignableRoles: ["management", "participant"],
      removableRoles: ["admin", "management", "participant"],
    })
  })

  it("gives the owner everything, including granting admin and deleting", () => {
    const caps = computeCapabilities(actor("admin", { isOwner: true }))
    expect(flagsOf(caps)).toEqual({
      ...MANAGER,
      canChangeRoles: true,
      canEditEvent: true,
      canInvite: true,
      canAssignClan: true,
      canManageRules: true,
      canDeleteEvent: true,
      assignableRoles: ["admin", "management", "participant"],
      removableRoles: ["admin", "management", "participant"],
    })
    expect(caps.isOwner).toBe(true)
  })

  it("does not turn Team membership into a manager capability", () => {
    const caps = computeCapabilities(
      actor("participant", { teams: [{ teamId: "t1", isLeader: true }] })
    )
    // Leading a Team only adds the right to pick when it is that Team's turn.
    expect(flagsOf(caps)).toEqual({
      ...NONE,
      canViewDraft: true,
      canPick: true,
    })
  })

  it("lets only a Team leader pick, and only managers manage the draft", () => {
    const member = computeCapabilities(
      actor("participant", { teams: [{ teamId: "t1", isLeader: false }] })
    )
    expect(member.canPick).toBe(false)
    expect(member.canManageDraft).toBe(false)
    // A manager who leads no Team cannot pick; they force a pick instead.
    const manager = computeCapabilities(actor("management"))
    expect(manager.canPick).toBe(false)
    expect(manager.canManageDraft).toBe(true)
  })
})

describe("computeCapabilities: shape", () => {
  it("survives a JSON round trip (it crosses the server/client boundary)", () => {
    for (const role of ["admin", "management", "participant", null] as const) {
      const caps = computeCapabilities(actor(role, { isOwner: role === "admin" }))
      expect(JSON.parse(JSON.stringify(caps))).toEqual(caps)
    }
  })

  it("keeps the named flags in step with the permission map", () => {
    const caps = computeCapabilities(actor("management"))
    expect(caps.canEditBoard).toBe(caps.can["board:manage"])
    expect(caps.canManageFinance).toBe(caps.can["finance:write"])
    expect(caps.canChangeRoles).toBe(caps.can["participant:set-role"])
    expect(caps.canViewManagerPages).toBe(caps.isManager)
  })
})

describe("capabilitiesForMembership", () => {
  const base = { userId: "u1", eventId: "e1" }

  it("treats the creator as the admin owner, whatever their participant row says", () => {
    const caps = capabilitiesForMembership({
      ...base,
      creatorId: "u1",
      participantRole: null,
    })
    expect(caps).toMatchObject({
      role: "admin",
      isOwner: true,
      canEditEvent: true,
      canDeleteEvent: true,
    })
  })

  it("uses the participant role for everybody else", () => {
    const caps = capabilitiesForMembership({
      ...base,
      creatorId: "other",
      participantRole: "management",
    })
    expect(caps).toMatchObject({
      role: "management",
      isOwner: false,
      canViewManagerPages: true,
      canEditEvent: false,
    })
  })

  it("gives a non-member nothing", () => {
    const caps = capabilitiesForMembership({
      ...base,
      creatorId: "other",
      participantRole: null,
    })
    expect(flagsOf(caps)).toEqual(NONE)
  })
})

describe("eventRoleLabel", () => {
  it.each<[EventRole, string]>([
    ["admin", "Admin"],
    ["management", "Management"],
    ["participant", "Participant"],
  ])("%s -> %s", (role, label) => {
    expect(eventRoleLabel(role)).toBe(label)
  })
})
