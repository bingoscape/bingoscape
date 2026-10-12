"use client"

import { Check } from "lucide-react"

export interface AddedGoalEntry {
  id: number
  text: string
}

interface AddedGoalsListProps {
  /** Most recent first. */
  entries: AddedGoalEntry[]
}

/**
 * Inline confirmation of the goals added since the drawer opened. The live
 * region is always rendered so screen readers announce new entries.
 */
export function AddedGoalsList({ entries }: AddedGoalsListProps) {
  return (
    <div role="status" aria-live="polite" aria-label="Added goals">
      {entries.length > 0 && (
        <div className="border-success/40 bg-success/10 rounded-lg border p-3">
          <p className="text-foreground text-xs font-semibold">Added</p>
          <ul className="mt-1 space-y-1">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="text-foreground flex items-start gap-2 text-sm"
              >
                <Check
                  aria-hidden="true"
                  className="text-success mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="min-w-0 wrap-anywhere">{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
