/**
 * @jest-environment node
 *
 * The NextAuth `jwt` callback against a real database: a token is only a
 * pointer to the user, and every identity field is re-read on each call.
 */
import { eq } from "drizzle-orm"
import type { JWT } from "next-auth/jwt"

import { SessionInvalidError } from "@/lib/session"
import { authOptions } from "@/server/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

// The adapter is ESM-only and unused by the jwt callback.
jest.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({}) }))

const jwtCallback = authOptions.callbacks!.jwt!

const nowSeconds = () => Math.floor(Date.now() / 1000)

async function callJwt(token: Partial<JWT>, user?: { id: string }) {
  return jwtCallback({
    token: token as JWT,
    ...(user ? { user: user as never, account: null } : {}),
  } as unknown as Parameters<typeof jwtCallback>[0])
}

describe("jwt callback", () => {
  const suffix = Math.random().toString(36).slice(2)
  let userId: string

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({
        name: "session user",
        email: `session-${suffix}@example.test`,
        runescapeName: "Real Name",
      })
      .returning({ id: users.id })
    userId = user!.id
  })

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it("accepts a valid token and takes the runescape name from the database", async () => {
    const token = await callJwt({ id: userId, iat: nowSeconds(), runescapeName: "Forged" })
    expect(token).toMatchObject({ id: userId, runescapeName: "Real Name" })
  })

  it("ignores identity fields a client sends with useSession().update()", async () => {
    const token = await jwtCallback({
      token: { id: userId, iat: nowSeconds() } as unknown as JWT,
      trigger: "update",
      session: { runescapeName: "Admin Of Everything" },
    } as unknown as Parameters<typeof jwtCallback>[0])
    expect(token.runescapeName).toBe("Real Name")
  })

  it("rejects a token whose user was deleted", async () => {
    await db.delete(users).where(eq(users.id, userId))
    await expect(callJwt({ id: userId, iat: nowSeconds() })).rejects.toBeInstanceOf(
      SessionInvalidError
    )
  })

  it("rejects a token without a usable user id", async () => {
    await expect(callJwt({ iat: nowSeconds() })).rejects.toBeInstanceOf(
      SessionInvalidError
    )
    await expect(
      callJwt({ id: "not-a-uuid", iat: nowSeconds() })
    ).rejects.toBeInstanceOf(SessionInvalidError)
  })

  it("rejects tokens issued before sessionRevokedAt, but not newer ones", async () => {
    const issued = nowSeconds() - 120
    await db
      .update(users)
      .set({ sessionRevokedAt: new Date() })
      .where(eq(users.id, userId))

    await expect(callJwt({ id: userId, iat: issued })).rejects.toBeInstanceOf(
      SessionInvalidError
    )
    // A session minted after the revocation (signing in again) works.
    await expect(
      callJwt({ id: userId, iat: nowSeconds() + 1 })
    ).resolves.toMatchObject({ id: userId })
  })

  it("accepts a sign-in even though older sessions are revoked", async () => {
    await db
      .update(users)
      .set({ sessionRevokedAt: new Date() })
      .where(eq(users.id, userId))

    // At sign-in the token has no iat yet and `user` is set.
    const token = await callJwt({}, { id: userId })
    expect(token).toMatchObject({ id: userId, runescapeName: "Real Name" })
  })

  it("accepts a legacy token (no revocation recorded) issued long ago", async () => {
    await expect(
      callJwt({ id: userId, iat: nowSeconds() - 20 * 24 * 3600 })
    ).resolves.toMatchObject({ id: userId })
  })
})

describe("session options", () => {
  it("sets an explicit maxAge for the session and the JWT", () => {
    expect(authOptions.session?.strategy).toBe("jwt")
    expect(authOptions.session?.maxAge).toBeGreaterThan(0)
    expect(authOptions.jwt?.maxAge).toBe(authOptions.session?.maxAge)
  })
})
