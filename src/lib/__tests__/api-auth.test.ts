/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import {
  LAST_USED_THROTTLE_MS,
  checkApiKey,
  validateApiKey,
} from "@/lib/api-auth"
import { hashApiKey } from "@/lib/api-key"
import { createApiKeyForUser, revokeApiKeyForUser } from "@/server/api-keys"
import { db } from "@/server/db"
import { apiKeys, users } from "@/server/db/schema"

describe("validateApiKey lastUsed", () => {
  const suffix = Math.random().toString(36).slice(2)
  const key = `test-key-${suffix}`
  const keyHash = hashApiKey(key)
  let userId: string

  const request = () =>
    new Request("http://localhost/x", {
      headers: { Authorization: `Bearer ${key}` },
    })
  const lastUsed = async () =>
    (await db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, keyHash) }))!
      .lastUsed

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "key owner", email: `owner-${suffix}@example.test` })
      .returning({ id: users.id })
    userId = user!.id
    await db.insert(apiKeys).values({ userId, name: "test", keyHash })
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
    await db.update(apiKeys).set({ lastUsed: recent }).where(eq(apiKeys.keyHash, keyHash))

    expect(await validateApiKey(request())).toBe(userId)

    expect((await lastUsed())!.getTime()).toBe(recent.getTime())
  })

  it("rewrites lastUsed once the window has passed", async () => {
    const stale = new Date(Date.now() - LAST_USED_THROTTLE_MS - 5_000)
    await db.update(apiKeys).set({ lastUsed: stale }).where(eq(apiKeys.keyHash, keyHash))

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

describe("checkApiKey (hashed keys, expiry, revocation, scopes)", () => {
  const suffix = Math.random().toString(36).slice(2)
  let userId: string

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "key owner", email: `hash-owner-${suffix}@example.test` })
      .returning({ id: users.id })
    userId = user!.id
  })

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  const bearer = (key: string) =>
    new Request("http://localhost/x", {
      headers: { Authorization: `Bearer ${key}` },
    })

  const rowFor = async (id: string) =>
    (await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, id) }))!

  it("creates a key that is stored hashed, with no plaintext", async () => {
    const created = await createApiKeyForUser(userId, { name: "new" })

    expect(created.key).toMatch(/^bsn_/)
    const row = await rowFor(created.id)
    expect(row.keyHash).toBe(hashApiKey(created.key))
    expect(row.keyHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.keyPrefix).toBe(created.key.slice(0, 8))
    expect(row.scopes).toEqual(["read", "submit"])
    expect(await validateApiKey(bearer(created.key))).toBe(userId)
  })

  it("finds a key by its hash and stamps lastUsed", async () => {
    const created = await createApiKeyForUser(userId, { name: "hashed" })

    const result = await checkApiKey(created.key)

    expect(result).toMatchObject({ ok: true, key: { userId, keyId: created.id } })
    expect((await rowFor(created.id)).lastUsed).toBeInstanceOf(Date)
  })

  it("rejects an unknown key", async () => {
    expect(await checkApiKey("bsn_does-not-exist")).toEqual({
      ok: false,
      reason: "unknown",
    })
  })

  it("refuses a revoked key", async () => {
    const hashed = await createApiKeyForUser(userId, { name: "revoked" })
    await revokeApiKeyForUser(userId, hashed.id)
    expect(await checkApiKey(hashed.key)).toEqual({
      ok: false,
      reason: "revoked",
    })
  })

  it("refuses an expired key and accepts one that has not expired yet", async () => {
    const past = await createApiKeyForUser(userId, {
      name: "expired",
      expiresAt: new Date(Date.now() - 1000),
    })
    expect(await checkApiKey(past.key)).toEqual({ ok: false, reason: "expired" })

    const future = await createApiKeyForUser(userId, {
      name: "later",
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(await checkApiKey(future.key)).toMatchObject({ ok: true })
    // `now` is injectable: the same key is expired a minute later.
    expect(
      await checkApiKey(future.key, { now: new Date(Date.now() + 120_000) })
    ).toEqual({ ok: false, reason: "expired" })
  })

  it("enforces scopes", async () => {
    const readOnly = await createApiKeyForUser(userId, {
      name: "read only",
      scopes: ["read"],
    })

    expect(await checkApiKey(readOnly.key, { scope: "read" })).toMatchObject({
      ok: true,
    })
    expect(await checkApiKey(readOnly.key, { scope: "submit" })).toEqual({
      ok: false,
      reason: "scope",
    })
    expect(await validateApiKey(bearer(readOnly.key), "submit")).toBeNull()
    expect(await validateApiKey(bearer(readOnly.key))).toBe(userId)
  })

  it("only the owner can revoke a key", async () => {
    const created = await createApiKeyForUser(userId, { name: "mine" })

    expect(
      await revokeApiKeyForUser("00000000-0000-4000-8000-000000000000", created.id)
    ).toBe(false)
    expect((await rowFor(created.id)).revokedAt).toBeNull()
    expect(await revokeApiKeyForUser(userId, created.id)).toBe(true)
    expect((await rowFor(created.id)).revokedAt).toBeInstanceOf(Date)
  })
})
