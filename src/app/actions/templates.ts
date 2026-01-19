"use server"

import { db } from "@/server/db"
import { logger } from "@/lib/logger";
import { bingoTemplates } from "@/server/db/schema"
import { eq, desc, like, and, or, sql } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { exportBingoBoard } from "./bingo-import-export"
import type { ExportedBingo } from "./bingo-import-export"
import { revalidatePath } from "next/cache"
import getRandomFrog from "@/lib/getRandomFrog"

export interface BingoTemplate {
  id: string
  title: string
  description: string | null
  previewImage: string | null
  creatorId: string | null
  originalBingoId: string | null
  category: string | null
  tags: string | null
  isPublic: boolean
  templateData: string
  downloadCount: number
  createdAt: Date
  updatedAt: Date
  creatorName?: string | null
  creatorImage?: string | null
}

/**
 * Save a bingo board as a template
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
  },
) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Export the bingo board data
    const exportedData = await exportBingoBoard(bingoId)

    if ("error" in exportedData) {
      throw new Error(exportedData.error)
    }

    // Save the template
    const [template] = await db
      .insert(bingoTemplates)
      .values({
        title: templateData.title,
        description: templateData.description,
        category: templateData.category,
        tags: templateData.tags,
        isPublic: templateData.isPublic,
        creatorId: session.user.id,
        originalBingoId: bingoId,
        previewImage: templateData.previewImage ?? null,
        templateData: JSON.stringify(exportedData),
      })
      .returning()

    revalidatePath("/templates")
    return { success: true, templateId: template?.id }
  } catch (error) {
    logger.error({ error }, "Error saving template:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to save template" }
  }
}

/**
 * Get all public templates with optional filtering
 */
