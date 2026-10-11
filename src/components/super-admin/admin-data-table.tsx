import Link from "next/link"
import type React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  buildListHref,
  type HrefState,
  type SortDir,
} from "@/lib/admin-list-params"
import { cn } from "@/lib/utils"
import { AdminPagination } from "./admin-pagination"
import { AdminSearch } from "./admin-search"
import { AdminTableFrame } from "./admin-table-frame"

export interface AdminColumn<T> {
  key: string
  header: string
  /** Makes the header a sort link; must be a key the query accepts. */
  sortKey?: string
  /** Direction applied the first time the column is sorted. */
  firstDir?: SortDir
  /** The cell that names the row. Rendered as a row header (`<th scope="row">`). */
  isRowHeader?: boolean
  /** Hide below `md`; put the essentials in the row-header cell instead. */
  hideOnMobile?: boolean
  className?: string
  cell: (row: T) => React.ReactNode
}

export interface AdminFilterOption {
  label: string
  value: string | null
}

interface AdminDataTableProps<T> {
  /** Names the table for assistive tech, e.g. "Users". */
  caption: string
  noun: string
  columns: AdminColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  /** Overflow menu cell. Receives the row; must give each menu a unique accessible name. */
  rowActions?: (row: T) => React.ReactNode
  basePath: string
  /** Everything in the URL that must be preserved (tab, filter, sort...). */
  state: HrefState
  sort: { key: string; dir: SortDir }
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  searchLabel: string
  searchPlaceholder: string
  filters?: AdminFilterOption[]
  filterLabel?: string
  emptyTitle?: string
  /** Unique per table on the page (a tab page may only have one). */
  idPrefix?: string
}

/**
 * Server-driven data table: all state lives in the URL, so sort, search,
 * filter and pagination are plain links / GET navigations and are shareable.
 */
export function AdminDataTable<T>({
  caption,
  noun,
  columns,
  rows,
  getRowKey,
  rowActions,
  basePath,
  state,
  sort,
  page,
  totalPages,
  totalCount,
  pageSize,
  searchLabel,
  searchPlaceholder,
  filters,
  filterLabel,
  emptyTitle,
  idPrefix = "admin",
}: AdminDataTableProps<T>) {
  const hasQuery = Boolean(state.q) || Boolean(state.filter)
  const clearHref = buildListHref(basePath, state, {
    q: "",
    filter: null,
    page: 1,
  })
  const sortDescription = `Sorted by ${
    columns.find((c) => c.sortKey === sort.key)?.header ?? sort.key
  }, ${sort.dir === "asc" ? "ascending" : "descending"}.`

  return (
    <AdminTableFrame>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 sm:max-w-md sm:flex-1">
          <AdminSearch
            key={state.q ?? ""}
            basePath={basePath}
            state={state}
            label={searchLabel}
            placeholder={searchPlaceholder}
            inputId={`${idPrefix}-search`}
          />
        </div>
        {filters && filters.length > 0 ? (
          <nav aria-label={filterLabel ?? `Filter ${noun}`}>
            <ul className="flex flex-wrap gap-1">
              {filters.map((option) => {
                const active = (state.filter ?? null) === option.value
                return (
                  <li key={option.label}>
                    <Button
                      asChild
                      size="sm"
                      variant={active ? "default" : "outline"}
                    >
                      <Link
                        href={buildListHref(basePath, state, {
                          filter: option.value,
                          page: 1,
                        })}
                        aria-current={active ? "true" : undefined}
                      >
                        {option.label}
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </nav>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div
          role="status"
          className="osrs-panel-inset flex flex-col items-center gap-3 rounded-sm px-4 py-10 text-center"
        >
          <p className="font-medium">
            {emptyTitle ??
              (hasQuery ? `No ${noun} match your search` : `No ${noun} yet`)}
          </p>
          {hasQuery ? (
            <>
              <p className="text-muted-foreground text-sm">
                Try a different term or remove the filter.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href={clearHref}>Clear search</Link>
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="osrs-panel-inset rounded-sm">
          <Table>
            <TableCaption className="sr-only">
              {caption}. {sortDescription} Page {page} of {totalPages}.
            </TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => {
                  const sorted = column.sortKey === sort.key
                  const ariaSort = column.sortKey
                    ? sorted
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                  const nextDir: SortDir = sorted
                    ? sort.dir === "asc"
                      ? "desc"
                      : "asc"
                    : (column.firstDir ?? "asc")
                  const Icon = sorted
                    ? sort.dir === "asc"
                      ? ArrowUp
                      : ArrowDown
                    : ArrowUpDown
                  return (
                    <TableHead
                      key={column.key}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn(
                        "h-10 px-3 text-xs tracking-wide uppercase",
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className
                      )}
                    >
                      {column.sortKey ? (
                        <Link
                          href={buildListHref(basePath, state, {
                            sort: column.sortKey,
                            dir: nextDir,
                            page: 1,
                          })}
                          className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-1 focus-visible:ring-2 focus-visible:outline-hidden"
                        >
                          {column.header}
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5",
                              !sorted && "opacity-60"
                            )}
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            , sort{" "}
                            {nextDir === "asc" ? "ascending" : "descending"}
                          </span>
                        </Link>
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  )
                })}
                {rowActions ? (
                  <TableHead scope="col" className="w-12 px-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((column) =>
                    column.isRowHeader ? (
                      <th
                        key={column.key}
                        scope="row"
                        className={cn(
                          "p-3 text-left align-middle font-normal",
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </th>
                    ) : (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "p-3",
                          column.hideOnMobile && "hidden md:table-cell",
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    )
                  )}
                  {rowActions ? (
                    <TableCell className="w-12 p-2 text-right">
                      {rowActions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminPagination
        basePath={basePath}
        state={state}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        noun={noun}
      />
    </AdminTableFrame>
  )
}
