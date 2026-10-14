import { DrizzleAdapter } from "@auth/drizzle-adapter"
import {
  getServerSession,
  type DefaultSession,
  type Profile,
  type NextAuthOptions,
} from "next-auth"
import { type Adapter } from "next-auth/adapters"
import CredentialsProvider from "next-auth/providers/credentials"
import DiscordProvider, {
  type DiscordProfile,
} from "next-auth/providers/discord"
import GithubProvider, {
  type GithubProfile,
} from "next-auth/providers/github"
import GoogleProvider, {
  type GoogleProfile,
} from "next-auth/providers/google"
import { eq } from "drizzle-orm"
import { cache } from "react"

import { isUuid } from "@/lib/admin-list-params"
import { logger } from "@/lib/logger"
import { verifyPassword } from "@/lib/password"
import {
  discordEmailVerified,
  githubEmailVerified,
  googleEmailVerified,
  providerVerifiedEmailFor,
} from "@/lib/provider-email"
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  SessionInvalidError,
  isSessionRevoked,
} from "@/lib/session"
import { signInSchema } from "@/lib/validation/auth"

import { env } from "@/env"
import { db } from "@/server/db"
import {
  checkRateLimit,
  clientIpFromHeaders,
  RATE_LIMITED_ERROR,
} from "@/server/rate-limit"
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema"

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      runescapeName: string
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"]
  }

  interface User {
    runescapeName: string
    /** Set by the OAuth profile mappers: the provider verified `email`. */
    providerEmailVerified?: boolean
    // ...other properties
    // role: UserRole;
  }
}

// Extend JWT type to include custom fields
declare module "next-auth/jwt" {
  interface JWT {
    id: string
    runescapeName: string
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
// OAuth providers. Each mapper keeps NextAuth's default profile mapping and
// adds `providerEmailVerified`, which `events.signIn` stores.

function discordProvider() {
  const options = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    // Discord returns `iss` (RFC 9207) on the callback; openid-client requires a matching issuer
    issuer: "https://discord.com",
  }
  const base = DiscordProvider(options)
  return DiscordProvider({
    ...options,
    profile(profile: DiscordProfile, tokens) {
      return {
        ...base.profile(profile, tokens),
        providerEmailVerified: discordEmailVerified(profile),
      }
    },
  })
}

function githubProvider(clientId: string, clientSecret: string) {
  const base = GithubProvider({ clientId, clientSecret })
  return GithubProvider({
    clientId,
    clientSecret,
    userinfo: {
      url: "https://api.github.com/user",
      async request({ client, tokens }) {
        const profile = (await client.userinfo(
          tokens.access_token ?? ""
        )) as GithubProfile & { email_verified?: boolean }
        const publicEmail = profile.email
        let listed:
          | { email: string; primary?: boolean; verified?: boolean }
          | undefined
        if (!publicEmail) {
          const res = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `token ${tokens.access_token}` },
          })
          if (res.ok) {
            const emails = (await res.json()) as NonNullable<typeof listed>[]
            listed = emails.find((e) => e.primary) ?? emails[0]
            profile.email = listed?.email ?? null
          }
        }
        profile.email_verified = githubEmailVerified(publicEmail, listed)
        // GitHub's `name` may be null; NextAuth's Profile type says undefined.
        return profile as unknown as Profile
      },
    },
    profile(profile: GithubProfile & { email_verified?: boolean }, tokens) {
      return {
        ...base.profile(profile, tokens),
        providerEmailVerified: profile.email_verified === true,
      }
    },
  })
}

function googleProvider(clientId: string, clientSecret: string) {
  const base = GoogleProvider({ clientId, clientSecret })
  return GoogleProvider({
    clientId,
    clientSecret,
    profile(profile: GoogleProfile, tokens) {
      return {
        ...base.profile(profile, tokens),
        providerEmailVerified: googleEmailVerified(profile),
      }
    },
  })
}

/**
 * The identity fields of a user, read from the database. One primary key
 * lookup, memoised per request (React `cache`) so the several
 * `getServerAuthSession()` calls of one request cost a single query.
 */
