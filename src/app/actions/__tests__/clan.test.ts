/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
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
jest.mock("@/app/actions/events", () => ({ getUserRole: jest.fn() }))
jest.mock("nanoid", () => ({ nanoid: () => "newcode123" }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => ({ db: { transaction: jest.fn() } }))

const session = getServerAuthSession as jest.Mock
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
  const clan = { id: "c1", ownerId: "owner" }

  it("rejects signed-out callers without touching the db", async () => {
    session.mockResolvedValue(null)
    const result = await updateMemberRole("c1", "u2", "member")
    expect(result.success).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each(["management", "member", "guest"])(
    "rejects a %s caller (only admins change roles)",
    async (role) => {
      const { tx, queueMembers } = setup({ clan, adminCount: 2 })
      queueMembers({ role }, { role: "guest" })
      const result = await updateMemberRole("c1", "u2", "member")
      expect(result).toEqual({
        success: false,
        error: "Only clan admins can change member roles",
      })
      expect(tx.update).not.toHaveBeenCalled()
    }
  )

  it("lets an admin change another member's role", async () => {
    const { tx, queueMembers } = setup({ clan, adminCount: 1 })
    queueMembers({ role: "admin" }, { role: "member" })
    const result = await updateMemberRole("c1", "u2", "management")
    expect(result).toEqual({ success: true })
    expect(tx.update).toHaveBeenCalledTimes(1)
  })

  it("protects the clan owner from demotion", async () => {
    const { tx, queueMembers } = setup({ clan, adminCount: 3 })
    queueMembers({ role: "admin" }, { role: "admin" })
    const result = await updateMemberRole("c1", "owner", "member")
    expect(result).toEqual({
      success: false,
      error: "The clan owner's role cannot be changed",
    })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("never leaves the clan without an admin", async () => {
    const { tx, queueMembers } = setup({ clan, adminCount: 1 })
    queueMembers({ role: "admin" }, { role: "admin" })
    const result = await updateMemberRole("c1", "u2", "member")
    expect(result.success).toBe(false)
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("rejects a target who is not in the clan", async () => {
    const { tx, queueMembers } = setup({ clan, adminCount: 2 })
    queueMembers({ role: "admin" }, undefined)
    const result = await updateMemberRole("c1", "stranger", "member")
    expect(result.success).toBe(false)
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("rejects unknown roles before touching the db", async () => {
    const result = await updateMemberRole("c1", "u2", "owner" as never)
    expect(result.success).toBe(false)
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe("leaveClan", () => {
  it("blocks the owner", async () => {
    const { tx } = setup({ clan: { id: "c1", ownerId: "actor" } })
    const result = await leaveClan("c1")
    expect(result.success).toBe(false)
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it("lets a regular member leave", async () => {
    const { tx } = setup({ clan: { id: "c1", ownerId: "owner" } })
    expect(await leaveClan("c1")).toEqual({ success: true })
    expect(tx.delete).toHaveBeenCalledTimes(1)
  })

  it("reports when the caller was not a member", async () => {
    setup({ clan: { id: "c1", ownerId: "owner" }, removed: [] })
    expect((await leaveClan("c1")).success).toBe(false)
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

  it("accepts a pasted link and joins as a member", async () => {
    const { tx } = setup({ invite: invite(), memberships: [{ clanId: "other" }] })
    const result = await joinClanWithInvite(
      "https://bingoscape.org/clans/join?code=abc123"
    )
    expect(result).toEqual({
      success: true,
      clanId: "c1",
      clanName: "Frogs",
      isMain: false,
    })
    expect(tx.insert).toHaveBeenCalledTimes(1)
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
    const { tx } = setup({ invite: inv })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({ success: false, reason })
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it("refuses when already a member and points at the clan", async () => {
    const { tx } = setup({ invite: invite(), memberships: [{ clanId: "c1" }] })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({
      success: false,
      reason: "already-member",
      clanId: "c1",
    })
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it("does not overspend a limited invite when the claim loses a race", async () => {
    const { tx } = setup({ invite: invite({ maxUses: 1 }), claimed: [] })
    const result = await joinClanWithInvite("abc123")
    expect(result).toMatchObject({ success: false, reason: "limit-reached" })
    expect(tx.insert).not.toHaveBeenCalled()
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
