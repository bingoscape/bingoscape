import type { RawSearchParams } from "@/lib/admin-list-params"

/**
 * URL state of the template gallery and "My templates":
 * `?search=&category=&size=&type=&sort=&page=` and `?visibility=`.
 * Pure, so Server Components and tests share it.
 */

export const TEMPLATE_PAGE_SIZE = 12
export const TEMPLATE_SORTS = ["newest", "popular"] as const
export const TEMPLATE_TYPES = ["standard", "progression"] as const
export const TEMPLATE_VISIBILITIES = ["all", "public", "private"] as const

export type TemplateSort = (typeof TEMPLATE_SORTS)[number]
export type TemplateTypeFilter = (typeof TEMPLATE_TYPES)[number]
export type TemplateVisibility = (typeof TEMPLATE_VISIBILITIES)[number]

const MAX_SEARCH_LENGTH = 100
const MAX_PAGE = 100_000
const SIZE_PATTERN = /^\d{1,2}x\d{1,2}$/

export interface TemplateListParams {
  search: string
  category: string
  /** `"5x5"` or empty. */
  size: string
  type: TemplateTypeFilter | ""
  sort: TemplateSort
  page: number
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseTemplateListParams(
  raw: RawSearchParams
): TemplateListParams {
  const size = (first(raw.size) ?? "").trim().toLowerCase()
  const type = first(raw.type) ?? ""
  const sort = first(raw.sort) ?? ""
  const page = Number.parseInt(first(raw.page) ?? "1", 10)

  return {
    search: (first(raw.search) ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    category: (first(raw.category) ?? "").trim().slice(0, 100),
    size: SIZE_PATTERN.test(size) ? size : "",
    type: (TEMPLATE_TYPES as readonly string[]).includes(type)
      ? (type as TemplateTypeFilter)
      : "",
    sort: (TEMPLATE_SORTS as readonly string[]).includes(sort)
      ? (sort as TemplateSort)
      : "newest",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
  }
}

/** Number of active filters (search, category, size, type); sort is not one. */
export function countActiveFilters(params: TemplateListParams): number {
  return [params.search, params.category, params.size, params.type].filter(
    Boolean
  ).length
}

/**
 * Gallery URL for `params` with `overrides` applied. Defaults are omitted so
 * links stay short. Changing anything but the page resets to page 1.
 */
export function buildTemplateListHref(
  params: TemplateListParams,
  overrides: Partial<TemplateListParams> = {}
): string {
  const next = { ...params, ...overrides }
  if (!("page" in overrides)) next.page = 1

  const query = new URLSearchParams()
  if (next.search) query.set("search", next.search)
  if (next.category) query.set("category", next.category)
  if (next.size) query.set("size", next.size)
  if (next.type) query.set("type", next.type)
  if (next.sort !== "newest") query.set("sort", next.sort)
  if (next.page > 1) query.set("page", String(next.page))

  const qs = query.toString()
  return qs ? `/templates?${qs}` : "/templates"
}

export function parseTemplateVisibility(
  raw: RawSearchParams
): TemplateVisibility {
  const value = first(raw.visibility) ?? ""
  return (TEMPLATE_VISIBILITIES as readonly string[]).includes(value)
    ? (value as TemplateVisibility)
    : "all"
}

/** Page numbers to show: first, last and a window around the current page. */
export function paginationWindow(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)

  const result: (number | "ellipsis")[] = []
  sorted.forEach((page, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && page - prev > 1) result.push("ellipsis")
    result.push(page)
  })
  return result
}
