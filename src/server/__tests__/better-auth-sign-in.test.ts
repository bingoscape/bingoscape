/**
 * @jest-environment node
 *
 * Better Auth 3/4 (#253) against a real database: username sign-in with the
 * bcrypt hashes phase 2 copied, the sign-in rate limit, `registerUser`, the
 * closed `/sign-up/email`, and OAuth sign-in for profiles without an email.
 */
import { and, eq, inArray } from "drizzle-orm"

import { registerUser } from "@/app/actions/auth"
import { hashPassword } from "@/lib/password"
import { RATE_LIMITS } from "@/lib/rate-limit-policies"
import { db } from "@/server/db"
import { authAccounts, users } from "@/server/db/schema"
import { resetRateLimits } from "@/server/rate-limit"

import {
  authRequest,
  cookieHeader,
  signInByUsername,
} from "./helpers/auth-requests"

jest.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: jest.fn() }),
}))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const PASSWORD = "Sup3rSecret!"
const suffix = Math.random().toString(36).slice(2, 10)
const created: string[] = []

beforeEach(() => resetRateLimits())

afterAll(async () => {
  if (created.length > 0)
    await db.delete(users).where(inArray(users.id, created))
})

/** A password user the way phase 2 left it: hash on the user and the credential account. */
async function seedPasswordUser(username: string) {
  const hash = await hashPassword(PASSWORD)
  const [user] = await db
    .insert(users)
    .values({ name: username, username, password: hash })
    .returning({ id: users.id })
  created.push(user!.id)
  await db.insert(authAccounts).values({
    userId: user!.id,
    providerId: "credential",
    accountId: user!.id,
    password: hash,
  })
  return user!.id
}

describe("username sign-in", () => {
  it("accepts a copied bcrypt hash and rejects a wrong password", async () => {
    const username = `copied-${suffix}`
    await seedPasswordUser(username)

    const ok = await signInByUsername(username, PASSWORD)
    expect(ok.status).toBe(200)
    expect(ok.cookie).toContain("session_token=")

    const wrong = await signInByUsername(username, "Wrong-Passw0rd")
    expect(wrong.status).toBe(401)
    expect(wrong.body.code).not.toBe("RATE_LIMITED")
  })

  it("rate limits per account and IP with its own error code", async () => {
    const username = `limited-${suffix}`
    await seedPasswordUser(username)
    const { limit } = RATE_LIMITS.signInAccount
    for (let i = 0; i < limit; i++) {
      expect(
        (await signInByUsername(username, "nope-nope", "198.51.100.7")).status
      ).toBe(401)
    }
    const blocked = await signInByUsername(username, PASSWORD, "198.51.100.7")
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe("RATE_LIMITED")
    // Another client address is not affected.
    expect(
      (await signInByUsername(username, PASSWORD, "198.51.100.8")).status
    ).toBe(200)
  })
})

describe("registerUser", () => {
  it("creates a user without email plus a credential account that signs in", async () => {
    const username = `New-User-${suffix}`
    const result = await registerUser({
      username,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      runescapeName: "Zezima",
    })
    expect(result).toMatchObject({ success: true })
    const userId = (result as { userId: string }).userId
    created.push(userId)

    const [user] = await db.select().from(users).where(eq(users.id, userId))
    expect(user).toMatchObject({
      username: username.toLowerCase(),
      email: null,
      providerVerifiedEmail: null,
      runescapeName: "Zezima",
    })
    const accounts = await db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, userId))
    expect(accounts).toEqual([
      expect.objectContaining({ providerId: "credential", accountId: userId }),
    ])

    expect((await signInByUsername(username, PASSWORD)).status).toBe(200)
  })
})

describe("sign-up through Better Auth", () => {
  it("refuses POST /sign-up/email, so input cannot set providerVerifiedEmail", async () => {
    const email = `admin-${suffix}@example.test`
    const response = await authRequest("/sign-up/email", {
      body: {
        email,
        password: PASSWORD,
        name: "x",
        username: `signup-${suffix}`,
        providerVerifiedEmail: email,
      },
    })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(
      await db.select().from(users).where(eq(users.email, email))
    ).toHaveLength(0)
  })
})

describe("OAuth sign-in (Discord)", () => {
  const realFetch = global.fetch
  let profile: Record<string, unknown>

  beforeEach(() => {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.startsWith("https://discord.com/api/oauth2/token")) {
        return Response.json({
          access_token: "at",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "identify email",
        })
      }
      if (url.startsWith("https://discord.com/api/users/%40me")) {
        return Response.json(profile)
      }
      throw new Error(`Unexpected fetch ${url}`)
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  /** Runs sign-in/social then the provider callback; the redirect location. */
  async function discordSignIn(): Promise<string> {
    const start = await authRequest("/sign-in/social", {
      body: { provider: "discord", callbackURL: "/" },
    })
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")!
    const callback = await authRequest(
      `/callback/discord?code=code&state=${encodeURIComponent(state)}`,
      { cookie: cookieHeader(start) }
    )
    return callback.headers.get("location") ?? ""
  }

  function discordProfile(id: string, email: string | null, verified: boolean) {
    return {
      id,
      username: `d${id}`,
      global_name: null,
      avatar: null,
      discriminator: "0",
      email,
      verified,
    }
  }

  async function userForDiscordAccount(accountId: string) {
    const [row] = await db
      .select({ user: users })
      .from(authAccounts)
      .innerJoin(users, eq(users.id, authAccounts.userId))
      .where(
        and(
          eq(authAccounts.providerId, "discord"),
          eq(authAccounts.accountId, accountId)
        )
      )
    if (row) created.push(row.user.id)
    return row?.user
  }

  it("signs up a new user without email and stores NULL", async () => {
    const id = `9${Date.now()}`
    profile = discordProfile(id, null, false)
    expect(await discordSignIn()).toBe("/")
    expect(await userForDiscordAccount(id)).toMatchObject({
      email: null,
      providerVerifiedEmail: null,
    })
  })

  it("signs in an existing linked account without email, leaving it NULL", async () => {
    const id = `8${Date.now()}`
    const [user] = await db
      .insert(users)
      .values({ name: "linked" })
      .returning({ id: users.id })
    created.push(user!.id)
    await db
      .insert(authAccounts)
      .values({ userId: user!.id, providerId: "discord", accountId: id })
    profile = discordProfile(id, null, false)
    expect(await discordSignIn()).toBe("/")
    expect(await userForDiscordAccount(id)).toMatchObject({
      id: user!.id,
      email: null,
      providerVerifiedEmail: null,
    })
  })

  it("records the provider-verified email for new and returning users", async () => {
    const id = `7${Date.now()}`
    const email = `Verified-${suffix}@Example.test`
    profile = discordProfile(id, email, true)
    expect(await discordSignIn()).toBe("/")
    expect(await userForDiscordAccount(id)).toMatchObject({
      email: email.toLowerCase(),
      providerVerifiedEmail: email.toLowerCase(),
    })

    // Returning, the provider no longer vouches for it: cleared.
    profile = discordProfile(id, email, false)
    expect(await discordSignIn()).toBe("/")
    expect(await userForDiscordAccount(id)).toMatchObject({
      providerVerifiedEmail: null,
    })
  })
})
