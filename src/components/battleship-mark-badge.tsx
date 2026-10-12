import { Ship, X } from "lucide-react"
import { MARK_LABEL, type BattleshipMark } from "@/lib/battleship-marks"
import { cn } from "@/lib/utils"

interface BattleshipMarkBadgeProps {
  mark: BattleshipMark
  /** Size and position; the tile marker sizes itself from the slot. */
  className?: string
  /** Give the glyph its own text alternative (the tile marker). */
  labelled?: boolean
}

const TONE: Record<BattleshipMark, string> = {
  hit: "bg-danger text-destructive-foreground",
  miss: "bg-secondary text-muted-foreground",
  sunk: "bg-destructive text-destructive-foreground ring-1 ring-osrs-yellow",
}

/**
 * The one glyph for a battleship result, used on the Tile, in the legend and in
 * the Tile panel so they can never drift apart. The shapes differ (solid X,
 * hollow dot, ship), so the result never depends on colour alone.
 */
export function BattleshipMarkBadge({
  mark,
  className,
  labelled = false,
}: BattleshipMarkBadgeProps) {
  return (
    <span
      data-mark={mark}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? MARK_LABEL[mark] : undefined}
      title={labelled ? MARK_LABEL[mark] : undefined}
      className={cn("osrs-mark", TONE[mark], className)}
    >
      {mark === "hit" && (
        <X className="size-[80%]" strokeWidth={4} aria-hidden="true" />
      )}
      {mark === "miss" && (
        <span
          aria-hidden="true"
          className="size-[45%] rounded-full border-2 border-current"
        />
      )}
      {mark === "sunk" && <Ship className="size-[75%]" aria-hidden="true" />}
    </span>
  )
}
