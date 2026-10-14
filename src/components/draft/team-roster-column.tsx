import { Crown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type {
  DraftPlayerInfo,
  DraftSlotState,
  DraftState,
} from "@/lib/draft/types"
import { rosterOf } from "@/lib/draft/view"
import { cn } from "@/lib/utils"
import { PlayerName, RatingBadge } from "./player-name"

interface TeamRosterColumnProps {
  state: DraftState
  slot: DraftSlotState
  players: ReadonlyMap<string, DraftPlayerInfo>
  onTheClock: boolean
}

/** One team: its captain, the players picked so far and the places left. */
export function TeamRosterColumn({
  state,
  slot,
  players,
  onTheClock,
}: TeamRosterColumnProps) {
  const roster = rosterOf(state, slot)
  const open = Math.max(0, slot.maxTeamSize - roster.length)

  return (
    <section
      aria-label={`Team ${slot.teamName}`}
      className={cn(
        "bg-card rounded-sm border",
        onTheClock && "border-primary ring-primary ring-1"
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b p-2">
        <h3 className="osrs-heading truncate">{slot.teamName}</h3>
        {onTheClock && <Badge variant="success">On the clock</Badge>}
      </header>
      <ol className="divide-y">
        {roster.map((entry) => (
          <li
            key={entry.pickNo ?? "captain"}
            className="flex items-center justify-between gap-2 p-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              {entry.captain ? (
                <Crown
                  aria-label="Captain"
                  className="text-primary h-4 w-4 shrink-0"
                />
              ) : (
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs">
                  {entry.pickNo}
                </span>
              )}
              <PlayerName
                info={entry.userId ? players.get(entry.userId) : undefined}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {entry.auto && <Badge variant="outline">auto</Badge>}
              {entry.forced && <Badge variant="outline">forced</Badge>}
              {!entry.captain && <RatingBadge rating={entry.rating} />}
            </div>
          </li>
        ))}
        {Array.from({ length: open }, (_, i) => (
          <li
            key={`open-${i}`}
            aria-hidden="true"
            className="text-muted-foreground p-2 text-xs"
          >
            open
          </li>
        ))}
      </ol>
    </section>
  )
}
