/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { addMember, changeRole, removeMember } from "@/server/authz/membership"
import {
  createClanInvite,
  deleteClanInvite,
  joinClanWithInvite,
  leaveClan,
  revokeClanInvite,
  updateClanInviteLabel,
  updateMemberRole,
} from "@/app/actions/clan"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
// Role and membership rules (owner, last admin, who may change what) are
// covered against a real database in src/server/__tests__/membership.test.ts;
// here only the wiring of the actions is checked.
jest.mock("@/server/authz/membership", () => ({
  addMember: jest.fn(),
  changeRole: jest.fn(),
  removeMember: jest.fn(),
}))
jest.mock("@/app/actions/events", () => ({ getUserRole: jest.fn() }))
jest.mock("nanoid", () => ({ nanoid: () => "newcode123" }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => ({ db: { transaction: jest.fn() } }))

const session = getServerAuthSession as jest.Mock
const mockAddMember = addMember as jest.Mock
const mockChangeRole = changeRole as jest.Mock
const mockRemoveMember = removeMember as jest.Mock
const transaction = (db as unknown as { transaction: jest.Mock }).transaction

/** Awaitable query-builder stub: every method returns itself. */
function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of [
    "from",
    "where",
    "set",
    "values",
    "returning",
    "limit",
    "innerJoin",
  ]) {
    c[m] = jest.fn(() => c)
  }
  c.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return c
}

interface Fixture {
  clan?: { id: string; ownerId: string | null; name?: string } | undefined
  /** Membership rows by user id. */
  members?: Record<string, { role: string; clanId?: string } | undefined>
  memberships?: { clanId: string }[]
  invite?: Record<string, unknown> | undefined
  adminCount?: number
  activeInvites?: number
  claimed?: unknown[]
  removed?: unknown[]
}

function setup(f: Fixture) {
  const calls = { members: [] as unknown[] }
  const tx = {
    query: {
      clans: { findFirst: jest.fn(async () => f.clan) },
      clanMembers: {
        // Queued in call order: actor first, then target.
        findFirst: jest.fn(async () => calls.members.shift()),
        findMany: jest.fn(async () => f.memberships ?? []),
      },
      clanInvites: { findFirst: jest.fn(async () => f.invite) },
    },
    select: jest.fn(() => chain([{ count: f.adminCount ?? f.activeInvites ?? 0 }])),
    update: jest.fn(() => chain(f.claimed ?? [{ id: "inv" }])),
    insert: jest.fn(() => chain([{ id: "new-invite", inviteCode: "newcode123" }])),
    delete: jest.fn(() => chain(f.removed ?? [{ id: "m" }])),
  }
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  return { tx, queueMembers: (...rows: unknown[]) => calls.members.push(...rows) }
}

beforeEach(() => {
  jest.resetAllMocks()
  session.mockResolvedValue({ user: { id: "actor" } })
})

describe("updateMemberRole", () => {
  it("rejects signed-out callers without touching the db", async () => {
    session.mockResolvedValue(null)
    const result = await updateMemberRole("c1", "u2", "member")
    expect(result.success).toBe(false)
    expect(mockChangeRole).not.toHaveBeenCalled()
  })

  it("changes the role through the membership helper as the caller", async () => {
    mockChangeRole.mockResolvedValue({ success: true, changed: true })
    const result = await updateMemberRole("c1", "u2", "management")
    expect(result).toEqual({ success: true })
    expect(mockChangeRole).toHaveBeenCalledWith({
      scope: "clan",
      parentId: "c1",
      userId: "u2",
      newRole: "management",
      actor: { kind: "user", userId: "actor" },
    })
  })

  it("passes a refusal of the helper on as the error", async () => {
    mockChangeRole.mockResolvedValue({
      success: false,
      code: "OWNER_PROTECTED",
      error: "The clan owner's role cannot be changed",
    })
    expect(await updateMemberRole("c1", "owner", "member")).toEqual({
      success: false,
      error: "The clan owner's role cannot be changed",
    })
  })

  it("rejects unknown roles before touching the db", async () => {
    const result = await updateMemberRole("c1", "u2", "owner" as never)
    expect(result.success).toBe(false)
    expect(mockChangeRole).not.toHaveBeenCalled()
  })
})

describe("leaveClan", () => {
  it("removes the caller's own membership", async () => {
    mockRemoveMember.mockResolvedValue({ success: true, changed: true })
    expect(await leaveClan("c1")).toEqual({ success: true })
    expect(mockRemoveMember).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "clan",
        parentId: "c1",
        userId: "actor",
        actor: { kind: "self", userId: "actor" },
      })
    )
  })

  it("passes the owner block on as the error", async () => {
    mockRemoveMember.mockResolvedValue({
      success: false,
      code: "OWNER_PROTECTED",
      error: "The clan owner can't leave the clan",
    })
    expect(await leaveClan("c1")).toEqual({
      success: false,
      error: "The clan owner can't leave the clan",
    })
  })

  it("reports when the caller was not a member", async () => {
    mockRemoveMember.mockResolvedValue({
      success: false,
      code: "NOT_A_MEMBER",
      error: "Not a member of this clan",
    })
    expect(await leaveClan("c1")).toEqual({
      success: false,
      error: "You're not a member of this clan",
    })
  })
})

