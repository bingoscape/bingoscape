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
  eventTz 
}: { 
  date: Date, 
  label: string, 
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
    const formattedTime = formatInTimeZone(date, eventTz, "MMM d, yyyy • h:mm a")
    const tzName = eventTz.split('/').pop()?.replace(/_/g, ' ') || eventTz
    return (
      <div className="flex items-center gap-2 mb-1.5 last:mb-0">
        <span className="text-muted-foreground min-w-[36px]">{label}:</span>
        <span className="font-medium text-foreground">{formattedTime}</span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 uppercase tracking-wider bg-secondary/50 text-secondary-foreground/70 border-none">
          {tzName}
        </Badge>
      </div>
    )
  }

  const localFormatted = formatInTimeZone(date, effectiveLocalTz, "MMM d, yyyy • h:mm a")
  const officialFormatted = formatInTimeZone(date, eventTz, "MMM d, yyyy • h:mm a")
  const eventTzName = eventTz.split('/').pop()?.replace(/_/g, ' ') || eventTz
  
  return (
    <div className="flex items-center gap-2 mb-1.5 last:mb-0">
      <span className="text-muted-foreground min-w-[36px]">{label}:</span>
      <span className="font-medium text-foreground">{localFormatted}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border/50">
              <Clock className="h-3 w-3" />
              <span>Your time</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex flex-col gap-1.5 p-3 shadow-xl border-border/50 bg-background/95 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Official Event Time</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{officialFormatted}</span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 uppercase tracking-wider border-none bg-primary/10 text-primary">
                {eventTzName}
              </Badge>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
