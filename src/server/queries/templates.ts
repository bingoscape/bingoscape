import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm"

import { db } from "@/server/db"
import { bingoTemplates } from "@/server/db/schema"
import { logger } from "@/lib/logger"
import getRandomFrog from "@/lib/getRandomFrog"
import { containsPattern } from "@/lib/admin-list-params"
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import { parseTags } from "@/lib/template-input"
import {
  buildCardPreview,
  buildDetailPreview,
  type TemplateCardPreview,
  type TemplatePreviewData,
} from "@/lib/template-preview"
import { summarizeTemplate, type TemplateSummary } from "@/lib/template-summary"
import type {
  TemplateSort,
  TemplateTypeFilter,
  TemplateVisibility,
} from "@/lib/template-list-params"

/**
 * Read side of the template gallery. Deliberately NOT a "use server" module:
 * these functions take the viewer as an argument and must never be callable
 * from the browser. Call them from Server Components.
 */

export interface TemplateListItem {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  isPublic: boolean
  downloadCount: number
  createdAt: Date
  creatorName: string
  creatorImage: string
  /** `null` only if the stored JSON is unreadable and was never summarised. */
  facts: TemplateSummary | null
  /** Hidden tiles are masked for everyone on cards. `null` if unreadable. */
  preview: TemplateCardPreview | null
}

export interface TemplateDetail {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  isPublic: boolean
  downloadCount: number
  createdAt: Date
  creatorName: string
  creatorImage: string
  isOwner: boolean
  facts: TemplateSummary | null
  /** Hidden tiles are masked unless the viewer is the creator. */
  preview: TemplatePreviewData | null
}

export interface FacetOption {
  value: string
  count: number
}

export interface TemplateFacets {
  categories: FacetOption[]
  /** `"5x5"` style values, smallest first. */
  sizes: FacetOption[]
  types: FacetOption[]
}

// Gallery filters use the denormalised columns and fall back to the stored
// JSON for rows that haven't been summarised yet (see
// scripts/backfill-template-metadata.ts). COALESCE only evaluates the JSON
// cast for rows where the column is still NULL.
const jsonText = (path: string) =>
  sql`(${bingoTemplates.templateData}::jsonb #>> ${sql.raw(`'{${path}}'`)})`

const rowsExpr = sql<
  number | null
>`coalesce(${bingoTemplates.rows}, (${jsonText("metadata,rows")})::int)`
const columnsExpr = sql<
  number | null
>`coalesce(${bingoTemplates.columns}, (${jsonText("metadata,columns")})::int)`
const typeExpr = sql<string>`coalesce(${bingoTemplates.bingoType}::text, ${jsonText("metadata,bingoType")}, 'standard')`

type TemplateRow = typeof bingoTemplates.$inferSelect & {
  creator: { id: string; name: string | null; image: string | null } | null
}

function summaryFromColumns(row: TemplateRow): TemplateSummary | null {
  if (
    row.schemaVersion === null ||
    row.bingoType === null ||
    row.rows === null ||
    row.columns === null ||
    row.tileCount === null ||
    row.tierCount === null ||
    row.totalXp === null ||
    row.hasPatternBonuses === null ||
    row.hasHiddenTiles === null
  ) {
    return null
  }
  return {
    schemaVersion: row.schemaVersion,
    bingoType: row.bingoType,
    rows: row.rows,
    columns: row.columns,
    tileCount: row.tileCount,
    tierCount: row.tierCount,
    totalXp: row.totalXp,
    hasPatternBonuses: row.hasPatternBonuses,
    hasHiddenTiles: row.hasHiddenTiles,
  }
}

function baseFields(row: TemplateRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: parseTags(row.tags),
    isPublic: row.isPublic,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt,
    creatorName: row.creator?.name ?? "Unknown Creator",
    creatorImage: row.creator?.image ?? getRandomFrog(),
  }
}

