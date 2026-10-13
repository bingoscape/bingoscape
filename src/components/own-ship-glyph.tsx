import { cn } from "@/lib/utils"

interface OwnShipGlyphProps {
  className?: string
}

/**
 * The hull frame used on the Board for the viewer's own ships, as a small
 * decorative glyph for the legend and the Tile panel. It is a frame (not a
 * filled mark), so it never reads as a hit, miss or sunk marker.
 */
export function OwnShipGlyph({ className }: OwnShipGlyphProps) {
  return (
    <span
      aria-hidden="true"
      data-own-ship-glyph=""
      className={cn(
        "border-info bg-info/15 inline-block size-4 shrink-0 rounded-sm border-2 shadow-[inset_0_0_0_1px_#000]",
        className
      )}
    />
  )
}
