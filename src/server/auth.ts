import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { signInSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/password";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      runescapeName: string
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    runescapeName: string;
    // ...other properties
    // role: UserRole;
  }
}

// Extend JWT type to include custom fields
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    runescapeName: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    // JWT callback to add custom data to token
    async jwt({ token, user, trigger, session: updateSession }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.runescapeName = user.runescapeName
      }
      // Update session
      if (trigger === "update" && updateSession) {
         
        token.runescapeName = updateSession.runescapeName
      }
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
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  session: {
    // Use JWT for sessions when using Credentials provider
    strategy: "jwt",
  },
  providers: [
    // Credentials Provider for username/password authentication
    // Note: This is separate from OAuth providers
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "your_username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validate credentials with Zod
          const { username, password } = await signInSchema.parseAsync(credentials)

          // Query database for user by username (case-insensitive)
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1)

          // Check if user exists and has a password
          if (!user?.password) {
            // Return null to indicate authentication failed
            // Don't reveal whether username exists
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
          // Log error but don't expose details
          if (error instanceof ZodError) {
            console.error("Validation error:", error.errors)
          } else {
            console.error("Authentication error:", error)
          }
          return null
        }
      },
    }),
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    }),
    // GitHub OAuth Provider
    // Configure at: https://github.com/settings/developers
    // Callback URL: {NEXTAUTH_URL}/api/auth/callback/github
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? [
          GithubProvider({
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
    // Google OAuth Provider
    // Configure at: https://console.cloud.google.com/
    // Callback URL: {NEXTAUTH_URL}/api/auth/callback/google
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
