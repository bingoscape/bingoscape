/**
 * @jest-environment node
 */
import {
  discordEmailVerified,
  googleEmailVerified,
  providerVerifiedEmailFor,
} from "@/lib/provider-email"

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
