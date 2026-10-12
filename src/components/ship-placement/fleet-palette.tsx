"use client"

import { CheckCircle2, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ShipVisual } from "@/components/ship-visual"
import { cn } from "@/lib/utils"

interface FleetPaletteProps {
  /** Ships needed per length, aggregated over all rules. */
  required: Record<number, number>
  /** Ships placed per length. */
  placed: Record<number, number>
  /** Length of the next ship to place. */
  selectedLength: number | null
  /** Length of the ship being built right now; no other length can be picked. */
  buildingLength: number | null
  disabled: boolean
  onSelect: (length: number) => void
}

/**
 * One choice per ship length (not per rule), with how many of them are placed.
 * A native radio group: arrow keys move the selection, Space picks. Progress is
 * written out ("1/2 placed") next to a check or a clock, never colour only.
 */
export function FleetPalette({
  required,
  placed,
  selectedLength,
  buildingLength,
  disabled,
  onSelect,
}: FleetPaletteProps) {
  const lengths = Object.keys(required)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div
      role="radiogroup"
      aria-label="Ship length to place"
      className="grid gap-2"
    >
      {lengths.map((length) => {
        const need = required[length] ?? 0
        const have = placed[length] ?? 0
        const complete = have >= need
        const otherLengthBuilding =
          buildingLength !== null && buildingLength !== length
        const unavailable = disabled || complete || otherLengthBuilding
        const checked = selectedLength === length

        return (
          <label
            key={length}
            className={cn(
              "osrs-btn flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-sm px-3 py-2 text-sm",
              "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid",
              checked && "osrs-bevel-inset !text-osrs-yellow translate-y-px",
              unavailable && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name="ship-length"
              value={length}
              checked={checked}
              disabled={unavailable}
              onChange={() => onSelect(length)}
              className="sr-only"
            />
            <ShipVisual length={length} />
            <span>{length} tiles</span>
            <Badge
              variant={complete ? "success" : "pending"}
              className="ml-auto"
            >
              {complete ? (
                <CheckCircle2 aria-hidden="true" className="size-3" />
              ) : (
                <Clock aria-hidden="true" className="size-3" />
              )}
              {have}/{need} placed
            </Badge>
          </label>
        )
      })}
    </div>
  )
}
