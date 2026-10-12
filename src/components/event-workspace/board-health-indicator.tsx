"use client"

import { useMemo, useState } from "react"
import { CircleDashed } from "lucide-react"
import {
  findNextTileWithoutGoals,
  formatTilesWithoutGoals,
  getTilesWithoutGoals,
} from "@/lib/board-health"
import type { Tile } from "@/types/model"

interface BoardHealthIndicatorProps {
  tiles: Tile[]
  selectedTileId: string | null
  onSelectTile: (tileId: string) => void
}

/**
 * "3 tiles have no goals": a calm hint for organisers, not a warning (a Tile
 * can be completed by hand). Pressing it selects the next Tile without Goals,
 * wrapping around the Board, and says which one it picked.
 *
 * Focus stays on the button on purpose: pressing it again walks on to the
 * next Tile, and the polite live region reports each stop. The live region is
 * rendered even when there is nothing to report, so it is already in the page
 * when the first message arrives.
 */
export function BoardHealthIndicator({
  tiles,
  selectedTileId,
  onSelectTile,
}: BoardHealthIndicatorProps) {
  const count = useMemo(() => getTilesWithoutGoals(tiles).length, [tiles])
  // The key makes a repeated message (same Tile twice) speak again.
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" })
  // Where the last jump landed. Closing the Tile panel (always the case on
  // phones, where the panel is a drawer) clears the selection, and without
  // this the next press would start over at the first Tile.
  const [lastJumpId, setLastJumpId] = useState<string | null>(null)

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ id: previous.id + 1, text }))

  const jump = () => {
    const from = selectedTileId ?? lastJumpId
    const next = findNextTileWithoutGoals(tiles, from)
    if (!next) return
    if (next.tile.id === selectedTileId) {
      announce(`${next.tile.title} is the only tile without goals.`)
      return
    }
    setLastJumpId(next.tile.id)
    onSelectTile(next.tile.id)
    announce(
      `Selected ${next.tile.title}, tile ${next.position} of ${next.total} without goals${next.wrapped ? ", back at the start of the board" : ""}.`
    )
  }

  return (
    <>
      {count > 0 && (
        <button
          type="button"
          onClick={jump}
          // Spelled out, rather than built from hidden text, so the name has no
          // stray spacing; it starts with the visible text.
          aria-label={`${formatTilesWithoutGoals(count)}. Select the next one.`}
          className="border-border text-muted-foreground hover:border-primary hover:text-foreground focus-visible:ring-ring inline-flex min-h-6 items-center gap-1.5 rounded-sm border border-dashed px-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11"
        >
          <CircleDashed aria-hidden="true" className="text-info h-3.5 w-3.5" />
          {formatTilesWithoutGoals(count)}
        </button>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
    </>
  )
}
