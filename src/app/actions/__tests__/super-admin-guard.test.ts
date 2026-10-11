/**
 * @jest-environment node
 *
 * Unit tests for the super-admin guard, validation and invariants. The DB,
 * auth session and Next.js request APIs are mocked, so no database is needed.
 */
import { containsPattern, escapeLike } from "@/lib/admin-list-params"
import {
  deleteUser,
  removeClanMember,
  updateUser,
} from "@/app/actions/super-admin"
import { checkSuperAdmin, isSuperAdmin } from "@/lib/super-admin"
import {
  getSuperAdminEmails,
  isSuperAdminEmail,
  maskEmail,
  normalizeEmail,
  parseSuperAdminEmails,
} from "@/lib/super-admin-email"
import {
  emailChangeBlocker,
  membershipChangeBlocker,
  userDeleteBlocker,
} from "@/lib/super-admin-invariants"
import { logger } from "@/lib/logger"
import { updateUserSchema } from "@/lib/validation/super-admin"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/server/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), transaction: jest.fn() },
}))
jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/headers", () => ({ headers: async () => new Headers() }))

type MockFn = jest.Mock

const mockSession = getServerAuthSession as unknown as MockFn
const mockDb = db as unknown as {
  select: MockFn
  insert: MockFn
  transaction: MockFn
}
const mockLogger = logger as unknown as { warn: MockFn }

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ID = "22222222-2222-4222-8222-222222222222"
const CLAN_ID = "33333333-3333-4333-8333-333333333333"

/** An awaitable query-builder stand-in: every method returns itself, awaiting yields `rows`. */
function queryResult(rows: unknown[]): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(rows)
        }
        return () => proxy
      },
    }
  )
  return proxy
}

function fakeTx(rows: unknown[]) {
  return {
    select: jest.fn(() => queryResult(rows)),
    update: jest.fn(() => queryResult([{ id: "x" }])),
    delete: jest.fn(() => queryResult([{ id: "x" }])),
    insert: jest.fn(() => queryResult([])),
    execute: jest.fn(async () => undefined),
  }
}

/** Signs in `ADMIN_ID` whose DB row has `dbEmail`. The JWT email is deliberately different. */
function signInAsAdmin(dbEmail: string | null = "admin@example.com") {
  mockSession.mockResolvedValue({
    user: { id: ADMIN_ID, email: "jwt-email@example.com" },
  })
  mockDb.select.mockReturnValue(queryResult([{ id: ADMIN_ID, email: dbEmail }]))
}

function useTransaction(tx: ReturnType<typeof fakeTx>) {
  mockDb.transaction.mockImplementation(async (callback: unknown) =>
    (callback as (tx: unknown) => Promise<unknown>)(tx)
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SUPER_ADMIN_EMAILS = "admin@example.com, Boss@Example.com ,,"
  mockDb.insert.mockReturnValue({ values: async () => undefined })
})

describe("email normalization", () => {
  it("trims, lower-cases and drops empty entries", () => {
    expect(parseSuperAdminEmails(" A@x.com, b@X.COM ,, ,a@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
    ])
    expect(parseSuperAdminEmails(undefined)).toEqual([])
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com")
    expect(normalizeEmail("   ")).toBeNull()
  })

  it("reads the env list on every call", () => {
    process.env.SUPER_ADMIN_EMAILS = "first@example.com"
    expect(getSuperAdminEmails()).toEqual(["first@example.com"])
    process.env.SUPER_ADMIN_EMAILS = "second@example.com"
    expect(getSuperAdminEmails()).toEqual(["second@example.com"])
  })

  it("matches case-insensitively and never matches an empty list or email", () => {
    expect(isSuperAdminEmail("ADMIN@example.com ")).toBe(true)
    expect(isSuperAdminEmail("nobody@example.com")).toBe(false)
    expect(isSuperAdminEmail(null)).toBe(false)
    process.env.SUPER_ADMIN_EMAILS = ""
    expect(isSuperAdminEmail("admin@example.com")).toBe(false)
  })

  it("masks emails for audit rows", () => {
    expect(maskEmail("Jane@Example.com")).toBe("j***@example.com")
    expect(maskEmail(null)).toBeNull()
  })
})

