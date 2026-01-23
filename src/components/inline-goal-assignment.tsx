"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Link,
  Pencil,
  X,
  Hash,
  Save,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Goal {
  id: string
  description: string
  targetValue: number
  goalType?: "generic" | "item"
  itemGoal?: {
    id: string
    goalId: string
    itemId: number
    baseName: string
    exactVariant: string | null
    imageUrl: string
    createdAt: Date
    updatedAt: Date
  } | null
}

interface GoalValue {
  id: string
  value: number
  description: string
}

interface InlineGoalAssignmentProps {
  submissionId: string
  currentGoalId: string | null | undefined
  currentValue: number | null | undefined
  goals: Goal[]
  goalValues?: GoalValue[]
  onAssign: (goalId: string | null, value: number | null) => void
  hasSufficientRights: boolean
  isExpanded?: boolean
  onToggle?: () => void
  className?: string
}

export function InlineGoalAssignment({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  submissionId: _submissionId,
  currentGoalId,
  currentValue,
  goals,
  goalValues = [],
  onAssign,
  hasSufficientRights,
  isExpanded: externalExpanded,
  onToggle,
  className,
}: InlineGoalAssignmentProps) {
  const [isInternalExpanded, setIsInternalExpanded] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    currentGoalId ?? null
  )
  const [submissionValue, setSubmissionValue] = useState<string>(
    currentValue?.toString() ?? "1"
  )
  const [predefinedValue, setPredefinedValue] = useState<string>("")

  // Use external control if provided, otherwise use internal state
  const isExpanded = externalExpanded ?? isInternalExpanded

  // Sync with current goal when it changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional sync with prop changes
    setSelectedGoalId(currentGoalId ?? null)

    setSubmissionValue(currentValue?.toString() ?? "1")
  }, [currentGoalId, currentValue])

  // Reset predefined value when goal changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on goal change
    setPredefinedValue("")
  }, [selectedGoalId])

  const toggleExpanded = () => {
    if (onToggle) {
      onToggle()
    } else {
      setIsInternalExpanded(!isInternalExpanded)
    }

    // Reset form when collapsing
    if (isExpanded) {
      setSelectedGoalId(currentGoalId ?? null)
      setSubmissionValue(currentValue?.toString() ?? "1")
      setPredefinedValue("")
    }
  }

  const handleSave = () => {
    const valueToUse = predefinedValue
      ? parseFloat(predefinedValue)
      : parseFloat(submissionValue)

    if (
      selectedGoalId &&
      (!valueToUse || isNaN(valueToUse) || valueToUse <= 0)
    ) {
      // Don't save if invalid value for a selected goal
      return
    }

    onAssign(selectedGoalId, selectedGoalId ? valueToUse : null)
    toggleExpanded()
  }

  const handleCancel = () => {
    setSelectedGoalId(currentGoalId ?? null)
    setSubmissionValue(currentValue?.toString() ?? "1")
    setPredefinedValue("")
    toggleExpanded()
  }

  const handleRemoveGoal = () => {
    onAssign(null, null)
    setSelectedGoalId(null)
    setSubmissionValue("1")
    setPredefinedValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    } else if (e.key === "Enter" && e.currentTarget.tagName !== "TEXTAREA") {
      e.preventDefault()
      handleSave()
    }
  }

  // Get current goal description
  const currentGoal = goals.find((g) => g.id === (currentGoalId ?? undefined))
  const selectedGoal = goals.find((g) => g.id === (selectedGoalId ?? undefined))

  // State 1: No goal assigned (show assign button)
  if (!currentGoalId && !isExpanded && hasSufficientRights) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          className="h-7 bg-transparent text-xs hover:bg-muted/50"
          onClick={toggleExpanded}
        >
          <Link className="mr-1 h-3.5 w-3.5" />
          Assign Goal
        </Button>
      </div>
    )
  }

  // State 2: Goal assignment form (expanded)
  if (isExpanded && hasSufficientRights) {
    return (
      <div
        className={cn(
          "space-y-3 rounded-lg border border-border bg-muted/30 p-3 transition-all duration-200 ease-out",
          "animate-in fade-in slide-in-from-top-2",
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Goal Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Goal</Label>
          <Select
            value={selectedGoalId ?? "none"}
            onValueChange={(value) =>
              setSelectedGoalId(value === "none" ? null : value)
            }
          >
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder="Select a goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                <div className="flex items-center gap-2">
                  <X className="h-3 w-3" />
                  No Goal
                </div>
              </SelectItem>
              {goals.map((goal) => {
                const isItemGoal = goal.goalType === "item" && goal.itemGoal
                const itemGoal = goal.itemGoal
                return (
                  <SelectItem key={goal.id} value={goal.id} className="text-xs">
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {isItemGoal && itemGoal && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={itemGoal.imageUrl}
                              alt={itemGoal.baseName}
                              className="h-5 w-5 flex-shrink-0 object-contain"
                            />
                          </>
                        )}
                        <span className="truncate font-medium">
                          {goal.description}
                        </span>
                        {isItemGoal && (
                          <Badge
                            variant="secondary"
                            className="h-4 flex-shrink-0 px-1 text-xs"
                          >
                            <Package className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        Target: {goal.targetValue}
                      </span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Value Input (only show if goal is selected) */}
        {selectedGoalId && selectedGoalId !== "none" && (
          <div className="space-y-2">
            {/* Predefined Values */}
            {goalValues.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Predefined Values</Label>
                <Select
                  value={predefinedValue}
                  onValueChange={(value) => {
                    setPredefinedValue(value)
                    setSubmissionValue("") // Clear custom value
                  }}
                >
                  <SelectTrigger className="h-9 bg-background text-xs">
                    <SelectValue placeholder="Select a predefined value..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {goalValues.map((gv) => (
                      <SelectItem
                        key={gv.id}
                        value={gv.value.toString()}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {gv.value}
                          </Badge>
                          <span className="truncate">{gv.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom Value */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">
                  {goalValues.length > 0 ? "Custom Value" : "Value *"}
                </Label>
                {predefinedValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPredefinedValue("")}
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </Button>
                )}
              </div>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={predefinedValue ? "" : submissionValue}
                onChange={(e) => {
                  setSubmissionValue(e.target.value)
                  setPredefinedValue("") // Clear predefined when typing
                }}
                placeholder="Enter value (default: 1)"
                className="h-9 text-xs"
                disabled={!!predefinedValue}
                autoFocus
              />
              {selectedGoal && (
                <p className="text-xs text-muted-foreground">
                  Target: {selectedGoal.targetValue}
                </p>
              )}
            </div>

            {/* Value Preview */}
            {(submissionValue || predefinedValue) && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium text-green-500">
                    Value: {predefinedValue || submissionValue}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              !!(
                selectedGoalId &&
                selectedGoalId !== "none" &&
                !submissionValue &&
                !predefinedValue
              )
            }
            className="h-8 flex-1 text-xs"
          >
            <Save className="mr-1 h-3 w-3" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // State 3: Goal assigned (show badge with edit)
  if (currentGoalId && hasSufficientRights) {
    const isItemGoal = currentGoal?.goalType === "item" && currentGoal?.itemGoal
    const itemGoal = currentGoal?.itemGoal

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="group flex cursor-pointer items-center gap-1 rounded bg-blue-500/20 p-1.5 text-xs transition-colors hover:bg-blue-500/30">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          {isItemGoal && itemGoal && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={itemGoal.imageUrl}
                alt={itemGoal.baseName}
                className="h-5 w-5 shrink-0 object-contain"
              />
            </>
          )}
          <span className="truncate font-medium text-blue-500">
            {currentGoal?.description ?? "Goal"}
          </span>
          {isItemGoal && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">
              <Package className="h-3 w-3" />
            </Badge>
          )}
          {currentValue !== null && currentValue !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">
              <Hash className="mr-0.5 h-3 w-3" />
              {currentValue}
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-70 hover:opacity-100"
          onClick={toggleExpanded}
          title="Edit goal assignment"
        >
          <Pencil className="h-3 w-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500 opacity-70 hover:text-red-600 hover:opacity-100"
          onClick={handleRemoveGoal}
          title="Remove goal assignment"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  // State 4: Goal assigned but user doesn't have rights (read-only)
  if (currentGoalId && !hasSufficientRights) {
    const isItemGoal = currentGoal?.goalType === "item" && currentGoal?.itemGoal
    const itemGoal = currentGoal?.itemGoal

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1 rounded bg-blue-500/20 p-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          {isItemGoal && itemGoal && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={itemGoal.imageUrl}
                alt={itemGoal.baseName}
                className="h-5 w-5 shrink-0 object-contain"
              />
            </>
          )}
          <span className="truncate font-medium text-blue-500">
            {currentGoal?.description ?? "Goal"}
          </span>
          {isItemGoal && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">
              <Package className="h-3 w-3" />
            </Badge>
          )}
          {currentValue !== null && currentValue !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">
              <Hash className="mr-0.5 h-3 w-3" />
              {currentValue}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  // Default: Nothing to show
  return null
}
