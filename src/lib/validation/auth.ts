import { z } from "zod"

/**
 * Schema for validating user sign-in credentials.
 * Used by the Credentials provider to validate input before authentication.
 */
export const signInSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
})

/**
 * Schema for validating user registration credentials.
 * Includes additional validation for password confirmation and RuneScape name.
 */
export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be 30 characters or less")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens, and underscores",
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string(),
    runescapeName: z
      .string()
      .min(1, "RuneScape name is required")
      .max(12, "RuneScape name must be 12 characters or less")
      .regex(
        /^[a-zA-Z0-9 _-]+$/,
        "RuneScape name can only contain letters, numbers, spaces, hyphens, and underscores",
      )
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

/**
 * Schema for validating password reset request.
 */
export const resetPasswordRequestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format"),
})

/**
 * Schema for validating password reset with token.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

/**
 * Type definitions for the validation schemas
 */
export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ResetPasswordRequestInput = z.infer<
  typeof resetPasswordRequestSchema
>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
