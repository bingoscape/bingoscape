import { Crown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { rosterOf } from "@/lib/draft/view"
import { PlayerName, RatingBadge } from "../player-name"

interface FinalRostersProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
  viewerUserId?: string
}

/** The teams as the draft left them: captain first, then the picks in order. */
export function FinalRosters({
  state,
  players,
  viewerUserId,
}: FinalRostersProps) {
  return (
    <section aria-label="Final rosters" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="osrs-heading text-lg">Final rosters</h2>
        {state.applied ? (
          <Badge variant="success">Applied</Badge>
        ) : (
          <Badge variant="warning">Not applied yet</Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.slots.map((slot) => {
          const roster = rosterOf(state, slot)
          return (
            <section
              key={slot.slotId}
              aria-label={`Team ${slot.teamName}`}
              className="bg-card rounded-sm border"
            >
              <header className="border-b p-2">
                <h3 className="osrs-heading truncate">{slot.teamName}</h3>
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
                        info={
                          entry.userId ? players.get(entry.userId) : undefined
                        }
                        isYou={
                          entry.userId !== null && entry.userId === viewerUserId
                        }
                      />
                    </div>
                    {!entry.captain && <RatingBadge rating={entry.rating} />}
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </section>
  )
}
