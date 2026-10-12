import { cn } from "@/lib/utils"

interface ShipVisualProps {
  length: number
  className?: string
}

/**
 * A ship as a bar of joined segments, each carrying the ship length. This is
 * the same look as a placed ship on the placement board, so it works without
 * colour: the numeral and the shape say what it is. Purely decorative, the
 * text next to it names the ship.
 */
export function ShipVisual({ length, className }: ShipVisualProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("inline-flex items-center", className)}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          className="border-info bg-info text-info-foreground font-display flex h-6 w-7 items-center justify-center border-y-2 text-xs leading-none first:rounded-l-sm first:border-l-2 last:rounded-r-sm last:border-r-2 [&:not(:last-child)]:border-r-0"
        >
          {length}
        </span>
      ))}
    </div>
  )
}
