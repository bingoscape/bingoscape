"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { parseItemName } from "osrs-item-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OsrsItemSearch } from "@/components/osrs-item-search"
import { toast } from "@/hooks/use-toast"
import { getMetricTargetCopy, METRIC_GOAL_LABEL } from "@/lib/osrs-metrics"
import { parseTargetInput, validateNumberInput } from "@/lib/number-input"
import { updateGoal, updateItemGoal, updateMetricGoal } from "@/app/actions/bingo"
import type { OsrsItem } from "@/types/osrs-items"
import { MetricSelectItems } from "./metric-select-items"
import { NumberField } from "./number-field"
import type { GoalNodeData, GroupOperator } from "./types"
import { resolveItemId } from "./utils"

interface GoalEditFormProps {
  goalId: string
  goalData: GoalNodeData
  /** Operator of the group the Goal sits in, if any. */
  parentOperator?: GroupOperator
  /** Leaves edit mode (after a save or a cancel). */
  onClose: () => void
  onRefresh: () => void
}

/** Inline editor for a single Goal; its state starts from the Goal's current values. */
export function GoalEditForm({
  goalId,
  goalData,
  parentOperator,
  onClose,
  onRefresh,
}: GoalEditFormProps) {
  const isItemGoal = goalData.goalType === "item" && goalData.itemGoal
  const isMetricGoal = goalData.goalType === "metric" && goalData.metricGoal

  const [editDescription, setEditDescription] = useState(goalData.description)
  // The raw text of the target field; parsed when saving.
  const [editTargetValue, setEditTargetValue] = useState(
    String(goalData.targetValue)
  )
  // For item goals, start from the current item
  const [editSelectedItem, setEditSelectedItem] = useState<OsrsItem | null>(
    () => {
      if (goalData.goalType === "item" && goalData.itemGoal) {
        const itemGoal = goalData.itemGoal
        return {
          id: itemGoal.itemId,
          name: goalData.description,
          baseName: itemGoal.baseName,
          variant: itemGoal.exactVariant,
          imageUrl: itemGoal.imageUrl,
        } as OsrsItem
      }
      return null
    }
  )
  const [editMetricType, setEditMetricType] = useState<string>(
    goalData.goalType === "metric" && goalData.metricGoal
      ? goalData.metricGoal.metricType
      : "skill"
  )
  const [editMetricName, setEditMetricName] = useState<string>(
    goalData.goalType === "metric" && goalData.metricGoal
      ? goalData.metricGoal.metricName
      : ""
  )
  const [isSaving, setIsSaving] = useState(false)

  const metricCopy = getMetricTargetCopy(editMetricType)
  const targetError = validateNumberInput(editTargetValue)

  const handleSaveEdit = async () => {
    const targetValue = parseTargetInput(editTargetValue)
    if (targetValue === null) return

    setIsSaving(true)

    try {
      if (goalData.goalType === "item" && editSelectedItem) {
        // Update item goal
        const itemId = resolveItemId(editSelectedItem)
        const parsed = parseItemName(editSelectedItem.name)

        const result = await updateItemGoal(
          goalId,
          itemId,
          editSelectedItem.name,
          parsed.baseName,
          editSelectedItem.imageUrl,
          parsed.variant ?? null,
          targetValue
        )

        if (result.success) {
          toast({
            title: "Goal updated",
            description: "Item goal has been updated successfully.",
          })
          onClose()
          onRefresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to update goal",
            variant: "destructive",
          })
        }
      } else if (goalData.goalType === "metric") {
        // Update metric goal
        const result = await updateMetricGoal(
          goalId,
          editMetricType,
          editMetricName,
          targetValue,
          `${editMetricName} (${editMetricType})`
        )

        if (result.success) {
          toast({
            title: "Goal updated",
            description: `${METRIC_GOAL_LABEL} goal has been updated successfully.`,
          })
          onClose()
          onRefresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to update goal",
            variant: "destructive",
          })
        }
      } else {
        // Update generic goal
        const result = await updateGoal(goalId, {
          description: editDescription,
          targetValue,
        })

        if (result.success) {
          toast({
            title: "Goal updated",
            description: "Goal has been updated successfully.",
          })
          onClose()
          onRefresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to update goal",
            variant: "destructive",
          })
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSaveEdit()
      }}
    >
      {/* Edit Mode */}
      {isItemGoal ? (
        <>
          <div>
            <Label className="text-xs">OSRS Item</Label>
            <OsrsItemSearch
              onItemSelect={setEditSelectedItem}
              selectedItem={editSelectedItem}
              placeholder="Select item..."
              className="mt-1"
            />
          </div>
        </>
      ) : isMetricGoal ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`edit-metric-type-${goalId}`} className="text-xs">
              Track
            </Label>
            <Select
              value={editMetricType}
              onValueChange={(v) => {
                setEditMetricType(v)
                setEditMetricName("")
              }}
            >
              <SelectTrigger
                id={`edit-metric-type-${goalId}`}
                className="mt-1 h-8 text-sm"
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {(["skill", "boss", "activity"] as const).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getMetricTargetCopy(type).typeOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`edit-metric-name-${goalId}`} className="text-xs">
              {metricCopy.nameLabel}
            </Label>
            <Select
              value={editMetricName}
              onValueChange={setEditMetricName}
            >
              <SelectTrigger
                id={`edit-metric-name-${goalId}`}
                className="mt-1 h-8 text-sm"
              >
                <SelectValue placeholder={metricCopy.namePlaceholder} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <MetricSelectItems metricType={editMetricType} />
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor={`edit-description-${goalId}`} className="text-xs">
            Description
          </Label>
          <Input
            id={`edit-description-${goalId}`}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Goal description..."
            className="mt-1 h-8 text-sm"
          />
        </div>
      )}
      <NumberField
        id={`edit-target-${goalId}`}
        label={
          isMetricGoal
            ? metricCopy.targetLabel
            : isItemGoal
              ? "Quantity"
              : "Target"
        }
        value={editTargetValue}
        onValueChange={setEditTargetValue}
        unit={isMetricGoal ? metricCopy.unit : undefined}
        unitSingular={isMetricGoal ? metricCopy.unitSingular : undefined}
        hint={
          parentOperator === "SUM"
            ? "In a SUM group, this target is illustrative and does not cap contributions."
            : undefined
        }
        compact
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            isSaving ||
            targetError !== null ||
            (isItemGoal && !editSelectedItem) ||
            (isMetricGoal && !editMetricName.trim()) ||
            (!isItemGoal && !isMetricGoal && !editDescription.trim())
          }
          className="h-7 flex-1 text-xs pointer-coarse:min-h-11"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1 h-3 w-3" />
              Save
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isSaving}
          className="h-7 text-xs pointer-coarse:min-h-11"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
