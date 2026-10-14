/**
 * Whether an OAuth provider vouched for the email address of a profile.
 * Pure helpers over the raw profile payloads; used by the NextAuth provider
 * mappers (`@/server/auth`) and the tests.
 */

/** Discord `GET /users/@me`: `verified` is true when the account's email is verified. */
export function discordEmailVerified(profile: { verified?: unknown }): boolean {
  return profile.verified === true
}

/** Google OpenID claims: `email_verified`. */
export function googleEmailVerified(profile: {
  email_verified?: unknown
}): boolean {
  return profile.email_verified === true
}

/**
 * GitHub: an email on the public `/user` profile is verified (GitHub only
 * lets verified addresses be public). Otherwise the address comes from
 * `/user/emails`, whose `verified` flag decides.
 */
export function githubEmailVerified(
  publicEmail: string | null | undefined,
  listed: { email: string; primary?: boolean; verified?: boolean } | undefined
): boolean {
  if (publicEmail) return true
  return listed?.verified === true
}

/**
 * The address to store in `users.provider_verified_email` after an OAuth
 * sign-in: the user's stored email (normalised) when the provider verified it
 * and the provider's profile carries that same address, else null.
 */
export function providerVerifiedEmailFor(input: {
  userEmail: string | null | undefined
  profileEmail: string | null | undefined
  verified: boolean
}): string | null {
  const user = input.userEmail?.trim().toLowerCase()
  const profile = input.profileEmail?.trim().toLowerCase()
  return input.verified && user && user === profile ? user : null
}
