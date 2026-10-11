import { CalendarClock, Flag } from "lucide-react"

import { cn } from "@/lib/utils"
import type { EventState } from "@/lib/event-time"

interface EventStatusChipProps {
  id?: string
  state: EventState
  label: string
}

/** State is carried by icon + words, never by colour alone. */
export function EventStatusChip({ id, state, label }: EventStatusChipProps) {
  return (
    <span
      id={id}
      className={cn(
        "osrs-slot inline-flex min-h-7 items-center gap-1.5 rounded-sm px-2 font-display text-sm osrs-text-shadow",
        state === "active" && "text-success",
        state === "upcoming" && "text-pending",
        state === "past" && "text-muted-foreground"
      )}
    >
      {state === "active" && (
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-success motion-safe:animate-pulse"
        />
      )}
      {state === "upcoming" && (
        <CalendarClock aria-hidden="true" className="size-4" />
      )}
      {state === "past" && <Flag aria-hidden="true" className="size-4" />}
      {label}
    </span>
  )
}
