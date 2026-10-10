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
import { cn } from "@/lib/utils"

export function EventTimeDisplay({
  date,
  label,
  eventTz,
  className,
}: {
  date: Date
  label: string
  eventTz: string
  className?: string
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
      <div className={cn("flex items-center gap-2", className ?? "mb-1.5 last:mb-0")}>
        <span className="min-w-[36px] text-muted-foreground">{label}:</span>
        <span className="font-medium text-foreground">{formattedTime}</span>
        <Badge
          variant="secondary"
          className="h-4 px-1.5 py-0 text-[10px] uppercase tracking-wider"
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
    <div className={cn("flex items-center gap-2", className ?? "mb-1.5 last:mb-0")}>
      <span className="min-w-[36px] text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{localFormatted}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="osrs-slot flex cursor-help items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Clock aria-hidden="true" className="h-3 w-3" />
              <span>Your time</span>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="flex flex-col gap-1.5 p-3"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Official Event Time
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {officialFormatted}
              </span>
              <Badge
                variant="secondary"
                className="h-4 px-1.5 py-0 text-[10px] uppercase tracking-wider"
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
