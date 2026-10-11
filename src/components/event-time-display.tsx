"use client"

import * as React from "react"

const emptySubscribe = () => () => {}
import { formatInTimeZone } from "date-fns-tz"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1",
          className ?? "mb-1.5 last:mb-0"
        )}
      >
        <span className="min-w-[36px] text-muted-foreground">{label}:</span>
        <span className="font-medium text-foreground">{formattedTime}</span>
        <Badge
          variant="secondary"
          className="h-5 px-1.5 py-0 text-xs uppercase tracking-wider"
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
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1",
        className ?? "mb-1.5 last:mb-0"
      )}
    >
      <span className="min-w-[36px] text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{localFormatted}</span>
      {/* Popover (not Tooltip) so the official time is reachable by tap and keyboard. */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Your local time. Show official event time for ${label}`}
            className="osrs-slot relative z-10 flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            <Clock aria-hidden="true" className="h-3 w-3" />
            <span>Your time</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          collisionPadding={8}
          className="flex w-auto max-w-[calc(100vw-1rem)] flex-col gap-1.5 p-3"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Official Event Time
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {officialFormatted}
            </span>
            <Badge
              variant="secondary"
              className="h-5 px-1.5 py-0 text-xs uppercase tracking-wider"
            >
              {eventTzName}
            </Badge>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