export async function getPublicTemplates(
  options: {
    search?: string
    category?: string
    size?: string
    limit?: number
    offset?: number
  } = {},
): Promise<{ templates: BingoTemplate[]; total: number }> {
  const { search, category, size, limit = 12, offset = 0 } = options

  try {
    // Build the query conditions
    const conditions = [eq(bingoTemplates.isPublic, true)]

    if (search) {
      conditions.push(
        or(
          like(bingoTemplates.title, `%${search}%`),
          like(bingoTemplates.description, `%${search}%`),
          like(bingoTemplates.tags, `%${search}%`),
        )!,
      )
    }

    if (category) {
      conditions.push(eq(bingoTemplates.category, category))
    }

    if (size) {
      // Parse the size filter (e.g., "5x5", "3x3")
      const [rows, columns] = size.split("x").map(Number)
      if (!!rows && !!columns && !isNaN(rows) && !isNaN(columns)) {
        conditions.push(
          sql`json_extract(${bingoTemplates.templateData}, '$.metadata.rows') = ${rows} AND
              json_extract(${bingoTemplates.templateData}, '$.metadata.columns') = ${columns}`,
        )
      }
    }

    // Get total count
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(bingoTemplates)
      .where(and(...conditions));

    const count = result[0]?.count ?? 0

    // Get templates with pagination
    const templates = await db.query.bingoTemplates.findMany({
      where: and(...conditions),
      orderBy: [desc(bingoTemplates.createdAt)],
      limit,
      offset,
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // Format the results
    const formattedTemplates = templates.map((template) => ({
      ...template,
      creatorName: template.creator?.name ?? "Unknown Creator",
      creatorImage: template.creator?.image ?? getRandomFrog(),
    }))

    return {
      templates: formattedTemplates,
      total: Number(count),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching templates:", error)
    return { templates: [], total: 0 }
  }
}

/**
 * Get a template by ID
 */
export async function getTemplateById(templateId: string): Promise<BingoTemplate | null> {
  try {
    const template = await db.query.bingoTemplates.findFirst({
      where: eq(bingoTemplates.id, templateId),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    if (!template) {
      return null
    }

    return {
      ...template,
      creatorName: template.creator?.name ?? "Unknown Creator",
      creatorImage: template.creator?.image ?? getRandomFrog(),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching template:", error)
    return null
  }
}

/**
 * Get templates created by the current user
 */
export async function getUserTemplates(): Promise<BingoTemplate[]> {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return []
  }

  try {
    const templates = await db.query.bingoTemplates.findMany({
      where: eq(bingoTemplates.creatorId, session.user.id),
      orderBy: [desc(bingoTemplates.createdAt)],
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return templates.map((template) => ({
      ...template,
      creatorName: template.creator?.name ?? "Unknown Creator",
      creatorImage: template.creator?.image ?? getRandomFrog(),
    }))
  } catch (error) {
    logger.error({ error }, "Error fetching user templates:", error)
    return []
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const template = await db.query.bingoTemplates.findFirst({
      where: eq(bingoTemplates.id, templateId),
      columns: {
        creatorId: true,
      },
    })

    if (!template) {
      return { success: false, error: "Template not found" }
    }

    if (template.creatorId !== session.user.id) {
      return { success: false, error: "You don't have permission to delete this template" }
    }

    await db.delete(bingoTemplates).where(eq(bingoTemplates.id, templateId))

    revalidatePath("/templates")
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting template:", error)
    return { success: false, error: "Failed to delete template" }
  }
}

/**
 * Increment the download count for a template
 */
export async function incrementTemplateDownloadCount(templateId: string) {
  try {
    await db
      .update(bingoTemplates)
      .set({
        downloadCount: sql`${bingoTemplates.downloadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bingoTemplates.id, templateId))

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error incrementing download count:", error)
    return { success: false }
  }
}

/**
 * Get template data for import
 */
export async function getTemplateData(templateId: string): Promise<ExportedBingo | { error: string }> {
  try {
    const template = await db.query.bingoTemplates.findFirst({
      where: eq(bingoTemplates.id, templateId),
      columns: {
        templateData: true,
      },
    })

    if (!template) {
      return { error: "Template not found" }
    }

    // Increment download count
    await incrementTemplateDownloadCount(templateId)

    // Parse the template data
    return JSON.parse(template.templateData) as ExportedBingo
  } catch (error) {
    logger.error({ error }, "Error getting template data:", error)
    return { error: "Failed to get template data" }
  }
}

/**
 * Get popular categories
 */
export async function getTemplateCategories(): Promise<string[]> {
  try {
    const categories = await db
      .select({ category: bingoTemplates.category })
      .from(bingoTemplates)
      .where(and(eq(bingoTemplates.isPublic, true), sql`${bingoTemplates.category} IS NOT NULL`))
      .groupBy(bingoTemplates.category)
      .orderBy(desc(sql`count(*)`))
      .limit(10)

    return categories.map((c) => c.category).filter((c): c is string => c !== null)
  } catch (error) {
    logger.error({ error }, "Error fetching categories:", error)
    return []
  }
}

/**
 * Get available board sizes
 */
export async function getTemplateSizes(): Promise<string[]> {
  try {
    const sizes = await db
      .select({
        rows: sql<number>`json_extract(${bingoTemplates.templateData}, '$.metadata.rows')`,
        columns: sql<number>`json_extract(${bingoTemplates.templateData}, '$.metadata.columns')`,
      })
      .from(bingoTemplates)
      .where(eq(bingoTemplates.isPublic, true))
      .groupBy(
        sql`json_extract(${bingoTemplates.templateData}, '$.metadata.rows')`,
        sql`json_extract(${bingoTemplates.templateData}, '$.metadata.columns')`,
      )
      .orderBy(
        sql`json_extract(${bingoTemplates.templateData}, '$.metadata.rows')`,
        sql`json_extract(${bingoTemplates.templateData}, '$.metadata.columns')`,
      )

    return sizes.map((s) => `${s.rows}x${s.columns}`).filter((size) => size.includes("x")) // Filter out any invalid sizes
  } catch (error) {
    logger.error({ error }, "Error fetching sizes:", error)
    return []
  }
}

