"use server"

import { hashPassword } from "@/lib/password"
import { logger } from "@/lib/logger"
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth"
import { db } from "@/server/db"
import { authAccounts, users } from "@/server/db/schema"
import { limitAction } from "@/server/rate-limit"
import { eq } from "drizzle-orm"
import { ZodError } from "zod"

/**
 * Server action to register a new user with username/password credentials.
 *
 * @param input - User registration data (username, password, confirmPassword, runescapeName)
 * @returns Success response with userId or error response with message
 */
export async function registerUser(input: SignUpInput) {
  // Anonymous by definition, so limited per client IP.
  const limited = await limitAction("signUp")
  if (limited) return limited

  try {
    // Validate input with Zod schema
    const validated = await signUpSchema.parseAsync(input)

    // Check if username already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, validated.username.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      return {
        success: false,
        error: "Username already taken. Please choose a different username.",
      }
    }

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(validated.password)

    // The user plus its Better Auth credential account (`accountId` is the
    // user id), written directly: Better Auth's sign-up needs an email, and
    // this one has none (epic #250, decision 9).
    const newUser = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          username: validated.username.toLowerCase(),
          name: validated.username, // Use username as default name
          runescapeName: validated.runescapeName ?? null,
          email: null, // Not required for credentials auth
          emailVerified: null,
        })
        .returning({ id: users.id })
      if (!created) return undefined
      await tx.insert(authAccounts).values({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: hashedPassword,
      })
      return created
    })

    if (!newUser) {
      return {
        success: false,
        error: "Failed to create user. Please try again.",
      }
    }

    return {
      success: true,
      userId: newUser.id,
      message: "Account created successfully! Please sign in.",
    }
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: firstError?.message ?? "Validation error",
      }
    }

    // Log other errors but don't expose details
    logger.error("Registration error")
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}
