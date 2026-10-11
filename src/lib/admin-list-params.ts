/**
 * URL-state helpers for the super-admin lists: `?q=&page=&sort=&dir=&filter=`.
 * Everything here is pure so it can be shared by Server Components and tests.
 */

export const ADMIN_PAGE_SIZE = 25
const MAX_QUERY_LENGTH = 100
const MAX_PAGE = 100_000

export type SortDir = "asc" | "desc"

export type RawSearchParams = Record<string, string | string[] | undefined>

export interface ListConfig<K extends string> {
  sortKeys: readonly K[]
  defaultSort: K
  defaultDir: SortDir
  filters?: readonly string[]
}

export interface ListParams<K extends string> {
  q: string
  page: number
  sort: K
  dir: SortDir
  filter: string | null
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Parses and sanitises list params. Unknown sort keys and filters fall back to the defaults. */
export function parseListParams<K extends string>(
  raw: RawSearchParams,
  config: ListConfig<K>
): ListParams<K> {
  const q = (first(raw.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH)

  const parsedPage = Number.parseInt(first(raw.page) ?? "1", 10)
  const page = Number.isFinite(parsedPage)
    ? Math.min(Math.max(parsedPage, 1), MAX_PAGE)
    : 1

  const rawSort = first(raw.sort)
  const sort = config.sortKeys.find((key) => key === rawSort)
  const rawDir = first(raw.dir)
  const dir: SortDir =
    rawDir === "asc" || rawDir === "desc"
      ? rawDir
      : sort && sort !== config.defaultSort
        ? "asc"
        : config.defaultDir

  const rawFilter = first(raw.filter)
  const filter = config.filters?.find((f) => f === rawFilter) ?? null

  return { q, page, sort: sort ?? config.defaultSort, dir, filter }
}

/** Clamps a requested page into `1..totalPages` (at least 1). */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1))
}

/** Escapes `%`, `_` and `\` so user input is matched literally by LIKE/ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

/** `%term%` pattern for ILIKE, with the term capped at 100 characters and escaped. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value.slice(0, MAX_QUERY_LENGTH))}%`
}

export interface HrefState {
  q?: string
  page?: number
  sort?: string
  dir?: SortDir
  filter?: string | null
  [extra: string]: string | number | null | undefined
}

/**
 * Builds a list URL from the current params plus overrides. Empty values and
 * defaults (`page=1`) are dropped so URLs stay short and shareable.
 */
export function buildListHref(
  pathname: string,
  state: HrefState,
  overrides: HrefState = {}
): string {
  const merged: HrefState = { ...state, ...overrides }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") continue
    if (key === "page" && Number(value) <= 1) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Route params go straight into uuid columns; anything else would be a Postgres error (500). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * URL state to carry through sort/search/pagination links. Default sort and
 * direction are omitted so the canonical list URL stays `/super-admin/users`.
 */
export function toHrefState<K extends string>(
  params: ListParams<K>,
  config: ListConfig<K>
): HrefState {
  const isDefaultSort =
    params.sort === config.defaultSort && params.dir === config.defaultDir
  return {
    q: params.q || undefined,
    sort: isDefaultSort ? undefined : params.sort,
    dir: isDefaultSort ? undefined : params.dir,
    filter: params.filter ?? undefined,
  }
}
