"use client"

import Image from "next/image"
import { BarChart2, Layers, Loader2, Package, Target } from "lucide-react"
import type { GoalChipData } from "@/lib/goal-setup"
import { cn, getOptimizedImageUrl } from "@/lib/utils"

/** Chips shown before the rest is folded into "+N more". */
const DEFAULT_MAX_CHIPS = 6

function ChipIcon({ chip }: { chip: GoalChipData }) {
  if (chip.kind === "item") {
    return chip.imageUrl ? (
      <Image
        src={getOptimizedImageUrl(chip.imageUrl)}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
      />
    ) : (
      <Package aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    )
  }
  if (chip.kind === "metric") {
    return (
      <BarChart2
        aria-hidden="true"
        className="text-info h-3.5 w-3.5 shrink-0"
      />
    )
  }
  if (chip.kind === "group") {
    return (
      <Layers
        aria-hidden="true"
        className="text-primary h-3.5 w-3.5 shrink-0"
      />
    )
  }
  return (
    <Target aria-hidden="true" className="text-success h-3.5 w-3.5 shrink-0" />
  )
}

interface GoalChipsProps {
  chips: readonly GoalChipData[]
  /** Accessible name of the list, e.g. "Goals of Fire cape". */
  label: string
  max?: number
}

/**
 * A Tile's goals as small chips: type icon, name and target. Long names are
 * cut with an ellipsis (the full text is in the title), and a long list is
 * folded into "+N more" so one Tile never takes over the screen.
 */
export function GoalChips({
  chips,
  label,
  max = DEFAULT_MAX_CHIPS,
}: GoalChipsProps) {
  if (chips.length === 0) return null
  const shown = chips.slice(0, max)
  const more = chips.length - shown.length

  return (
    <ul aria-label={label} role="list" className="flex flex-wrap gap-1">
      {shown.map((chip) => (
        <li
          key={chip.key}
          title={chip.target ? `${chip.label}: ${chip.target}` : chip.label}
          className={cn(
            "bg-muted/50 text-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs",
            chip.pending && "text-muted-foreground border-dashed"
          )}
        >
          <ChipIcon chip={chip} />
          <span className="min-w-0 truncate">{chip.label}</span>
          {chip.target && (
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {chip.target}
            </span>
          )}
          {chip.pending && (
            <>
              <Loader2
                aria-hidden="true"
                className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none"
              />
              <span className="sr-only">Saving</span>
            </>
          )}
        </li>
      ))}
      {more > 0 && (
        <li className="text-muted-foreground inline-flex items-center px-1 text-xs">
          +{more} more
        </li>
      )}
    </ul>
  )
}
