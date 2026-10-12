"use client"

import { TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface WomLinkNoticeProps {
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
  /** Tighter padding, for the inline quick-add bar. */
  compact?: boolean
}

/**
 * Non-blocking warning shown while the Board has no Wise Old Man competition:
 * XP and kill Goals can still be created but their progress will not sync.
 */
export function WomLinkNotice({
  onOpenTrackerSettings,
  compact = false,
}: WomLinkNoticeProps) {
  return (
    <div
      role="note"
      className={cn(
        "border-warning/50 bg-warning/10 text-foreground flex items-start gap-2 rounded-md border text-xs",
        compact ? "p-2" : "p-3"
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        className="text-warning mt-px h-4 w-4 shrink-0"
      />
      <p>
        XP and kill progress won&apos;t sync until a Wise Old Man competition is
        linked.{" "}
        {onOpenTrackerSettings && (
          <button
            type="button"
            onClick={onOpenTrackerSettings}
            className="focus-visible:ring-ring text-primary rounded-xs font-medium underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            Open tracker settings
          </button>
        )}
      </p>
    </div>
  )
}
