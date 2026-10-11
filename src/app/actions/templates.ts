"use server"

import { revalidatePath } from "next/cache"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { bingoTemplates } from "@/server/db/schema"
import { getServerAuthSession } from "@/server/auth"
import { logger } from "@/lib/logger"
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import { templateDetailsSchema } from "@/lib/template-input"
import { summarizeTemplate } from "@/lib/template-summary"
import { exportBingoBoard, importBingoBoard } from "./bingo-import-export"

/**
 * Template mutations. Reads live in `@/server/queries/templates` so they are
 * not exposed as server actions.
 */

const saveTemplateSchema = templateDetailsSchema.extend({
  previewImage: z.string().max(255).optional(),
})

const idSchema = z.string().min(1).max(64)

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

function revalidateTemplates(templateId?: string) {
  revalidatePath("/templates")
  revalidatePath("/templates/my-templates")
  if (templateId) revalidatePath(`/templates/${templateId}`)
}

/**
 * Save a bingo board as a template. The caller must manage the board's Event
 * (enforced by `exportBingoBoard`).
 */
export async function saveBingoAsTemplate(
  bingoId: string,
  templateData: {
    title: string
    description: string
    category: string
    tags: string
    isPublic: boolean
    previewImage?: string
  }
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  const parsedInput = saveTemplateSchema.safeParse(templateData)
  if (!parsedInput.success) {
    return {
      success: false,
      error: firstIssue(parsedInput.error, "Invalid template data"),
    }
  }
  const input = parsedInput.data

  try {
    const exportedData = await exportBingoBoard(bingoId)
    if ("error" in exportedData) {
      return { success: false, error: exportedData.error }
    }

    const summary = summarizeTemplate(exportedData)

    const template = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(bingoTemplates)
        .values({
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          isPublic: input.isPublic,
          creatorId: session.user.id,
          originalBingoId: bingoId,
          previewImage: input.previewImage ?? null,
          templateData: JSON.stringify(exportedData),
          ...summary,
        })
        .returning({ id: bingoTemplates.id })
      return created
    })

    revalidateTemplates()
    return { success: true, templateId: template?.id }
  } catch (error) {
    logger.error({ error }, "Error saving template:", error)
    return { success: false, error: "Failed to save template" }
  }
}

/**
 * Edit a template's details. Only the creator may; the board content is
 * immutable (save a new template to change it).
 */
export async function updateTemplate(
  templateId: string,
  details: {
    title: string
    description: string
    category: string
    tags: string
    isPublic: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  const parsedId = idSchema.safeParse(templateId)
  if (!parsedId.success) {
    return { success: false, error: "Template not found" }
  }

  const parsedInput = templateDetailsSchema.safeParse(details)
  if (!parsedInput.success) {
    return {
      success: false,
      error: firstIssue(parsedInput.error, "Invalid template data"),
    }
  }
  const input = parsedInput.data
  const userId = session.user.id

  try {
    const result = await db.transaction(async (tx) => {
      const template = await tx.query.bingoTemplates.findFirst({
        where: eq(bingoTemplates.id, templateId),
        columns: { creatorId: true },
      })

      if (!template) {
        return { success: false, error: "Template not found" }
      }
      if (template.creatorId !== userId) {
        return {
          success: false,
          error: "You don't have permission to edit this template",
        }
      }

      await tx
        .update(bingoTemplates)
        .set({
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          isPublic: input.isPublic,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bingoTemplates.id, templateId),
            eq(bingoTemplates.creatorId, userId)
          )
        )

      return { success: true }
    })

    if (result.success) revalidateTemplates(templateId)
    return result
  } catch (error) {
    logger.error({ error }, "Error updating template:", error)
    return { success: false, error: "Failed to update template" }
  }
}

/**
 * Delete a template (creator only).
 */
export async function deleteTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const template = await tx.query.bingoTemplates.findFirst({
        where: eq(bingoTemplates.id, templateId),
        columns: { creatorId: true },
      })

      if (!template) {
        return { success: false, error: "Template not found" }
      }
      if (template.creatorId !== session.user.id) {
        return {
          success: false,
          error: "You don't have permission to delete this template",
        }
      }

      await tx.delete(bingoTemplates).where(eq(bingoTemplates.id, templateId))
      return { success: true }
    })

    if (result.success) revalidateTemplates(templateId)
    return result
  } catch (error) {
    logger.error({ error }, "Error deleting template:", error)
    return { success: false, error: "Failed to delete template" }
  }
}

/**
 * Adds a template's board to an Event. The template JSON never leaves the
 * server. Needs read access to the template (public, or yours) and the
 * admin/management role in the target Event (enforced by `importBingoBoard`).
 */
export async function importTemplateIntoEvent(
  templateId: string,
  eventId: string
): Promise<{ success: boolean; bingoId?: string; error?: string }> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }
  if (
    !idSchema.safeParse(templateId).success ||
    !idSchema.safeParse(eventId).success
  ) {
    return { success: false, error: "Template or event not found" }
  }

  try {
    const template = await db.query.bingoTemplates.findFirst({
      where: eq(bingoTemplates.id, templateId),
      columns: { templateData: true, isPublic: true, creatorId: true },
    })

    // Private templates look identical to missing ones for other users.
    if (
      !template ||
      !(template.isPublic || template.creatorId === session.user.id)
    ) {
      return { success: false, error: "Template not found" }
    }

    // Validates and upgrades templates saved by older versions.
    const parsed = parseExportedBingo(template.templateData)
    if (!parsed.success) {
      logger.warn({ templateId, error: parsed.error }, "Invalid template data")
      return { success: false, error: "This template can't be imported" }
    }

    const imported = await importBingoBoard(eventId, parsed.data)
    if (!imported.success) return imported

    try {
      await db
        .update(bingoTemplates)
        .set({ downloadCount: sql`${bingoTemplates.downloadCount} + 1` })
        .where(eq(bingoTemplates.id, templateId))
      revalidatePath("/templates")
      revalidatePath(`/templates/${templateId}`)
    } catch (error) {
      // The board exists already; a missed counter must not fail the import.
      logger.error({ error }, "Error incrementing download count:", error)
    }

    return imported
  } catch (error) {
    logger.error({ error }, "Error importing template:", error)
    return { success: false, error: "Failed to import template" }
  }
}
