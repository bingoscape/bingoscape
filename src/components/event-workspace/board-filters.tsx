"use client"

import { cn } from "@/lib/utils"
import {
  availableFilters,
  type TileFilter,
  type TileFilterContext,
} from "@/lib/tile-filter"

interface BoardFiltersProps {
  context: TileFilterContext
  active: TileFilter | null
  counts: Record<TileFilter, number>
  onChange: (filter: TileFilter | null) => void
}

/** Chip label; management reviews what players submit, players act on it. */
function filterLabel(filter: TileFilter, isManagement: boolean): string {
  switch (filter) {
    case "attention":
      return isManagement ? "Needs review" : "Needs attention"
    case "incomplete":
      return "Incomplete"
    case "hidden":
      return "Hidden"
  }
}

/**
 * Toggle chips that fade the Tiles not matching a filter. One filter at a
 * time; the Board layout never changes. Empty filters are hidden unless active
 * (so they can still be cleared).
 */
export function BoardFilters({
  context,
  active,
  counts,
  onChange,
}: BoardFiltersProps) {
  const filters = availableFilters(context).filter(
    (filter) => counts[filter] > 0 || filter === active
  )
  if (filters.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Filter Tiles"
      className="flex flex-wrap gap-1.5"
    >
      {filters.map((filter) => {
        const pressed = filter === active
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? null : filter)}
            className={cn(
              "focus-visible:ring-ring inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden",
              pressed
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
            )}
          >
            {filterLabel(filter, context.isManagement)}
            <span className="tabular-nums">{counts[filter]}</span>
          </button>
        )
      })}
    </div>
  )
}
