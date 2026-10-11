"use client"

import Link from "next/link"
import type React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buildListHref, type HrefState } from "@/lib/admin-list-params"
import { cn } from "@/lib/utils"
import { useAdminTableNav } from "./admin-table-frame"

interface AdminPaginationProps {
  basePath: string
  state: HrefState
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  noun: string
}

/** 1 … 4 5 6 … 20, always including first, last and the neighbours of the current page. */
export function pageWindow(
  page: number,
  totalPages: number
): (number | "gap")[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  pages.forEach((p, i) => {
    const prev = pages[i - 1]
    if (prev !== undefined && p - prev > 1) out.push("gap")
    out.push(p)
  })
  return out
}

function isPlainLeftClick(event: React.MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

export function AdminPagination({
  basePath,
  state,
  page,
  totalPages,
  totalCount,
  pageSize,
  noun,
}: AdminPaginationProps) {
  const { navigate } = useAdminTableNav()
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)
  const hrefFor = (p: number) => buildListHref(basePath, state, { page: p })

  const link = (target: number, children: React.ReactNode, label: string) => (
    <Button asChild variant="outline" size="sm">
      <Link
        href={hrefFor(target)}
        aria-label={label}
        onClick={(event) => {
          if (!isPlainLeftClick(event)) return
          event.preventDefault()
          navigate(hrefFor(target))
        }}
      >
        {children}
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        {totalCount === 0
          ? `No ${noun}`
          : `Showing ${from}–${to} of ${totalCount} ${noun}`}
      </p>
      {totalPages > 1 ? (
        <nav aria-label="Pagination">
          <ul className="flex items-center gap-1">
            <li>
              {page > 1 ? (
                link(
                  page - 1,
                  <>
                    <ChevronLeft aria-hidden="true" />
                    <span className="hidden sm:inline">Previous</span>
                  </>,
                  "Previous page"
                )
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  aria-label="Previous page (unavailable)"
                >
                  <ChevronLeft aria-hidden="true" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              )}
            </li>
            <li className="px-2 text-sm sm:hidden">
              Page {page} of {totalPages}
            </li>
            {pageWindow(page, totalPages).map((entry, index) =>
              entry === "gap" ? (
                <li
                  key={`gap-${index}`}
                  className="text-muted-foreground hidden px-1 sm:block"
                  aria-hidden="true"
                >
                  …
                </li>
              ) : (
                <li key={entry} className="hidden sm:block">
                  <Button
                    asChild
                    variant={entry === page ? "default" : "outline"}
                    size="sm"
                    className={cn("min-w-9 px-2")}
                  >
                    <Link
                      href={hrefFor(entry)}
                      aria-label={`Page ${entry}`}
                      aria-current={entry === page ? "page" : undefined}
                      onClick={(event) => {
                        if (!isPlainLeftClick(event)) return
                        event.preventDefault()
                        if (entry !== page) navigate(hrefFor(entry))
                      }}
                    >
                      {entry}
                    </Link>
                  </Button>
                </li>
              )
            )}
            <li>
              {page < totalPages ? (
                link(
                  page + 1,
                  <>
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight aria-hidden="true" />
                  </>,
                  "Next page"
                )
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  aria-label="Next page (unavailable)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
