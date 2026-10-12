"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Goal } from "@/types/model"

interface GenericGoalFormProps {
  newGoal: Partial<Goal>
  onNewGoalChange: (field: string, value: unknown) => void
}

export function GenericGoalForm({
  newGoal,
  onNewGoalChange,
}: GenericGoalFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goalDescription" className="text-sm font-medium">
          Description
        </Label>
        <Input
          id="goalDescription"
          value={newGoal.description || ""}
          onChange={(e) => onNewGoalChange("description", e.target.value)}
          placeholder="Complete the task..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetValue" className="text-sm font-medium">
          Target Value
        </Label>
        <Input
          id="targetValue"
          type="number"
          value={newGoal.targetValue ?? 1}
          onChange={(e) =>
            onNewGoalChange("targetValue", Number.parseInt(e.target.value))
          }
        />
        <div className="mt-2 rounded-md bg-muted/50 p-3 border text-xs text-muted-foreground">
          <strong>Note:</strong> In a SUM group, this target is illustrative and does not cap contributions.
        </div>
      </div>
    </div>
  )
}
