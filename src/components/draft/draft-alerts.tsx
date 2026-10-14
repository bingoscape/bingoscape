import { TriangleAlert } from "lucide-react"

import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { awaySlots, draftedWhoLeft, playerLabel } from "@/lib/draft/view"

interface DraftAlertsProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
}

/**
 * Things only the manager can fix: a captain who keeps letting the timer run
 * out, and drafted players who left the Event. Renders nothing when all is
 * well.
 */
export function DraftAlerts({ state, players }: DraftAlertsProps) {
  const running = state.status === "in_progress" || state.status === "paused"
  const away = running ? awaySlots(state) : []
  const left = draftedWhoLeft(state)
  if (away.length === 0 && left.length === 0) return null

  const teamOf = (poolEntryId: string) => {
    const pick = state.picks.find((p) => p.poolEntryId === poolEntryId)
    return state.slots.find((s) => s.slotId === pick?.slotId)?.teamName
  }

  return (
    <div role="status" className="space-y-2">
      {away.map((slot) => (
        <p
          key={slot.slotId}
          className="flex items-start gap-2 rounded-sm border border-amber-500/60 bg-amber-500/10 p-3 text-sm"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <strong>
              {slot.captainUserId
                ? playerLabel(players.get(slot.captainUserId))
                : slot.teamName}
            </strong>{" "}
            ({slot.teamName}) let the timer run out {slot.consecutiveTimeouts}{" "}
            turns in a row. You can pause the draft, pick for them or skip their
            turn.
          </span>
        </p>
      ))}
      {left.map((entry) => (
        <p
          key={entry.poolEntryId}
          className="flex items-start gap-2 rounded-sm border border-amber-500/60 bg-amber-500/10 p-3 text-sm"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <strong>
              {playerLabel(
                entry.userId ? players.get(entry.userId) : undefined
              )}
            </strong>{" "}
            left the event after {teamOf(entry.poolEntryId) ?? "a team"} drafted
            them. Replace or release them: applying the teams skips players who
            are no longer in the event.
          </span>
        </p>
      ))}
    </div>
  )
}