function toListItem(row: TemplateRow): TemplateListItem {
  const parsed = parseExportedBingo(row.templateData)
  if (!parsed.success) {
    logger.warn(
      { templateId: row.id, error: parsed.error },
      "Unreadable template"
    )
  }
  return {
    ...baseFields(row),
    facts: parsed.success
      ? summarizeTemplate(parsed.data)
      : summaryFromColumns(row),
    preview: parsed.success ? buildCardPreview(parsed.data) : null,
  }
}

const withCreator = {
  creator: { columns: { id: true, name: true, image: true } },
} as const

export interface PublicTemplateQuery {
  search?: string
  category?: string
  /** `"5x5"` */
  size?: string
  bingoType?: TemplateTypeFilter | ""
  sort?: TemplateSort
  limit?: number
  offset?: number
}

/** Public templates, filtered, sorted and paginated. */
export async function getPublicTemplates(
  options: PublicTemplateQuery = {}
): Promise<{ templates: TemplateListItem[]; total: number }> {
  const {
    search,
    category,
    size,
    bingoType,
    sort = "newest",
    limit = 12,
    offset = 0,
  } = options

  try {
    const conditions = [eq(bingoTemplates.isPublic, true)]

    if (search) {
      conditions.push(
        or(
          ilike(bingoTemplates.title, containsPattern(search)),
          ilike(bingoTemplates.description, containsPattern(search)),
          ilike(bingoTemplates.tags, containsPattern(search))
        )!
      )
    }

    if (category) {
      conditions.push(eq(bingoTemplates.category, category))
    }

    if (size) {
      const [rows, columns] = size.split("x").map(Number)
      if (
        rows &&
        columns &&
        Number.isInteger(rows) &&
        Number.isInteger(columns)
      ) {
        conditions.push(
          sql`${rowsExpr} = ${rows}`,
          sql`${columnsExpr} = ${columns}`
        )
      }
    }

    if (bingoType) {
      conditions.push(sql`${typeExpr} = ${bingoType}`)
    }

    const where = and(...conditions)

    const [countRows, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(bingoTemplates)
        .where(where),
      db.query.bingoTemplates.findMany({
        where,
        orderBy:
          sort === "popular"
            ? [
                desc(bingoTemplates.downloadCount),
                desc(bingoTemplates.createdAt),
                asc(bingoTemplates.id),
              ]
            : [desc(bingoTemplates.createdAt), asc(bingoTemplates.id)],
        limit,
        offset,
        with: withCreator,
      }),
    ])

    return {
      templates: rows.map(toListItem),
      total: Number(countRows[0]?.count ?? 0),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching templates:", error)
    return { templates: [], total: 0 }
  }
}

