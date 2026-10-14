"use client"

import { Clock, RefreshCw, Wifi } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DraftConnection } from "@/hooks/use-draft-stream"
import { cn } from "@/lib/utils"

const STATES: Record<
  DraftConnection,
  { label: string; tip: string; dot: string; Icon: typeof Wifi; spin?: boolean }
> = {
  connecting: {
    label: "Connecting",
    tip: "Connecting to live updates.",
    dot: "bg-muted-foreground",
    Icon: RefreshCw,
    spin: true,
  },
  live: {
    label: "Live",
    tip: "Live: picks appear as soon as they are made.",
    dot: "bg-green-600",
    Icon: Wifi,
  },
  reconnecting: {
    label: "Reconnecting",
    tip: "The live connection dropped and is being restored. The page still checks for changes every few seconds.",
    dot: "bg-amber-500",
    Icon: RefreshCw,
    spin: true,
  },
  polling: {
    label: "Polling",
    tip: "Live updates are not available here. The page checks for changes every few seconds and keeps trying to go live.",
    dot: "bg-muted-foreground",
    Icon: Clock,
  },
}

interface ConnectionIndicatorProps {
  connection: DraftConnection
  className?: string
}

/**
 * Whether the draft room is live: green "Live", amber "Reconnecting", grey
 * "Polling" (and "Connecting" at first). The state is the word and the icon as
 * well as the colour, and a tooltip explains it.
 */
export function ConnectionIndicator({
  connection,
  className,
}: ConnectionIndicatorProps) {
  const { label, tip, dot, Icon, spin } = STATES[connection]
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Connection: ${label}. ${tip}`}
            data-connection={connection}
            className={cn(
              "text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-hidden",
              className
            )}
          >
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 shrink-0 rounded-full", dot)}
            />
            <Icon
              aria-hidden="true"
              className={cn("h-3 w-3", spin && "motion-safe:animate-spin")}
            />
            <span>{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
