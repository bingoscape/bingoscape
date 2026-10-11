import {
  buildClanInviteUrl,
  canChangeRoles,
  canManageInvites,
  getInviteStatus,
  parseClanInviteCode,
  resolveInviteState,
  validateRoleChange,
} from "@/lib/clan"

const NOW = new Date("2026-10-11T12:00:00Z")
const invite = (extra: object = {}) => ({
  isActive: true,
  expiresAt: null,
  maxUses: null,
  currentUses: 0,
  ...extra,
})

describe("role permissions", () => {
  it("only admins change roles; admins and managers manage invites", () => {
    expect(canChangeRoles("admin")).toBe(true)
    expect(canChangeRoles("management")).toBe(false)
    expect(canManageInvites("management")).toBe(true)
    expect(canManageInvites("member")).toBe(false)
  })

  const base = {
    actorId: "a",
    actorRole: "admin" as const,
    targetId: "t",
    targetRole: "member" as const,
    newRole: "management" as const,
    ownerId: "o",
    adminCount: 2,
  }

  it("allows an admin to change a member", () => {
    expect(validateRoleChange(base)).toEqual({ ok: true })
  })

  it("denies non-admin actors", () => {
    expect(validateRoleChange({ ...base, actorRole: "management" }).ok).toBe(
      false
    )
  })

  it("protects the owner from demotion but allows keeping admin", () => {
    const owner = { ...base, targetId: "o", targetRole: "admin" as const }
    expect(validateRoleChange({ ...owner, newRole: "member" }).ok).toBe(false)
    expect(validateRoleChange({ ...owner, newRole: "admin" }).ok).toBe(true)
  })

  it("keeps at least one admin", () => {
    const lastAdmin = {
      ...base,
      targetRole: "admin" as const,
      newRole: "member" as const,
      adminCount: 1,
    }
    expect(validateRoleChange(lastAdmin).ok).toBe(false)
    expect(validateRoleChange({ ...lastAdmin, adminCount: 2 }).ok).toBe(true)
  })
})

describe("invite status", () => {
  it("is active by default", () => {
    expect(getInviteStatus(invite(), NOW)).toBe("active")
  })
  it("detects expiry, revocation and exhaustion", () => {
    expect(getInviteStatus(invite({ expiresAt: new Date("2026-10-01") }), NOW)).toBe(
      "expired"
    )
    expect(getInviteStatus(invite({ isActive: false }), NOW)).toBe("revoked")
    expect(getInviteStatus(invite({ maxUses: 3, currentUses: 3 }), NOW)).toBe(
      "exhausted"
    )
  })
  it("treats a legacy deactivated, used-up invite as used up", () => {
    expect(
      getInviteStatus(invite({ isActive: false, maxUses: 1, currentUses: 1 }), NOW)
    ).toBe("exhausted")
  })
  it("lets membership win over link state", () => {
    expect(resolveInviteState(invite({ isActive: false }), true, NOW)).toBe(
      "already-member"
    )
    expect(resolveInviteState(invite(), false, NOW)).toBe("ready")
    expect(
      resolveInviteState(invite({ maxUses: 1, currentUses: 1 }), false, NOW)
    ).toBe("limit-reached")
  })
})

describe("parseClanInviteCode", () => {
  it("accepts bare codes and join links", () => {
    expect(parseClanInviteCode("  abc123XYZ_ ")).toBe("abc123XYZ_")
    expect(
      parseClanInviteCode("https://bingoscape.org/clans/join?code=abc123")
    ).toBe("abc123")
    expect(parseClanInviteCode("/clans/join?foo=1&code=zz9#top")).toBe("zz9")
  })
  it("rejects empty or malformed input", () => {
    expect(parseClanInviteCode("")).toBeNull()
    expect(parseClanInviteCode("two words")).toBeNull()
    expect(parseClanInviteCode("https://example.com/other")).toBeNull()
    expect(parseClanInviteCode("a".repeat(65))).toBeNull()
  })
  it("round-trips with buildClanInviteUrl", () => {
    const url = buildClanInviteUrl("https://x.test", "abc-123")
    expect(parseClanInviteCode(url)).toBe("abc-123")
  })
})
