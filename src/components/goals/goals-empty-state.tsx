"use client"

import { Target } from "lucide-react"

interface GoalsEmptyStateProps {
  /** Whether the user can add Goals; read-only users get a neutral message. */
  canManage: boolean
}

/** Shown in place of the Goal list while the Tile has no Goals. */
export function GoalsEmptyState({ canManage }: GoalsEmptyStateProps) {
  return (
    <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
      <Target
        aria-hidden="true"
        className="text-primary mt-0.5 h-5 w-5 shrink-0"
      />
      <p>
        {canManage
          ? "No goals yet — add the first goal to decide when this tile counts as complete."
          : "This tile has no goals yet."}
      </p>
    </div>
  )
}
