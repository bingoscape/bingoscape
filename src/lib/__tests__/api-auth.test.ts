/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { LAST_USED_THROTTLE_MS, validateApiKey } from "@/lib/api-auth"
import { db } from "@/server/db"
import { apiKeys, users } from "@/server/db/schema"

describe("validateApiKey lastUsed", () => {
  const suffix = Math.random().toString(36).slice(2)
  const key = `test-key-${suffix}`
  let userId: string

  const request = () =>
    new Request("http://localhost/x", {
      headers: { Authorization: `Bearer ${key}` },
    })
  const lastUsed = async () =>
    (await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, key) }))!
      .lastUsed

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "key owner", email: `owner-${suffix}@example.test` })
      .returning({ id: users.id })
    userId = user!.id
    await db.insert(apiKeys).values({ userId, name: "test", key })
  })

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it("returns the user and stamps a key that was never used", async () => {
    expect(await lastUsed()).toBeNull()

    expect(await validateApiKey(request())).toBe(userId)

    expect(await lastUsed()).toBeInstanceOf(Date)
  })

  it("does not rewrite lastUsed within the throttle window", async () => {
    const recent = new Date(Date.now() - 10_000)
    await db.update(apiKeys).set({ lastUsed: recent }).where(eq(apiKeys.key, key))

    expect(await validateApiKey(request())).toBe(userId)

    expect((await lastUsed())!.getTime()).toBe(recent.getTime())
  })

  it("rewrites lastUsed once the window has passed", async () => {
    const stale = new Date(Date.now() - LAST_USED_THROTTLE_MS - 5_000)
    await db.update(apiKeys).set({ lastUsed: stale }).where(eq(apiKeys.key, key))

    expect(await validateApiKey(request())).toBe(userId)

    expect((await lastUsed())!.getTime()).toBeGreaterThan(stale.getTime())
  })

  it("writes at most once across many calls", async () => {
    await validateApiKey(request())
    const first = await lastUsed()
    await validateApiKey(request())
    await validateApiKey(request())

    expect((await lastUsed())!.getTime()).toBe(first!.getTime())
  })

  it("rejects an unknown key without writing", async () => {
    const response = await validateApiKey(
      new Request("http://localhost/x", {
        headers: { Authorization: "Bearer nope" },
      })
    )
    expect(response).toBeNull()
    expect(await lastUsed()).toBeNull()
  })
})