const loadSessionUser = cache(async (userId: string) => {
  const [row] = await db
    .select({
      id: users.id,
      runescapeName: users.runescapeName,
      sessionRevokedAt: users.sessionRevokedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row ?? null
})

export const authOptions: NextAuthOptions = {
  // The JWT is only a pointer to the user: the id plus the issue time. Every
  // identity field the app reads (runescapeName, ...) is loaded from the
  // database on each request, never trusted from the token, and the lookup is
  // what makes a deleted account or a revoked session stop working. A thrown
  // error makes NextAuth answer "no session" and clear the cookie.
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: the user id comes from the provider flow (credentials
      // authorize / adapter), nothing the client sent.
      if (user) token.id = user.id

      const userId = typeof token.id === "string" ? token.id : null
      if (!userId || !isUuid(userId)) {
        throw new SessionInvalidError("Token has no valid user id")
      }
      const row = await loadSessionUser(userId)
      if (!row) throw new SessionInvalidError("User no longer exists")
      // A token minted by this very sign-in is never older than the revocation.
      if (!user && isSessionRevoked(token.iat, row.sessionRevokedAt)) {
        throw new SessionInvalidError("Sessions were revoked")
      }
      // Always from the database; `useSession().update(...)` payloads from the
      // client are ignored.
      token.runescapeName = row.runescapeName ?? ""
      return token
    },
    // Session callback to add custom data from token to session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.runescapeName = token.runescapeName
      }
      return session
    },
  },
  events: {
    // Remember which email address the provider verified (see
    // `users.provider_verified_email`); the super-admin allowlist needs it.
    async signIn({ user, account, profile }) {
      if (account?.type !== "oauth" || !user.id) return
      try {
        const verifiedEmail = providerVerifiedEmailFor({
          userEmail: user.email,
          profileEmail: profile?.email,
          verified:
            (profile as { providerEmailVerified?: boolean } | undefined)
              ?.providerEmailVerified === true,
        })
        await db
          .update(users)
          .set({ providerVerifiedEmail: verifiedEmail })
          .where(eq(users.id, user.id))
      } catch (error) {
        logger.error({ error, userId: user.id }, "Failed to record verified email")
      }
    },
  },
  logger: {
    // A revoked or orphaned session is routine, not an error worth a stack.
    error(code, metadata) {
      if (
        code === "JWT_SESSION_ERROR" &&
        metadata instanceof SessionInvalidError
      ) {
        return
      }
      console.error(code, metadata)
    },
    warn(code) {
      console.warn(code)
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  session: {
    // Use JWT for sessions when using Credentials provider
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    // Credentials Provider for username/password authentication
    // Note: This is separate from OAuth providers
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "your_username",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // Rate limit per client IP, and per (username, IP). Thrown, not
        // returned null, so the sign-in form can tell it from a wrong password.
        const ip = clientIpFromHeaders((name) => {
          const value = req?.headers?.[name]
          return Array.isArray(value) ? value.join(",") : value
        })
        const byIp = await checkRateLimit("signInIp", `ip:${ip}`)
        const username =
          typeof credentials?.username === "string"
            ? credentials.username.trim().toLowerCase()
            : ""
        const byAccount = await checkRateLimit(
          "signInAccount",
          `${username}|${ip}`
        )
        if (!byIp.allowed || !byAccount.allowed) {
          throw new Error(RATE_LIMITED_ERROR)
        }
        try {
          // Validate credentials with Zod
          const { username, password } =
            await signInSchema.parseAsync(credentials)

          // Query database for user by username (case-insensitive)
          const [user] = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              image: users.image,
              runescapeName: users.runescapeName,
              password: users.password,
            })
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1)

          // Check if user exists and has a password
          if (!user?.password) {
            return null
          }

          // Verify password
          const isValidPassword = await verifyPassword(password, user.password)

          if (!isValidPassword) {
            return null
          }

          // Return user object (without password)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            runescapeName: user.runescapeName ?? "",
          }
        } catch (error) {
          console.error("[AUTH DEBUG] Error in authorize:", error);
          return null
        }
      },
    }),
    discordProvider(),
    // GitHub OAuth Provider
    // Configure at: https://github.com/settings/developers
    // Callback URL: {NEXTAUTH_URL}/api/auth/callback/github
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? [githubProvider(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET)]
      : []),
    // Google OAuth Provider
    // Configure at: https://console.cloud.google.com/
    // Callback URL: {NEXTAUTH_URL}/api/auth/callback/google
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [googleProvider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)]
      : []),
  ],
}

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions)
