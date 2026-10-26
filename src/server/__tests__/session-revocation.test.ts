/**
 * @jest-environment node
 *
 * Better Auth database sessions against a real database: the session is a row,
 * "sign out everywhere" deletes the rows, and a deleted user has none.
 */
import { eq } from "drizzle-orm"

import { revokeAllSessions } from "@/app/actions/user"
import { hashPassword } from "@/lib/password"
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session"
import { auth, getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { authAccounts, authSessions, users } from "@/server/db/schema"
import { resetRateLimits } from "@/server/rate-limit"

import { signInByUsername } from "./helpers/auth-requests"

let requestCookie = ""
jest.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: requestCookie }),
  cookies: async () => ({ set: jest.fn() }),
}))

const PASSWORD = "Sup3rSecret!"

describe("database sessions", () => {
  const suffix = Math.random().toString(36).slice(2, 10)
  const username = `sess-${suffix}`
  let userId: string

  beforeEach(async () => {
    resetRateLimits()
    requestCookie = ""
    const [user] = await db
      .insert(users)
      .values({ name: "session user", username, runescapeName: "Real Name" })
      .returning({ id: users.id })
    userId = user!.id
    await db.insert(authAccounts).values({
      userId,
      providerId: "credential",
      accountId: userId,
      password: await hashPassword(PASSWORD),
    })
  })

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it("returns the user from the database in the old session shape", async () => {
    requestCookie = (await signInByUsername(username, PASSWORD)).cookie
    await expect(getServerAuthSession()).resolves.toEqual({
      user: {
        id: userId,
        name: "session user",
        email: null,
        image: null,
        runescapeName: "Real Name",
      },
    })
  })

  it("has no session without a cookie", async () => {
    await expect(getServerAuthSession()).resolves.toBeNull()
  })

  it("sign out everywhere ends every session of the user", async () => {
    const first = (await signInByUsername(username, PASSWORD)).cookie
    const second = (await signInByUsername(username, PASSWORD)).cookie
    expect(
      await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, userId))
    ).toHaveLength(2)

    requestCookie = first
    await expect(revokeAllSessions()).resolves.toEqual({ success: true })

    for (const cookie of [first, second]) {
      await expect(
        auth.api.getSession({ headers: new Headers({ cookie }) })
      ).resolves.toBeNull()
    }
    expect(
      await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, userId))
    ).toHaveLength(0)
  })

  it("a deleted user has no session", async () => {
    const { cookie } = await signInByUsername(username, PASSWORD)
    await db.delete(users).where(eq(users.id, userId))
    await expect(
      auth.api.getSession({ headers: new Headers({ cookie }) })
    ).resolves.toBeNull()
  })

  it("sets the session lifetime", async () => {
    await signInByUsername(username, PASSWORD)
    const [row] = await db
      .select({ expiresAt: authSessions.expiresAt })
      .from(authSessions)
      .where(eq(authSessions.userId, userId))
    const seconds = (row!.expiresAt.getTime() - Date.now()) / 1000
    expect(seconds).toBeGreaterThan(SESSION_MAX_AGE_SECONDS - 60)
    expect(seconds).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS)
  })
})
