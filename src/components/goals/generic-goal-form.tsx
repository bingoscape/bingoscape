"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberField } from "./number-field"

interface GenericGoalFormProps {
  description: string
  onDescriptionChange: (description: string) => void
  /** Raw text of the target field. */
  targetValue: string
  onTargetValueChange: (raw: string) => void
  /** Focus the first field on mount. */
  autoFocus?: boolean
}

export function GenericGoalForm({
  description,
  onDescriptionChange,
  targetValue,
  onTargetValueChange,
  autoFocus = true,
}: GenericGoalFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="goalDescription" className="text-sm font-medium">
          Description
        </Label>
        <Input
          id="goalDescription"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Complete the task..."
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>
      <NumberField
        id="targetValue"
        label="Target"
        value={targetValue}
        onValueChange={onTargetValueChange}
        placeholder="1"
        hint="How many times this must be done. In a SUM group, this target is illustrative and does not cap contributions."
      />
    </div>
  )
}
