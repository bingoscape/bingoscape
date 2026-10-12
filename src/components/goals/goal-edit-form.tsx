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
import { updateGoal, updateItemGoal, updateMetricGoal } from "@/app/actions/bingo"
import type { OsrsItem } from "@/types/osrs-items"
import { MetricSelectItems } from "./metric-select-items"
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
  const [editTargetValue, setEditTargetValue] = useState<number>(
    goalData.targetValue
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

  const handleSaveEdit = async () => {
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
          editTargetValue
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
          editTargetValue,
          `${editMetricName} (${editMetricType})`
        )

        if (result.success) {
          toast({
            title: "Goal updated",
            description: "Metric goal has been updated successfully.",
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
          targetValue: editTargetValue,
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
    <div className="space-y-3">
      {/* Edit Mode */}
      {isItemGoal ? (
        <>
          <div>
            <Label className="text-xs">OSRS Item</Label>
            <OsrsItemSearch
              onItemSelect={(item) => {
                if (Array.isArray(item)) {
                  setEditSelectedItem(item[0] || null)
                } else {
                  setEditSelectedItem(item)
                }
              }}
              selectedItem={editSelectedItem}
              placeholder="Select item..."
              className="mt-1"
            />
          </div>
        </>
      ) : isMetricGoal ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Metric Type</Label>
            <Select
              value={editMetricType}
              onValueChange={(v) => {
                setEditMetricType(v)
                setEditMetricName("")
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="boss">Boss</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Metric Name</Label>
            <Select
              value={editMetricName}
              onValueChange={setEditMetricName}
            >
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <MetricSelectItems metricType={editMetricType} />
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div>
          <Label className="text-xs">Description</Label>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Goal description..."
            className="mt-1 h-8 text-sm"
          />
        </div>
      )}
      <div>
        <Label className="text-xs">Target Value</Label>
        <Input
          type="number"
          value={editTargetValue}
          onChange={(e) =>
            setEditTargetValue(Number.parseInt(e.target.value) || 1)
          }
          min="1"
          className="mt-1 h-8 text-sm"
        />
        {parentOperator === "SUM" && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Note: In a SUM group, this target is illustrative and does
            not cap contributions.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSaveEdit}
          disabled={
            isSaving ||
            (isItemGoal && !editSelectedItem) ||
            (isMetricGoal && !editMetricName.trim()) ||
            (!isItemGoal && !isMetricGoal && !editDescription.trim())
          }
          className="h-7 flex-1 text-xs"
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
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isSaving}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
