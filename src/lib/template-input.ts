import { z } from "zod"

/**
 * Template details a creator can set. Shared by the server actions (which
 * validate) and the dialogs (which show limits and normalise tags as chips).
 */

export const TEMPLATE_TITLE_MAX = 255
export const TEMPLATE_DESCRIPTION_MAX = 2000
export const TEMPLATE_CATEGORY_MAX = 100
export const TEMPLATE_TAGS_MAX = 5
export const TEMPLATE_TAG_MAX_LENGTH = 30
/** `tags` is a varchar(255) comma separated string. */
const TEMPLATE_TAGS_COLUMN_MAX = 255

/**
 * Splits a comma separated tag string into trimmed, non-empty, unique
 * (case-insensitive) tags, keeping the first spelling.
 */
export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of tags.split(",")) {
    const tag = part.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

/** Stored form of a tag list. */
export function serializeTags(tags: string[]): string {
  return parseTags(tags.join(",")).join(",")
}

const tagsField = z
  .string()
  .trim()
  .max(TEMPLATE_TAGS_COLUMN_MAX * 2)
  .default("")
  .transform((value) => parseTags(value))
  .superRefine((tags, ctx) => {
    if (tags.length > TEMPLATE_TAGS_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Use at most ${TEMPLATE_TAGS_MAX} tags`,
      })
    }
    if (tags.some((tag) => tag.length > TEMPLATE_TAG_MAX_LENGTH)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tags can be at most ${TEMPLATE_TAG_MAX_LENGTH} characters`,
      })
    }
    if (tags.join(",").length > TEMPLATE_TAGS_COLUMN_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tags are too long",
      })
    }
  })
  .transform((tags) => tags.join(","))

export const templateDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(
      TEMPLATE_TITLE_MAX,
      `Title can be at most ${TEMPLATE_TITLE_MAX} characters`
    ),
  description: z
    .string()
    .trim()
    .max(
      TEMPLATE_DESCRIPTION_MAX,
      `Description can be at most ${TEMPLATE_DESCRIPTION_MAX} characters`
    )
    .default(""),
  category: z
    .string()
    .trim()
    .max(
      TEMPLATE_CATEGORY_MAX,
      `Category can be at most ${TEMPLATE_CATEGORY_MAX} characters`
    )
    .default(""),
  tags: tagsField,
  isPublic: z.boolean(),
})

export type TemplateDetailsInput = z.input<typeof templateDetailsSchema>
export type TemplateDetails = z.output<typeof templateDetailsSchema>
