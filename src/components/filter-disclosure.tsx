"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilterDisclosureProps {
  /** Number of active filters, shown on the toggle. */
  activeCount?: number
  children: ReactNode
  className?: string
}

/**
 * Collapses a group of filters behind a "Filters" toggle below `lg` (phones
 * and tablets); from `lg` the filters are always visible. The children are
 * server-rendered link pills, so filtering itself needs no JavaScript.
 */
export function FilterDisclosure({
  activeCount = 0,
  children,
  className,
}: FilterDisclosureProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between lg:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <span className="osrs-qty text-xs tabular-nums">
              {activeCount}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </Button>
      <div
        id={panelId}
        className={cn("mt-3 space-y-4 lg:mt-0 lg:block", !open && "hidden")}
      >
        {children}
      </div>
    </div>
  )
}
