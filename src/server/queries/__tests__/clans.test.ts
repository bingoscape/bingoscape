/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getClanInvitePreview } from "@/server/queries/clans"

jest.mock("@/server/db", () => {
  const table = () => ({ findFirst: jest.fn(), findMany: jest.fn() })
  return {
    db: {
      query: { clanInvites: table(), clanMembers: table(), users: table() },
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
})

const mockDb = db as unknown as {
  query: Record<string, { findFirst: jest.Mock; findMany: jest.Mock }>
  select: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}
const q = mockDb.query

function stubCounts(members: number) {
  mockDb.select.mockImplementation(() => {
    const c: Record<string, unknown> = {}
    for (const m of ["from", "where", "groupBy"]) c[m] = jest.fn(() => c)
    c.then = (resolve: (v: unknown) => unknown) =>
      resolve([{ clanId: "c1", count: members }])
    return c
  })
}

const future = new Date(Date.now() + 86_400_000)
const invite = (extra: object = {}) => ({
  id: "inv",
  clanId: "c1",
  isActive: true,
  expiresAt: future,
  maxUses: null,
  currentUses: 0,
  label: "Discord",
  clan: {
    id: "c1",
    name: "Frogs",
    description: "We hop",
    ownerId: "owner",
  },
  ...extra,
})

beforeEach(() => {
  jest.resetAllMocks()
  q.clanMembers!.findMany.mockResolvedValue([])
  q.users!.findFirst.mockResolvedValue({
    id: "owner",
    name: "Owner",
    runescapeName: "Frog King",
    image: null,
  })
  stubCounts(12)
})

describe("getClanInvitePreview", () => {
  it("is invalid for an unknown code", async () => {
    q.clanInvites!.findFirst.mockResolvedValue(undefined)
    expect(await getClanInvitePreview("nope", "me")).toEqual({
      state: "invalid",
    })
  })

  it("previews a usable invite with counts only (no member list)", async () => {
    q.clanInvites!.findFirst.mockResolvedValue(invite({ maxUses: 5, currentUses: 2 }))
    const preview = await getClanInvitePreview("abc", "me")
    expect(preview).toMatchObject({
      state: "ready",
      clan: {
        id: "c1",
        name: "Frogs",
        memberCount: 12,
        owner: { runescapeName: "Frog King" },
      },
      invite: { usesLeft: 3 },
      becomesMain: true,
    })
    expect(JSON.stringify(preview)).not.toContain("members\":[")
  })

  it("is not the main clan when the viewer already has one", async () => {
    q.clanInvites!.findFirst.mockResolvedValue(invite())
    q.clanMembers!.findMany.mockResolvedValue([{ clanId: "other", isMain: true }])
    expect(await getClanInvitePreview("abc", "me")).toMatchObject({
      state: "ready",
      becomesMain: false,
    })
  })

  it.each([
    ["revoked", invite({ isActive: false })],
    ["expired", invite({ expiresAt: new Date(0) })],
    ["limit-reached", invite({ maxUses: 1, currentUses: 1 })],
  ])("reports %s with only the clan name", async (state, inv) => {
    q.clanInvites!.findFirst.mockResolvedValue(inv)
    expect(await getClanInvitePreview("abc", "me")).toEqual({
      state,
      clan: { id: "c1", name: "Frogs" },
    })
  })

  it("reports already-member even for a revoked invite", async () => {
    q.clanInvites!.findFirst.mockResolvedValue(invite({ isActive: false }))
    q.clanMembers!.findMany.mockResolvedValue([{ clanId: "c1", isMain: false }])
    expect(await getClanInvitePreview("abc", "me")).toEqual({
      state: "already-member",
      clan: { id: "c1", name: "Frogs" },
    })
  })

  it("never writes", async () => {
    q.clanInvites!.findFirst.mockResolvedValue(invite())
    await getClanInvitePreview("abc", "me")
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(mockDb.delete).not.toHaveBeenCalled()
  })
})