describe("super-admin guard", () => {
  it("denies callers without a session", async () => {
    mockSession.mockResolvedValue(null)
    await expect(isSuperAdmin()).resolves.toBe(false)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it("denies a non-admin user", async () => {
    signInAsAdmin("someone@example.com")
    await expect(isSuperAdmin()).resolves.toBe(false)
  })

  it("compares the email stored in the DB, not the JWT email", async () => {
    // JWT email is on the list, DB email is not: must be denied.
    process.env.SUPER_ADMIN_EMAILS = "jwt-email@example.com"
    signInAsAdmin("changed@example.com")
    await expect(isSuperAdmin()).resolves.toBe(false)
  })

  it("grants access for a DB email that only differs by case and whitespace", async () => {
    signInAsAdmin("  ADMIN@Example.com ")
    const check = await checkSuperAdmin()
    expect(check).toEqual({
      ok: true,
      admin: { adminId: ADMIN_ID, email: "admin@example.com" },
    })
  })

  it("denies a deleted user (no DB row) immediately", async () => {
    mockSession.mockResolvedValue({ user: { id: ADMIN_ID } })
    mockDb.select.mockReturnValue(queryResult([]))
    await expect(isSuperAdmin()).resolves.toBe(false)
  })

  it("rejects a malformed session id without querying", async () => {
    mockSession.mockResolvedValue({ user: { id: "not-a-uuid" } })
    await expect(isSuperAdmin()).resolves.toBe(false)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it("denies everyone when the env list is empty", async () => {
    process.env.SUPER_ADMIN_EMAILS = ""
    signInAsAdmin("admin@example.com")
    await expect(isSuperAdmin()).resolves.toBe(false)
  })
})

describe("adminAction", () => {
  it("returns a typed forbidden result and runs nothing for a non-admin", async () => {
    signInAsAdmin("someone@example.com")
    const result = await deleteUser(OTHER_ID)
    expect(result).toMatchObject({ success: false, code: "forbidden" })
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("does not log the raw email on denial", async () => {
    signInAsAdmin("someone@example.com")
    await deleteUser(OTHER_ID)
    const logged = JSON.stringify(
      (mockLogger.warn as MockFn).mock.calls
    ).toLowerCase()
    expect(logged).not.toContain("someone@example.com")
    expect(logged).not.toContain("jwt-email@example.com")
  })

  it("rejects ids that are not UUIDs", async () => {
    signInAsAdmin()
    const result = await deleteUser("not-a-uuid")
    expect(result).toMatchObject({ success: false, code: "invalid" })
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("rejects unknown keys such as password instead of writing them", async () => {
    signInAsAdmin()
    const result = await updateUser(OTHER_ID, {
      name: "x",
      password: "hash",
    } as never)
    expect(result).toMatchObject({ success: false, code: "invalid" })
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("blocks deleting your own account", async () => {
    signInAsAdmin()
    // The target row is the admin themself (email not on the list on purpose).
    const tx = fakeTx([{ id: ADMIN_ID, email: "plain@example.com" }])
    useTransaction(tx)
    const result = await deleteUser(ADMIN_ID)
    expect(result).toMatchObject({ success: false, code: "conflict" })
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it("blocks deleting a user on the super-admin list", async () => {
    signInAsAdmin()
    const tx = fakeTx([{ id: OTHER_ID, email: "BOSS@example.com" }])
    useTransaction(tx)
    const result = await deleteUser(OTHER_ID)
    expect(result).toMatchObject({ success: false, code: "conflict" })
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it("blocks changing the email of a super admin", async () => {
    signInAsAdmin()
    const tx = fakeTx([{ id: OTHER_ID, email: "boss@example.com" }])
    useTransaction(tx)
    const result = await updateUser(OTHER_ID, { email: "new@example.com" })
    expect(result).toMatchObject({ success: false, code: "conflict" })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("blocks giving a user a super-admin email", async () => {
    signInAsAdmin()
    const tx = fakeTx([{ id: OTHER_ID, email: "plain@example.com" }])
    useTransaction(tx)
    const result = await updateUser(OTHER_ID, { email: "Admin@Example.com" })
    expect(result).toMatchObject({ success: false, code: "conflict" })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("refuses to remove the clan owner", async () => {
    signInAsAdmin()
    const tx = fakeTx([{ ownerId: OTHER_ID, name: "Clan", role: "admin", total: 2 }])
    useTransaction(tx)
    const result = await removeClanMember(CLAN_ID, OTHER_ID)
    expect(result).toMatchObject({ success: false, code: "conflict" })
    expect(tx.delete).not.toHaveBeenCalled()
  })
})

describe("validation schema", () => {
  it("rejects unknown keys at the top level and in data", () => {
    expect(
      updateUserSchema.safeParse({
        userId: OTHER_ID,
        data: { password: "x" },
      }).success
    ).toBe(false)
    expect(
      updateUserSchema.safeParse({
        userId: OTHER_ID,
        data: { name: "ok" },
        id: OTHER_ID,
      }).success
    ).toBe(false)
  })

  it("normalizes email and maps empty strings to null", () => {
    const parsed = updateUserSchema.parse({
      userId: OTHER_ID,
      data: { email: " Foo@Bar.com ", name: "  " },
    })
    expect(parsed.data.email).toBe("foo@bar.com")
    expect(parsed.data.name).toBeNull()
  })
})

describe("invariant predicates", () => {
  const list = ["admin@example.com"]

  it("userDeleteBlocker covers self and listed users", () => {
    expect(
      userDeleteBlocker({
        actorId: "a",
        targetId: "a",
        targetEmail: "x@y.com",
        adminEmails: list,
      })
    ).not.toBeNull()
    expect(
      userDeleteBlocker({
        actorId: "a",
        targetId: "b",
        targetEmail: " ADMIN@example.com",
        adminEmails: list,
      })
    ).not.toBeNull()
    expect(
      userDeleteBlocker({
        actorId: "a",
        targetId: "b",
        targetEmail: "x@y.com",
        adminEmails: list,
      })
    ).toBeNull()
  })

  it("emailChangeBlocker allows unchanged addresses and blocks old/new list entries", () => {
    const base = { adminEmails: list }
    expect(
      emailChangeBlocker({ ...base, oldEmail: "Admin@example.com", newEmail: "admin@example.com" })
    ).toBeNull()
    expect(
      emailChangeBlocker({ ...base, oldEmail: "admin@example.com", newEmail: "n@x.com" })
    ).not.toBeNull()
    expect(
      emailChangeBlocker({ ...base, oldEmail: "o@x.com", newEmail: "admin@example.com" })
    ).not.toBeNull()
    expect(
      emailChangeBlocker({ ...base, oldEmail: "o@x.com", newEmail: "n@x.com" })
    ).toBeNull()
  })

  it("membershipChangeBlocker protects the owner and the only admin", () => {
    const base = { scope: "clan" as const, isOwner: false, adminCount: 2 }
    expect(
      membershipChangeBlocker({ ...base, isOwner: true, currentRole: "admin", nextRole: null })
    ).toMatch(/transfer ownership/i)
    expect(
      membershipChangeBlocker({ ...base, adminCount: 1, currentRole: "admin", nextRole: "member" })
    ).toMatch(/only admin/i)
    expect(
      membershipChangeBlocker({ ...base, adminCount: 1, currentRole: "admin", nextRole: "admin" })
    ).toBeNull()
    expect(
      membershipChangeBlocker({ ...base, currentRole: "admin", nextRole: null })
    ).toBeNull()
  })
})

describe("ILIKE escaping", () => {
  it("escapes %, _ and backslash", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b")
    expect(containsPattern("a%b")).toBe("%a\\%b%")
  })

  it("caps the search term at 100 characters", () => {
    expect(containsPattern("x".repeat(500))).toBe(`%${"x".repeat(100)}%`)
  })
})
