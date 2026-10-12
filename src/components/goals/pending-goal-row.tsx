"use client"

import { Check, Loader2 } from "lucide-react"
import { GoalRowContent } from "./goal-row-content"
import { describePendingGoal, type PendingGoal } from "./use-pending-goals"

interface PendingGoalRowProps {
  pending: PendingGoal
  /** Whether the real rows have a drag handle, so this one lines up with them. */
  hasHandleSpace: boolean
}

/**
 * A Goal that was just added and is not in the tree yet. Muted and without
 * handle, edit or delete: it cannot be dragged or changed until it is real.
 */
export function PendingGoalRow({
  pending,
  hasHandleSpace,
}: PendingGoalRowProps) {
  const { description, targetValue, item, metric } =
    describePendingGoal(pending)
  const saving = pending.status === "saving"

  return (
    <div
      data-pending-goal=""
      aria-busy={saving}
      className="flex items-center gap-2"
    >
      {hasHandleSpace && (
        <span aria-hidden="true" className="w-6 shrink-0 pointer-coarse:w-11" />
      )}
      <div className="border-muted-foreground/30 bg-muted/30 my-0.5 flex flex-1 items-start justify-between gap-2 rounded-sm border border-dashed px-2 py-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <GoalRowContent
            description={description}
            targetValue={targetValue}
            item={item}
            metric={metric}
            muted
          />
        </div>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1 py-0.5 text-xs">
          {saving ? (
            <>
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              />
              Saving...
            </>
          ) : (
            <>
              <Check aria-hidden="true" className="text-success h-3.5 w-3.5" />
              Saved
            </>
          )}
        </span>
      </div>
    </div>
  )
}
