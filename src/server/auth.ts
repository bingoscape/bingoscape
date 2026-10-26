import { APIError, betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { username } from "better-auth/plugins/username"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { cache } from "react"

import { logger } from "@/lib/logger"
import { hashPassword, verifyPassword } from "@/lib/password"
import {
  discordEmailVerified,
  googleEmailVerified,
  providerVerifiedEmailFor,
} from "@/lib/provider-email"
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/session"
import { signInSchema } from "@/lib/validation/auth"

import { env } from "@/env"
import { db } from "@/server/db"
import {
  authAccounts,
  authSessions,
  authVerifications,
  users,
} from "@/server/db/schema"
import {
  checkRateLimit,
  clientIpFromHeaders,
  RATE_LIMITED_ERROR,
  RATE_LIMITED_MESSAGE,
} from "@/server/rate-limit"

/**
 * Better Auth rejects an OAuth sign-in without an email (`EMAIL_NOT_FOUND`).
 * When a profile has none, the provider mappers put this stand-in into the
 * in-memory user info; `databaseHooks.user.create.before` turns it back into
 * NULL and `overrideUserInfoOnSignIn` is off, so it is never stored (epic #250,
 * decision 10). `.invalid` can never receive mail (RFC 6761).
 */
const NO_EMAIL_DOMAIN = "@no-email.invalid"

function noEmailStandIn(provider: string, accountId: string | number) {
  return {
    email: `${provider}-${accountId}${NO_EMAIL_DOMAIN}`,
    emailVerified: false,
  }
}

function isNoEmailStandIn(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith(NO_EMAIL_DOMAIN)
}

const usernameRule = signInSchema.shape.username

export const auth = betterAuth({
  secret: env.NEXTAUTH_SECRET,
  baseURL: env.NEXTAUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    transaction: true,
    schema: {
      user: users,
      account: authAccounts,
      session: authSessions,
      verification: authVerifications,
    },
  }),
  advanced: { database: { generateId: "uuid" } },
  // The app has its own limiter (sign-in through `hooks.before` below).
  rateLimit: { enabled: false },
  // Endpoints the app does not use. Account changes go through server actions
  // with the app's own validation, never through these.
  disabledPaths: [
    // Password users have no email; open, it would bcrypt-hash unthrottled.
    "/sign-in/email",
    "/update-user",
    "/change-email",
    "/change-password",
    "/delete-user",
    "/is-username-available",
    // No unlink UI, and #260's copy-before-drop would bring an unlinked account back.
    "/unlink-account",
  ],
  user: {
    fields: { emailVerified: "isEmailVerified" },
    additionalFields: {
      runescapeName: { type: "string", required: false, input: false },
      // Trusted by the super-admin allowlist: never from input or a profile.
      providerVerifiedEmail: {
        type: "string",
        required: false,
        input: false,
        returned: false,
      },
    },
    // Remember which email an OAuth provider verified at sign-in or link
    // (`users.provider_verified_email`). Better Auth fails the sign-in closed
    // when this throws, so errors are logged, never thrown.
    async validateUserInfo({ user, source }) {
      if (
        source.method !== "oauth" ||
        (source.action !== "sign-in" && source.action !== "link-account") ||
        typeof user.id !== "string"
      ) {
        return
      }
      try {
        const [row] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1)
        if (!row) return
        await db
          .update(users)
          .set({
            providerVerifiedEmail: providerVerifiedEmailFor({
              userEmail: row.email,
              profileEmail: user.email,
              verified: user.emailVerified === true,
            }),
          })
          .where(eq(users.id, user.id))
      } catch (error) {
        logger.error(
          { error, userId: user.id },
          "Failed to record verified email"
        )
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Only OAuth sign-ups reach this (`registerUser` writes its rows
        // itself and `/sign-up/email` is off), and only a provider can make
        // `emailVerified` true.
        async before(user) {
          const email = isNoEmailStandIn(user.email) ? null : user.email
          return {
            data: {
              ...user,
              // Stored as NULL (the column is nullable); Better Auth types it as string.
              email: email as string,
              providerVerifiedEmail:
                user.emailVerified && email ? email.toLowerCase() : null,
            },
          }
        },
      },
    },
  },
  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  emailAndPassword: {
    enabled: true,
    // Sign-up is `registerUser` only: it needs no email (decision 9).
    disableSignUp: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  socialProviders: {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      mapProfileToUser: (profile) =>
        profile.email
          ? { emailVerified: discordEmailVerified(profile) }
          : noEmailStandIn("discord", profile.id),
    },
    // Callback URLs stay {NEXTAUTH_URL}/api/auth/callback/<provider>.
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            mapProfileToUser: (profile) =>
              profile.email ? {} : noEmailStandIn("github", profile.id),
          },
        }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            mapProfileToUser: (profile) =>
              profile.email
                ? { emailVerified: googleEmailVerified(profile) }
                : noEmailStandIn("google", profile.sub),
          },
        }
      : {}),
  },
  hooks: {
    // Sign-in rate limit per client IP and per (username, IP). A 429 with its
    // own code, so the form can tell it from a wrong password.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/username") return
      const ip = clientIpFromHeaders((name) => ctx.headers?.get(name))
      const byIp = await checkRateLimit("signInIp", `ip:${ip}`)
      const body = ctx.body as { username?: unknown } | undefined
      const name =
        typeof body?.username === "string"
          ? body.username.trim().toLowerCase()
          : ""
      const byAccount = await checkRateLimit("signInAccount", `${name}|${ip}`)
      if (!byIp.allowed || !byAccount.allowed) {
        throw new APIError("TOO_MANY_REQUESTS", {
          code: RATE_LIMITED_ERROR,
          message: RATE_LIMITED_MESSAGE,
        })
      }
    }),
  },
  plugins: [
    username({
      // The plugin's default rejects "-", which the app allows.
      usernameValidator: (value) => usernameRule.safeParse(value).success,
      displayUsername: false,
    }),
    nextCookies(), // must stay last
  ],
})

/**
 * The signed-in user, or null. Memoised per request (React `cache`), so the
 * several calls of one request cost a single session lookup. Every field comes
 * from the database row, never from the client.
 */
export const getServerAuthSession = cache(async () => {
  const result = await auth.api.getSession({ headers: await headers() })
  if (!result) return null
  const { id, name, email, image, runescapeName } = result.user
  return {
    user: {
      id,
      name,
      email: email ?? null,
      image: image ?? null,
      runescapeName: runescapeName ?? "",
    },
  }
})
