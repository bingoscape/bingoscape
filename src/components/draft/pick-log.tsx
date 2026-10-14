import { Badge } from "@/components/ui/badge"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import { playerLabel } from "@/lib/draft/view"

interface PickLogProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
}

/** Every pick so far, newest first. */
export function PickLog({ state, players }: PickLogProps) {
  // The live region stays mounted, so the first pick is announced as well as
  // the later ones.
  return (
    <div aria-live="polite" aria-relevant="additions text">
      <PickLogList state={state} players={players} />
    </div>
  )
}

function PickLogList({ state, players }: PickLogProps) {
  const slots = new Map(state.slots.map((s) => [s.slotId, s]))
  const picks = [...state.picks].reverse()

  if (picks.length === 0) {
    return (
      <p className="text-muted-foreground rounded-sm border border-dashed p-6 text-center text-sm">
        No picks yet.
      </p>
    )
  }

  return (
    <ol aria-label="Pick log" className="divide-y rounded-sm border">
      {picks.map((pick) => (
        <li key={pick.pickNo} className="flex items-center gap-2 p-2 text-sm">
          <span className="text-muted-foreground w-8 shrink-0 text-right text-xs">
            #{pick.pickNo}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <strong>{slots.get(pick.slotId)?.teamName ?? "?"}</strong> picked{" "}
            {playerLabel(pick.userId ? players.get(pick.userId) : undefined)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            round {pick.round}
          </span>
          {pick.auto && <Badge variant="outline">auto</Badge>}
          {pick.forced && <Badge variant="outline">forced</Badge>}
        </li>
      ))}
    </ol>
  )
}
