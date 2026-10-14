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
  /** A pick this viewer just made that the server has not confirmed yet. */
  ghost?: { userId: string | null; rating: number | null }
  /** Pick numbers that just arrived: highlighted for a moment. */
  freshPicks?: ReadonlySet<number>
}

/** One team: its captain, the players picked so far and the places left. */
export function TeamRosterColumn({
  state,
  slot,
  players,
  onTheClock,
  ghost,
  freshPicks,
}: TeamRosterColumnProps) {
  const roster = rosterOf(state, slot)
  const open = Math.max(0, slot.maxTeamSize - roster.length - (ghost ? 1 : 0))

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
            data-fresh={
              entry.pickNo !== null && freshPicks?.has(entry.pickNo)
                ? "true"
                : undefined
            }
            className={cn(
              "flex items-center justify-between gap-2 p-2",
              // The pick slides in; with reduced motion it just appears and
              // keeps the same highlight.
              entry.pickNo !== null &&
                freshPicks?.has(entry.pickNo) &&
                "bg-primary/20 animate-in fade-in slide-in-from-left-4 motion-reduce:animate-none"
            )}
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
        {ghost && (
          <li
            aria-busy="true"
            className="bg-primary/10 flex items-center justify-between gap-2 border-l-2 border-dashed p-2"
          >
            <PlayerName
              info={ghost.userId ? players.get(ghost.userId) : undefined}
            />
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="outline">Picking…</Badge>
              <RatingBadge rating={ghost.rating} />
            </div>
          </li>
        )}
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
