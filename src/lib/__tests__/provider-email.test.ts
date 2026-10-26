/**
 * @jest-environment node
 */
import {
  discordEmailVerified,
  githubEmailVerified,
  googleEmailVerified,
  providerVerifiedEmailFor,
} from "@/lib/provider-email"
import { isSessionRevoked } from "@/lib/session"

describe("isSessionRevoked", () => {
  const revokedAt = new Date("2026-01-01T12:00:00.500Z")
  const revokedSeconds = Math.floor(revokedAt.getTime() / 1000)

  it("never revokes a user without a revocation", () => {
    expect(isSessionRevoked(1, null)).toBe(false)
    expect(isSessionRevoked(undefined, null)).toBe(false)
  })

  it("revokes a token issued before the revocation", () => {
    expect(isSessionRevoked(revokedSeconds - 1, revokedAt)).toBe(true)
  })

  it("keeps a token issued in the same second or later (a fresh sign-in)", () => {
    expect(isSessionRevoked(revokedSeconds, revokedAt)).toBe(false)
    expect(isSessionRevoked(revokedSeconds + 60, revokedAt)).toBe(false)
  })

  it("revokes a token without an issue time once a revocation exists", () => {
    expect(isSessionRevoked(undefined, revokedAt)).toBe(true)
    expect(isSessionRevoked("123", revokedAt)).toBe(true)
  })
})

describe("provider email verification", () => {
  it("reads Discord and Google flags strictly", () => {
    expect(discordEmailVerified({ verified: true })).toBe(true)
    expect(discordEmailVerified({ verified: false })).toBe(false)
    expect(discordEmailVerified({})).toBe(false)
    expect(discordEmailVerified({ verified: "true" })).toBe(false)
    expect(googleEmailVerified({ email_verified: true })).toBe(true)
    expect(googleEmailVerified({ email_verified: "true" })).toBe(false)
    expect(googleEmailVerified({})).toBe(false)
  })

  it("trusts a public GitHub email, else the verified flag of the listed one", () => {
    expect(githubEmailVerified("a@example.com", undefined)).toBe(true)
    expect(
      githubEmailVerified(null, { email: "a@example.com", verified: true })
    ).toBe(true)
    expect(
      githubEmailVerified(null, { email: "a@example.com", verified: false })
    ).toBe(false)
    expect(githubEmailVerified(null, undefined)).toBe(false)
  })

  it("stores the verified address only when it is the user's address", () => {
    expect(
      providerVerifiedEmailFor({
        userEmail: "Admin@Example.com",
        profileEmail: "admin@example.com ",
        verified: true,
      })
    ).toBe("admin@example.com")
    expect(
      providerVerifiedEmailFor({
        userEmail: "admin@example.com",
        profileEmail: "admin@example.com",
        verified: false,
      })
    ).toBeNull()
    expect(
      providerVerifiedEmailFor({
        userEmail: "admin@example.com",
        profileEmail: "other@example.com",
        verified: true,
      })
    ).toBeNull()
    expect(
      providerVerifiedEmailFor({
        userEmail: null,
        profileEmail: null,
        verified: true,
      })
    ).toBeNull()
  })
})
