"use client"

import { useState } from "react"
import { Plus, Target, Package, Loader2, BarChart2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { parseItemName } from "osrs-item-data"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/hooks/use-toast"
import { createGoals, createMetricGoal } from "@/app/actions/bingo"
import type { Goal } from "@/types/model"
import type { OsrsItem } from "@/types/osrs-items"
import { GoalTypePicker } from "./goal-type-picker"
import { GenericGoalForm } from "./generic-goal-form"
import { ItemGoalForm } from "./item-goal-form"
import { MetricGoalForm } from "./metric-goal-form"
import type { GoalType, MetricType } from "./types"
import { resolveItemId } from "./utils"

interface AddGoalDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tileId: string
  /** Group the new Goal is added to; null adds it at the top level. */
  parentGroupId: string | null
  newGoal: Partial<Goal>
  onNewGoalChange: (field: string, value: unknown) => void
  /** Creates the generic Goal described by `newGoal`. */
  onAddGoal: (parentGroupId?: string | null) => void | Promise<void>
  /** Called after an item or metric Goal was created: close the drawer and clear its parent group. */
  onCreated: () => void
  onRefresh: () => void
}

export function AddGoalDrawer({
  open,
  onOpenChange,
  tileId,
  parentGroupId,
  newGoal,
  onNewGoalChange,
  onAddGoal,
  onCreated,
  onRefresh,
}: AddGoalDrawerProps) {
  const [goalType, setGoalType] = useState<GoalType>("generic")

  // Item goal state
  const [selectedItems, setSelectedItems] = useState<OsrsItem[]>([])
  const [itemGoalTargetValue, setItemGoalTargetValue] = useState<number>(1)
  const [isCreatingBulk, setIsCreatingBulk] = useState(false)

  // Metric goal state
  const [metricType, setMetricType] = useState<MetricType>("skill")
  const [metricName, setMetricName] = useState("")
  const [metricTargetValue, setMetricTargetValue] = useState<number>(1)

  const handleAddItemGoal = async () => {
    if (!tileId || selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      })
      return
    }

    setIsCreatingBulk(true)
    const result = await createGoals(
      tileId,
      selectedItems.map((selectedItem) => {
        const itemId = resolveItemId(selectedItem)
        const parsed = parseItemName(selectedItem.name)
        return {
          type: "item" as const,
          itemId,
          itemName: selectedItem.name,
          baseName: parsed.baseName,
          imageUrl: selectedItem.imageUrl,
          targetValue: itemGoalTargetValue,
          exactVariant: parsed.variant ?? null,
        }
      }),
      { parentGroupId }
    )
    setIsCreatingBulk(false)

    if (!result.success) {
      // Nothing was created, so keep the selection for another attempt.
      toast({
        title: "Error",
        description: result.error || "Failed to create item goals",
        variant: "destructive",
      })
      return
    }

    const count = result.goals.length
    toast({
      title: "Item goals created",
      description: `Successfully created ${count} item goal${count !== 1 ? "s" : ""}.`,
    })

    // Reset form
    setSelectedItems([])
    setItemGoalTargetValue(1)
    setGoalType("generic")
    onCreated()

    // Refresh tree
    onRefresh()
  }

  const handleAddMetricGoal = async () => {
    if (!metricName.trim()) {
      toast({
        title: "Error",
        description: "Please specify a metric name",
        variant: "destructive",
      })
      return
    }

    const result = await createMetricGoal(
      tileId,
      metricType,
      metricName,
      metricTargetValue,
      undefined,
      parentGroupId
    )

    if (result.success) {
      toast({
        title: "Metric goal created",
        description: "Successfully created a new metric goal.",
      })
      setMetricName("")
      setMetricTargetValue(1)
      setGoalType("generic")
      onCreated()
      onRefresh()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create metric goal",
        variant: "destructive",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(100vw,540px)] overflow-y-auto z-50">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Add New Goal {parentGroupId ? "to Group" : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 pt-2 pb-6">
          <GoalTypePicker value={goalType} onChange={setGoalType} />

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={goalType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {goalType === "generic" && (
                  <GenericGoalForm
                    newGoal={newGoal}
                    onNewGoalChange={onNewGoalChange}
                  />
                )}

                {goalType === "item" && (
                  <ItemGoalForm
                    selectedItems={selectedItems}
                    onSelectedItemsChange={setSelectedItems}
                    targetValue={itemGoalTargetValue}
                    onTargetValueChange={setItemGoalTargetValue}
                  />
                )}

                {goalType === "metric" && (
                  <MetricGoalForm
                    metricType={metricType}
                    onMetricTypeChange={(type) => {
                      setMetricType(type)
                      setMetricName("")
                    }}
                    metricName={metricName}
                    onMetricNameChange={setMetricName}
                    targetValue={metricTargetValue}
                    onTargetValueChange={setMetricTargetValue}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky Footer for Actions */}
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background pt-4 pb-2 z-10 -mx-6 px-6 -mb-6">
          {goalType === "generic" && (
            <Button
              onClick={() => onAddGoal(parentGroupId)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          )}
          {goalType === "item" && (
            <Button
              onClick={handleAddItemGoal}
              disabled={selectedItems.length === 0 || isCreatingBulk}
              className="w-full"
            >
              {isCreatingBulk ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating {selectedItems.length} Goal{selectedItems.length !== 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Add Item Goal{selectedItems.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
          {goalType === "metric" && (
            <Button
              onClick={handleAddMetricGoal}
              disabled={!metricName.trim()}
              className="w-full"
            >
              <BarChart2 className="mr-2 h-4 w-4" />
              Add Metric Goal
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