/** Counts per category, size and type across all public templates. */
export async function getTemplateFacets(): Promise<TemplateFacets> {
  const isPublic = eq(bingoTemplates.isPublic, true)

  try {
    const [categories, sizes, types] = await Promise.all([
      db
        .select({
          value: bingoTemplates.category,
          count: sql<number>`count(*)`,
        })
        .from(bingoTemplates)
        .where(
          and(
            isPublic,
            isNotNull(bingoTemplates.category),
            sql`${bingoTemplates.category} <> ''`
          )
        )
        .groupBy(bingoTemplates.category)
        .orderBy(desc(sql`count(*)`), asc(bingoTemplates.category))
        .limit(30),
      db
        .select({
          rows: rowsExpr,
          columns: columnsExpr,
          count: sql<number>`count(*)`,
        })
        .from(bingoTemplates)
        .where(isPublic)
        .groupBy(rowsExpr, columnsExpr)
        .orderBy(asc(rowsExpr), asc(columnsExpr))
        .limit(30),
      db
        .select({ value: typeExpr, count: sql<number>`count(*)` })
        .from(bingoTemplates)
        .where(isPublic)
        .groupBy(typeExpr)
        .orderBy(asc(typeExpr)),
    ])

    return {
      categories: categories.flatMap((c) =>
        c.value ? [{ value: c.value, count: Number(c.count) }] : []
      ),
      sizes: sizes.flatMap((s) =>
        s.rows && s.columns
          ? [{ value: `${s.rows}x${s.columns}`, count: Number(s.count) }]
          : []
      ),
      types: types.map((t) => ({ value: t.value, count: Number(t.count) })),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching template facets:", error)
    return { categories: [], sizes: [], types: [] }
  }
}

/**
 * Category names to suggest in the create/edit dialogs: the popular public
 * ones plus the viewer's own (which may be private).
 */
export async function getCategorySuggestions(
  userId: string
): Promise<string[]> {
  try {
    const rows = await db
      .select({ value: bingoTemplates.category, count: sql<number>`count(*)` })
      .from(bingoTemplates)
      .where(
        and(
          isNotNull(bingoTemplates.category),
          sql`${bingoTemplates.category} <> ''`,
          or(
            eq(bingoTemplates.isPublic, true),
            eq(bingoTemplates.creatorId, userId)
          )
        )
      )
      .groupBy(bingoTemplates.category)
      .orderBy(desc(sql`count(*)`), asc(bingoTemplates.category))
      .limit(30)

    return rows.flatMap((r) => (r.value ? [r.value] : []))
  } catch (error) {
    logger.error({ error }, "Error fetching category suggestions:", error)
    return []
  }
}

/**
 * One template for its detail page. Private templates are only visible to
 * their creator and look like missing ones to everybody else.
 */
export async function getTemplateDetail(
  templateId: string,
  viewerId: string
): Promise<TemplateDetail | null> {
  try {
    const row = await db.query.bingoTemplates.findFirst({
      where: eq(bingoTemplates.id, templateId),
      with: withCreator,
    })

    const isOwner = !!row && row.creatorId === viewerId
    if (!row || !(row.isPublic || isOwner)) return null

    const parsed = parseExportedBingo(row.templateData)
    if (!parsed.success) {
      logger.warn({ templateId, error: parsed.error }, "Unreadable template")
    }

    return {
      ...baseFields(row),
      isOwner,
      facts: parsed.success
        ? summarizeTemplate(parsed.data)
        : summaryFromColumns(row),
      preview: parsed.success
        ? buildDetailPreview(parsed.data, { isOwner })
        : null,
    }
  } catch (error) {
    logger.error({ error }, "Error fetching template:", error)
    return null
  }
}

const MY_TEMPLATES_LIMIT = 200

/** The viewer's own templates, optionally narrowed by visibility. */
export async function getUserTemplates(
  userId: string,
  visibility: TemplateVisibility = "all"
): Promise<{
  templates: TemplateListItem[]
  counts: { all: number; public: number; private: number }
}> {
  try {
    const mine = eq(bingoTemplates.creatorId, userId)
    const where =
      visibility === "all"
        ? mine
        : and(mine, eq(bingoTemplates.isPublic, visibility === "public"))

    const [rows, counts] = await Promise.all([
      db.query.bingoTemplates.findMany({
        where,
        orderBy: [desc(bingoTemplates.createdAt), asc(bingoTemplates.id)],
        limit: MY_TEMPLATES_LIMIT,
        with: withCreator,
      }),
      db
        .select({
          isPublic: bingoTemplates.isPublic,
          count: sql<number>`count(*)`,
        })
        .from(bingoTemplates)
        .where(mine)
        .groupBy(bingoTemplates.isPublic),
    ])

    const publicCount = Number(counts.find((c) => c.isPublic)?.count ?? 0)
    const privateCount = Number(counts.find((c) => !c.isPublic)?.count ?? 0)

    return {
      templates: rows.map(toListItem),
      counts: {
        all: publicCount + privateCount,
        public: publicCount,
        private: privateCount,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error fetching user templates:", error)
    return { templates: [], counts: { all: 0, public: 0, private: 0 } }
  }
}