describe("joinClanWithInvite", () => {
  const future = new Date(Date.now() + 86_400_000)
  const invite = (extra: object = {}) => ({
    id: "inv",
    clanId: "c1",
    isActive: true,
    expiresAt: future,
    maxUses: null,
    currentUses: 0,
    clan: { id: "c1", name: "Frogs" },
    ...extra,
  })

  beforeEach(() => {
    mockAddMember.mockResolvedValue({ success: true, changed: true })
  })

  it("accepts a pasted link and joins as a member", async () => {
    setup({ invite: invite(), memberships: [{ clanId: "other" }] })
    const result = await joinClanWithInvite(
      "https://bingoscape.org/clans/join?code=abc123"
    )
    expect(result).toEqual({
      success: true,
      clanId: "c1",
      clanName: "Frogs",
      isMain: false,
    })
    expect(mockAddMember).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "clan",
        parentId: "c1",
        userId: "actor",
        role: "member",
        isMain: false,
        actor: { kind: "self", userId: "actor" },
      })
    )
  })

  it("makes the first clan the main clan", async () => {
    setup({ invite: invite(), memberships: [] })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({ success: true, isMain: true })
  })

  it.each([
    ["missing", undefined, "invalid"],
    ["revoked", invite({ isActive: false }), "revoked"],
    ["expired", invite({ expiresAt: new Date(0) }), "expired"],
    ["used up", invite({ maxUses: 2, currentUses: 2 }), "limit-reached"],
  ])("refuses a %s invite", async (_name, inv, reason) => {
    setup({ invite: inv })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({ success: false, reason })
    expect(mockAddMember).not.toHaveBeenCalled()
  })

  it("refuses when already a member and points at the clan", async () => {
    setup({ invite: invite(), memberships: [{ clanId: "c1" }] })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({
      success: false,
      reason: "already-member",
      clanId: "c1",
    })
    expect(mockAddMember).not.toHaveBeenCalled()
  })

  it("does not overspend a limited invite when the claim loses a race", async () => {
    setup({ invite: invite({ maxUses: 1 }), claimed: [] })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({ success: false, reason: "limit-reached" })
    expect(mockAddMember).not.toHaveBeenCalled()
  })

  it("rejects unusable input without a transaction", async () => {
    const result = await joinClanWithInvite("   ")
    expect(result.success).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe("invite management", () => {
  it.each(["member", "guest"])("%s cannot create invites", async (role) => {
    const { tx, queueMembers } = setup({})
    queueMembers({ role })
    const result = await createClanInvite({ clanId: "c1" })
    expect(result.success).toBe(false)
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it.each(["admin", "management"])("%s can create invites", async (role) => {
    const { tx, queueMembers } = setup({ activeInvites: 3 })
    queueMembers({ role })
    const result = await createClanInvite({
      clanId: "c1",
      label: "  Discord  ",
      expiresInDays: 7,
      maxUses: 5,
    })
    expect(result.success).toBe(true)
    expect(tx.insert).toHaveBeenCalledTimes(1)
  })

  it("enforces the active invite cap", async () => {
    const { tx, queueMembers } = setup({ activeInvites: 50 })
    queueMembers({ role: "admin" })
    expect((await createClanInvite({ clanId: "c1" })).success).toBe(false)
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it("validates limits before the db", async () => {
    expect(
      (await createClanInvite({ clanId: "c1", maxUses: 0 })).success
    ).toBe(false)
    expect(
      (await createClanInvite({ clanId: "c1", expiresInDays: 9999 })).success
    ).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each([
    ["revoke", (id: string) => revokeClanInvite(id)],
    ["delete", (id: string) => deleteClanInvite(id)],
    ["relabel", (id: string) => updateClanInviteLabel(id, "x")],
  ])("%s requires a manager of the invite's clan", async (_n, run) => {
    const { tx, queueMembers } = setup({ invite: { id: "inv", clanId: "c1" } })
    queueMembers({ role: "member" })
    expect((await run("inv")).success).toBe(false)
    expect(tx.update).not.toHaveBeenCalled()
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it("lets a manager revoke", async () => {
    const { tx, queueMembers } = setup({ invite: { id: "inv", clanId: "c1" } })
    queueMembers({ role: "management" })
    expect(await revokeClanInvite("inv")).toEqual({ success: true })
    expect(tx.update).toHaveBeenCalledTimes(1)
  })
})
