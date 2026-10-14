import { Badge } from "@/components/ui/badge"
import type { DraftPlayerInfo, DraftState } from "@/lib/draft/types"
import {
  currentRound,
  onTurnSlot,
  playerLabel,
  totalPickCount,
} from "@/lib/draft/view"
import { cn } from "@/lib/utils"

interface OnTheClockBannerProps {
  state: DraftState
  players: ReadonlyMap<string, DraftPlayerInfo>
  viewerUserId: string
}

/** Who is on the clock, or what state the draft is in. */
export function OnTheClockBanner({
  state,
  players,
  viewerUserId,
}: OnTheClockBannerProps) {
  const slot = onTurnSlot(state)
  const captain = slot?.captainUserId
    ? playerLabel(players.get(slot.captainUserId))
    : null
  const mine =
    slot?.captainUserId === viewerUserId && state.status === "in_progress"

  let heading: string
  let detail: string | null = null
  switch (state.status) {
    case "setup":
    case "open":
      heading = "The draft has not started"
      detail = `${state.slots.length} captains, ${state.rounds} rounds, ${describeOrder(state)}.`
      break
    case "in_progress":
      heading = mine
        ? "You are on the clock"
        : `On the clock: ${slot?.teamName ?? "?"}`
      detail = `Pick ${state.currentPickNo} of ${totalPickCount(state)}, round ${currentRound(state)}${captain && !mine ? `, captain ${captain}` : ""}.`
      break
    case "paused":
      heading = "The draft is paused"
      detail = `Next up: ${slot?.teamName ?? "?"} (pick ${state.currentPickNo}).`
      break
    case "complete":
      heading = state.applied ? "Teams applied" : "The draft is complete"
      detail = state.applied
        ? "The drafted players are on their teams."
        : "The organizer still has to apply the teams."
      break
    case "cancelled":
      heading = "The draft was cancelled"
      break
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-sm border p-3",
        mine ? "border-primary bg-primary/10" : "bg-card"
      )}
    >
      <div>
        <p className="osrs-heading text-lg">{heading}</p>
        {detail && <p className="text-muted-foreground text-sm">{detail}</p>}
      </div>
      <Badge variant={badgeVariant(state.status)}>
        {state.status.replace("_", " ")}
      </Badge>
    </div>
  )
}

function describeOrder(state: DraftState): string {
  switch (state.orderType) {
    case "linear":
      return "linear order"
    case "snake":
      return "snake order"
    case "random_snake":
      return "random snake order"
  }
}

function badgeVariant(status: DraftState["status"]) {
  switch (status) {
    case "in_progress":
      return "success" as const
    case "paused":
      return "warning" as const
    case "complete":
      return "info" as const
    case "cancelled":
      return "destructive" as const
    default:
      return "outline" as const
  }
}
