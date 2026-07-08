"use client"

import * as React from "react"

const emptySubscribe = () => () => {}
import { formatInTimeZone } from "date-fns-tz"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function EventTimeDisplay({
  date,
  label,
  eventTz,
}: {
  date: Date
  label: string
  eventTz: string
}) {
  const localTz = React.useSyncExternalStore(
    emptySubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null
  )

  const effectiveLocalTz = localTz || eventTz // Fallback to eventTz during SSR
  const isDifferent = eventTz !== effectiveLocalTz

  if (!isDifferent) {
    const formattedTime = formatInTimeZone(
      date,
      eventTz,
      "MMM d, yyyy • h:mm a"
    )
    const tzName = eventTz.split("/").pop()?.replace(/_/g, " ") || eventTz
    return (
      <div className="mb-1.5 flex items-center gap-2 last:mb-0">
        <span className="min-w-[36px] text-muted-foreground">{label}:</span>
        <span className="font-medium text-foreground">{formattedTime}</span>
        <Badge
          variant="secondary"
          className="h-4 border-none bg-secondary/50 px-1.5 py-0 text-[9px] uppercase tracking-wider text-secondary-foreground/70"
        >
          {tzName}
        </Badge>
      </div>
    )
  }

  const localFormatted = formatInTimeZone(
    date,
    effectiveLocalTz,
    "MMM d, yyyy • h:mm a"
  )
  const officialFormatted = formatInTimeZone(
    date,
    eventTz,
    "MMM d, yyyy • h:mm a"
  )
  const eventTzName = eventTz.split("/").pop()?.replace(/_/g, " ") || eventTz

  return (
    <div className="mb-1.5 flex items-center gap-2 last:mb-0">
      <span className="min-w-[36px] text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{localFormatted}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-help items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Clock className="h-3 w-3" />
              <span>Your time</span>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="flex flex-col gap-1.5 border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Official Event Time
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {officialFormatted}
              </span>
              <Badge
                variant="secondary"
                className="h-4 border-none bg-primary/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-primary"
              >
                {eventTzName}
              </Badge>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
