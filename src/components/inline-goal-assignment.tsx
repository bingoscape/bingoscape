"use client"

import Image from "next/image"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  CheckCircle2,
  Pencil,
  X,
  Hash,
  Save,
  Package,
  Loader2,
  Plus,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Goal {
  id: string
  description: string
  targetValue: number
  goalType?: "generic" | "item" | "metric"
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
  onAssign: (goalId: string | null, value: number | null) => Promise<void> | void
  hasSufficientRights: boolean
  isExpanded?: boolean // kept for backwards compatibility but unused
  onToggle?: () => void // kept for backwards compatibility but unused
  className?: string
}

export function InlineGoalAssignment({
  submissionId: _submissionId,
  currentGoalId,
  currentValue,
  goals,
  goalValues = [],
  onAssign,
  hasSufficientRights,
  className,
}: InlineGoalAssignmentProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"goal" | "value">("goal")
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    currentGoalId ?? null
  )
  const [submissionValue, setSubmissionValue] = useState<string>(
    currentValue?.toString() ?? "1"
  )
  const [predefinedValue, setPredefinedValue] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  // Sync with current goal when it changes
  useEffect(() => {
    setSelectedGoalId(currentGoalId ?? null)
    setSubmissionValue(currentValue?.toString() ?? "1")

    // When closed, reset the popover state
    if (!open) {
      setStep("goal")
      setPredefinedValue("")
    }
  }, [currentGoalId, currentValue, open])

  const handleSave = async (overrideGoalId?: string | null, overrideValue?: number) => {
    const goalToSave = overrideGoalId !== undefined ? overrideGoalId : selectedGoalId
    let valueToSave: number | null = null

    if (goalToSave) {
      if (overrideValue !== undefined) {
        valueToSave = overrideValue
      } else {
        valueToSave = predefinedValue ? parseFloat(predefinedValue) : parseFloat(submissionValue)
      }

      if (!valueToSave || isNaN(valueToSave) || valueToSave <= 0) {
        return // Invalid value
      }
    }

    try {
      setIsSaving(true)
      await onAssign(goalToSave, valueToSave)
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveGoal = async () => {
    try {
      setIsSaving(true)
      await onAssign(null, null)
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const currentGoal = goals.find((g) => g.id === (currentGoalId ?? undefined))
  const selectedGoal = goals.find((g) => g.id === (selectedGoalId ?? undefined))

  const renderPopoverContent = () => {
    if (step === "goal") {
      return (
        <Command>
          <CommandInput placeholder="Search goals..." className="h-9 text-xs" />
          <CommandList className="max-h-[250px]">
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
              No goals found.
            </CommandEmpty>
            <CommandGroup>
              {goals.map((goal) => {
                const isItemGoal = goal.goalType === "item" && goal.itemGoal
                const itemGoal = goal.itemGoal
                return (
                  <CommandItem
                    key={goal.id}
                    value={goal.description}
                    onSelect={() => {
                      setSelectedGoalId(goal.id)
                      setStep("value")
                    }}
                    className="flex cursor-pointer items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {isItemGoal && itemGoal && (
                        <div className="relative h-5 w-5 shrink-0">
                          <Image
                            fill
                            src={itemGoal.imageUrl}
                            alt={itemGoal.baseName}
                            className="object-cover"
                          />
                        </div>
                      )}
                      <span className="truncate font-medium">
                        {goal.description}
                      </span>
                      {isItemGoal && (
                        <Badge
                          variant="secondary"
                          className="h-4 shrink-0 px-1 text-[10px]"
                        >
                          <Package className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      Target: {goal.targetValue}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      )
    }

    // Value Step
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setStep("goal")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedGoal?.goalType === "item" && selectedGoal.itemGoal && (
              <div className="relative h-5 w-5 shrink-0">
                <Image
                  fill
                  src={selectedGoal.itemGoal.imageUrl}
                  alt={selectedGoal.itemGoal.baseName}
                  className="object-cover"
                />
              </div>
            )}
            <span className="truncate text-xs font-medium">
              {selectedGoal?.description}
            </span>
          </div>
        </div>

        {/* Predefined Values */}
        {goalValues.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Quick Select
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {goalValues.map((gv) => (
                <Button
                  key={gv.id}
                  variant={predefinedValue === gv.value.toString() ? "default" : "secondary"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setPredefinedValue(gv.value.toString())
                    setSubmissionValue("")
                  }}
                >
                  {gv.description}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              {goalValues.length > 0 ? "Or enter custom value" : "Value"}
            </Label>
            {predefinedValue && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPredefinedValue("")}
                className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
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
              setPredefinedValue("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
            }}
            placeholder="Enter value (default: 1)"
            className="h-8 text-xs"
            disabled={!!predefinedValue}
            autoFocus
          />
        </div>

        <Button
          size="sm"
          onClick={() => handleSave()}
          disabled={isSaving || (!submissionValue && !predefinedValue)}
          className="h-8 w-full text-xs"
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-1 h-3 w-3" />
          )}
          Assign Goal
        </Button>
      </div>
    )
  }

  // State 1: Goal assigned but read-only
  if (currentGoalId && !hasSufficientRights) {
    const isItemGoal = currentGoal?.goalType === "item" && currentGoal?.itemGoal
    const itemGoal = currentGoal?.itemGoal

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1 rounded bg-blue-500/20 p-1.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          {isItemGoal && itemGoal && (
            <div className="relative h-5 w-5 shrink-0">
              <Image
                fill
                src={itemGoal.imageUrl}
                alt={itemGoal.baseName}
                className="object-cover"
              />
            </div>
          )}
          <span className="truncate font-medium text-blue-500">
            {currentGoal?.description ?? "Goal"}
          </span>
          {isItemGoal && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              <Package className="h-3 w-3" />
            </Badge>
          )}
          {currentValue !== null && currentValue !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              <Hash className="mr-0.5 h-3 w-3" />
              {currentValue}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  // State 2 & 3: Interactive
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {currentGoalId && currentGoal ? (
        // Assigned Badge with edit trigger
        <div className="group flex items-center gap-1 rounded bg-blue-500/20 p-1 text-xs transition-colors hover:bg-blue-500/30">
          <div className="flex items-center gap-1 pl-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            {currentGoal.goalType === "item" && currentGoal.itemGoal && (
              <div className="relative h-4 w-4 shrink-0">
                <Image
                  fill
                  src={currentGoal.itemGoal.imageUrl}
                  alt={currentGoal.itemGoal.baseName}
                  className="object-cover"
                />
              </div>
            )}
            <span className="truncate font-medium text-blue-500 max-w-[150px]">
              {currentGoal.description}
            </span>
            {currentValue !== null && currentValue !== undefined && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px] bg-background/50">
                <Hash className="mr-0.5 h-2.5 w-2.5" />
                {currentValue}
              </Badge>
            )}
          </div>

          <div className="ml-1 flex items-center gap-0.5 border-l border-blue-500/20 pl-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-blue-500/20 text-blue-600"
                  title="Edit assignment"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                {renderPopoverContent()}
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-red-500/70 hover:bg-red-500/20 hover:text-red-600"
              onClick={handleRemoveGoal}
              disabled={isSaving}
              title="Remove goal"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ) : (
        // Add Goal Trigger
        hasSufficientRights && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-dashed bg-transparent text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Goal
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              {renderPopoverContent()}
            </PopoverContent>
          </Popover>
        )
      )}
    </div>
  )
}
