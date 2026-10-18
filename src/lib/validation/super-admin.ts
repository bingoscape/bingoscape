import { z } from "zod"

import { CLAN_ROLES, EVENT_ROLES } from "@/lib/authz/roles"
import { normalizeWikiImagePath } from "@/lib/osrs-image"

/**
 * Input schemas for the super-admin mutations. Everything is `.strict()`:
 * unknown keys (`password`, `id`, `creatorId`, ...) are rejected, not ignored,
 * so a crafted request cannot smuggle extra columns into an update.
 *
 * Pure module (zod only) so the schemas can be unit tested without a DB.
 */

export { CLAN_ROLES, EVENT_ROLES }

const uuid = z.string().uuid("Invalid id")

/** Trimmed text where an empty string means "clear it". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()

const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty")
    .max(max, `Must be ${max} characters or fewer`)

const MIN_DATE = new Date("2000-01-01T00:00:00Z")
const MAX_DATE = new Date("2100-01-01T00:00:00Z")
const eventDate = z
  .date()
  .refine((date) => date >= MIN_DATE && date < MAX_DATE, "Date is out of range")

/** Emails are stored trimmed and lower-cased, empty clears the email. */
const emailField = z
  .string()
  .trim()
  .max(255, "Must be 255 characters or fewer")
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Enter a valid email address"
  )
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()

export const updateUserSchema = z
  .object({
    userId: uuid,
    data: z
      .object({
        name: optionalText(255),
        email: emailField,
        runescapeName: optionalText(255),
      })
      .strict(),
  })
  .strict()

export const deleteUserSchema = z.object({ userId: uuid }).strict()

export const updateClanSchema = z
  .object({
    clanId: uuid,
    data: z
      .object({
        name: requiredText(255).optional(),
        description: optionalText(1000),
        ownerId: uuid.nullable().optional(),
      })
      .strict(),
  })
  .strict()

export const deleteClanSchema = z.object({ clanId: uuid }).strict()

export const clanMemberSchema = z
  .object({ clanId: uuid, userId: uuid })
  .strict()

export const updateClanMemberRoleSchema = z
  .object({ clanId: uuid, userId: uuid, role: z.enum(CLAN_ROLES) })
  .strict()

export const updateEventSchema = z
  .object({
    eventId: uuid,
    data: z
      .object({
        title: requiredText(255).optional(),
        description: optionalText(1000),
        startDate: eventDate.optional(),
        endDate: eventDate.optional(),
        locked: z.boolean().optional(),
        public: z.boolean().optional(),
        clanId: uuid.nullable().optional(),
      })
      .strict(),
  })
  .strict()

export const deleteEventSchema = z.object({ eventId: uuid }).strict()

export const eventParticipantSchema = z
  .object({ eventId: uuid, userId: uuid })
  .strict()

export const updateEventParticipantRoleSchema = z
  .object({ eventId: uuid, userId: uuid, role: z.enum(EVENT_ROLES) })
  .strict()

/** A wiki image cache key (the path under `/images/`), in its canonical form. */
const imageKey = z
  .string()
  .max(512, "Invalid key")
  .transform((value, ctx) => {
    const key = normalizeWikiImagePath(value)
    if (key === null) {
      ctx.addIssue({ code: "custom", message: "Not a wiki image key" })
      return z.NEVER
    }
    return key
  })

export const imageKeySchema = z.object({ key: imageKey }).strict()

export const refreshAllImagesSchema = z
  .object({
    /** Continue with the images that are still stale instead of marking all again. */
    resume: z.boolean().optional(),
  })
  .strict()

/** One readable sentence for the first problem in a failed parse. */
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return "Invalid input."
  if (issue.code === "unrecognized_keys") {
    return `Unknown field: ${issue.keys.join(", ")}.`
  }
  const path = issue.path.filter((part) => part !== "data").join(".")
  return path ? `Invalid ${path}: ${issue.message}.` : `${issue.message}.`
}

/** True when an update payload contains at least one defined field. */
export function hasChanges(data: Record<string, unknown>): boolean {
  return Object.values(data).some((value) => value !== undefined)
}
