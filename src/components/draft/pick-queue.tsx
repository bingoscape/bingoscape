import { ArrowDown, ArrowUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { DraftPlayerInfo, DraftPoolState } from "@/lib/draft/types"
import { PlayerName, RatingBadge } from "./player-name"

interface PickQueueProps {
  /** Queued pool entries, best first (available players only). */
  entries: readonly DraftPoolState[]
  players: ReadonlyMap<string, DraftPlayerInfo>
  busy: boolean
  onMove: (poolEntryId: string, by: -1 | 1) => void
  onRemove: (poolEntryId: string) => void
}

/**
 * A captain's private pick queue. When the timer runs out, the first entry
 * that is still available is picked before the draft's auto-pick rule applies.
 * Nobody else sees it.
 */
export function PickQueue({
  entries,
  players,
  busy,
  onMove,
  onRemove,
}: PickQueueProps) {
  return (
    <section aria-label="My pick queue" className="space-y-2">
      <h3 className="osrs-heading">My queue</h3>
      <p className="text-muted-foreground text-xs">
        Private. If your time runs out, the first available player here is
        picked for you. Add players with the queue button in the pool.
      </p>
      {entries.length === 0 ? (
        <p className="text-muted-foreground rounded-sm border border-dashed p-3 text-center text-sm">
          Your queue is empty.
        </p>
      ) : (
        <ol className="divide-y rounded-sm border">
          {entries.map((entry, index) => (
            <li
              key={entry.poolEntryId}
              className="flex items-center justify-between gap-2 p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs">
                  {index + 1}
                </span>
                <PlayerName
                  info={entry.userId ? players.get(entry.userId) : undefined}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <RatingBadge rating={entry.rating} />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move up in queue"
                  disabled={busy || index === 0}
                  onClick={() => onMove(entry.poolEntryId, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move down in queue"
                  disabled={busy || index === entries.length - 1}
                  onClick={() => onMove(entry.poolEntryId, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove from queue"
                  disabled={busy}
                  onClick={() => onRemove(entry.poolEntryId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
