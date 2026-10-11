import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface FilterPill {
  label: ReactNode
  href: string
  selected: boolean
  /** Optional trailing count. */
  count?: number
}

interface FilterPillsProps {
  /** Accessible name of the group, e.g. "Filter templates by category". */
  label: string
  pills: FilterPill[]
  className?: string
}

/**
 * URL-driven filter pills. Real links (so they work without JS, are keyboard
 * focusable and bookmarkable) with 44px touch targets, matching the dashboard.
 */
export function FilterPills({ label, pills, className }: FilterPillsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {pills.map((pill, index) => (
          <li key={`${pill.href}-${index}`}>
            <Link
              href={pill.href}
              aria-current={pill.selected ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden",
                pill.selected
                  ? "osrs-btn"
                  : "osrs-slot text-muted-foreground hover:text-foreground"
              )}
            >
              {pill.label}
              {pill.count !== undefined ? (
                <span className="osrs-qty text-xs tabular-nums">
                  {pill.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
