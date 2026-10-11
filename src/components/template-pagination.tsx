import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { paginationWindow } from "@/lib/template-list-params"
import { cn } from "@/lib/utils"

interface TemplatePaginationProps {
  page: number
  totalPages: number
  /** URL of a page; called on the server. */
  hrefForPage: (page: number) => string
  label?: string
}

const cell = "min-h-11 min-w-11 px-3"

/**
 * Server-rendered pagination with 44px targets. Phones show Previous / "Page X
 * of Y" / Next; from `sm` the numbered window is shown as well.
 */
export function TemplatePagination({
  page,
  totalPages,
  hrefForPage,
  label = "Templates pagination",
}: TemplatePaginationProps) {
  if (totalPages <= 1) return null

  const disabled = cn(cell, "text-muted-foreground opacity-50")

  return (
    <nav aria-label={label} className="mt-8">
      <ul className="flex items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={hrefForPage(page - 1)}
              rel="prev"
              className={cn(buttonVariants({ variant: "outline" }), cell)}
            >
              <ChevronLeft aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Previous</span>
              <span className="sr-only sm:hidden">page</span>
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className={cn(buttonVariants({ variant: "outline" }), disabled)}
            >
              <ChevronLeft />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}
        </li>

        <li
          className="text-muted-foreground px-3 text-sm sm:hidden"
          aria-current="page"
        >
          Page {page} of {totalPages}
        </li>

        {paginationWindow(page, totalPages).map((entry, index) =>
          entry === "ellipsis" ? (
            <li
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="text-muted-foreground hidden px-1 sm:block"
            >
              …
            </li>
          ) : (
            <li key={entry} className="hidden sm:block">
              <Link
                href={hrefForPage(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Page ${entry}`}
                className={cn(
                  buttonVariants({
                    variant: entry === page ? "default" : "ghost",
                  }),
                  cell
                )}
              >
                {entry}
              </Link>
            </li>
          )
        )}

        <li>
          {page < totalPages ? (
            <Link
              href={hrefForPage(page + 1)}
              rel="next"
              className={cn(buttonVariants({ variant: "outline" }), cell)}
            >
              <span className="sr-only sm:not-sr-only">Next</span>
              <span className="sr-only sm:hidden">page</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className={cn(buttonVariants({ variant: "outline" }), disabled)}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
