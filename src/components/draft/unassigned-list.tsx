import { Badge } from "@/components/ui/badge"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { unassignedPlayers } from "@/lib/draft/view"
import { PlayerName } from "./player-name"

interface UnassignedListProps {
  state: DraftState
  lateJoiners: readonly string[]
  players: ReadonlyMap<string, DraftPlayerInfo>
}

/**
 * Participants no team will get: players nobody picked once the draft is
 * complete, and people who joined after the start (the pool is frozen then).
 * The manager places them by hand.
 */
export function UnassignedList({
  state,
  lateJoiners,
  players,
}: UnassignedListProps) {
  if (state.status === "setup" || state.status === "open") return null
  const list = unassignedPlayers(state, lateJoiners)
  if (list.length === 0) return null

  return (
    <section aria-label="Unassigned players" className="space-y-2">
      <h3 className="osrs-heading">Unassigned</h3>
      <ul className="divide-y rounded-sm border">
        {list.map((entry) => (
          <li
            key={`${entry.kind}:${entry.userId}`}
            className="flex items-center justify-between gap-2 p-2"
          >
            <PlayerName info={players.get(entry.userId)} />
            <Badge variant="outline">
              {entry.kind === "late_joiner" ? "Joined late" : "Not picked"}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}
