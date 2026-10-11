"use client"

import * as React from "react"
import { formatInTimeZone } from "date-fns-tz"
import { Clock } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDateRange } from "@/lib/event-time"

const emptySubscribe = () => () => {}
const FULL = "MMM d, yyyy • h:mm a"

interface EventWhenProps {
  id?: string
  start: Date
  end: Date
  eventTz: string
  clanName?: string | null
  now: Date
}

function tzName(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz
}

/**
 * One muted line: "Oct 11 – Oct 18 · Clan". Dates render in the viewer's time
 * zone; when it differs from the event's, a 44px button (not a hover tooltip)
 * reveals the official start/end.
 */
export function EventWhen({
  id,
  start,
  end,
  eventTz,
  clanName,
  now,
}: EventWhenProps) {
  const localTz = React.useSyncExternalStore(
    emptySubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null
  )
  const tz = localTz ?? eventTz
  const differs = tz !== eventTz

  return (
    <p
      id={id}
      className="flex min-w-0 items-center gap-x-1.5 text-sm text-muted-foreground"
    >
      <span className="min-w-0 truncate">
        {formatDateRange(start, end, tz, now)}
        {clanName ? ` · ${clanName}` : ""}
      </span>
      {differs && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Show start and end times"
              className="relative z-10 -my-2.5 flex size-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Clock aria-hidden="true" className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            collisionPadding={8}
            className="w-auto max-w-[calc(100vw-1rem)] space-y-2 p-3 text-sm"
          >
            {(
              [
                ["Start", start],
                ["End", end],
              ] as const
            ).map(([label, date]) => (
              <div key={label}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p>
                  <time dateTime={date.toISOString()}>
                    {formatInTimeZone(date, tz, FULL)}
                  </time>{" "}
                  <span className="text-muted-foreground">(your time)</span>
                </p>
                <p className="text-muted-foreground">
                  {formatInTimeZone(date, eventTz, FULL)} ({tzName(eventTz)})
                </p>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </p>
  )
}
