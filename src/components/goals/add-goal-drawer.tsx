"use client"

import { useRef, useState } from "react"
import { Plus, Target, Package, Loader2, BarChart2 } from "lucide-react"
import { parseItemName } from "osrs-item-data"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/hooks/use-toast"
import { addGoal, createGoals, createMetricGoal } from "@/app/actions/bingo"
import {
  formatNumber,
  parseTargetInput,
  validateNumberInput,
} from "@/lib/number-input"
import {
  METRIC_GOAL_LABEL,
  getMetricName,
  getMetricTargetCopy,
} from "@/lib/osrs-metrics"
import type { OsrsItem } from "@/types/osrs-items"
import { AddedGoalsList, type AddedGoalEntry } from "./added-goals-list"
import { GoalTypePicker } from "./goal-type-picker"
import { GenericGoalForm } from "./generic-goal-form"
import { ItemGoalForm } from "./item-goal-form"
import { MetricGoalForm } from "./metric-goal-form"
import type { GoalType, MetricType } from "./types"
import { resolveItemId } from "./utils"

/** How many of the most recently added goals the drawer lists. */
const MAX_ADDED_SHOWN = 3

interface AddGoalDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tileId: string
  /** Group the new Goals are added to; null adds them at the top level. */
  parentGroupId: string | null
  /** Called after Goals were created, to refresh the tree behind the drawer. */
  onRefresh: () => void
  /** Whether the Board has a Wise Old Man competition (feeds XP / Kills progress). */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
}

/**
 * Side drawer for adding Goals. It stays open after each add (so several can
 * be added in a row) and closes with Done. Its state lives in
 * `AddGoalPanel`, which is unmounted while the drawer is closed, so every
 * opening starts fresh on the Item type.
 */
export function AddGoalDrawer({
  open,
  onOpenChange,
  onOpenTrackerSettings,
  ...panelProps
}: AddGoalDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-50 flex w-[min(100vw,540px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[540px]"
      >
        <AddGoalPanel
          {...panelProps}
          onDone={() => onOpenChange(false)}
          onOpenTrackerSettings={
            onOpenTrackerSettings
              ? () => {
                  onOpenChange(false)
                  onOpenTrackerSettings()
                }
              : undefined
          }
        />
      </SheetContent>
    </Sheet>
  )
}

interface AddGoalPanelProps {
  tileId: string
  parentGroupId: string | null
  onRefresh: () => void
  womLinked: boolean
  onOpenTrackerSettings?: () => void
  onDone: () => void
}

function AddGoalPanel({
  tileId,
  parentGroupId,
  onRefresh,
  womLinked,
  onOpenTrackerSettings,
  onDone,
}: AddGoalPanelProps) {
  const [goalType, setGoalType] = useState<GoalType>("item")
  // Bumped after each add: remounts the fields so they are empty and the first
  // one is focused again.
  const [formVersion, setFormVersion] = useState(0)
  // A type change made with the arrow keys leaves focus on the radio group so
  // the arrow keys keep working; every other change focuses the first field.
  const [focusFirstField, setFocusFirstField] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [added, setAdded] = useState<AddedGoalEntry[]>([])
  const nextEntryId = useRef(0)

  // Other goal state
  const [description, setDescription] = useState("")
  const [genericTarget, setGenericTarget] = useState("1")

  // Item goal state
  const [selectedItems, setSelectedItems] = useState<OsrsItem[]>([])
  const [itemTarget, setItemTarget] = useState("1")

  // XP / Kills goal state
  const [metricType, setMetricType] = useState<MetricType>("skill")
  const [metricName, setMetricName] = useState("")
  const [metricTarget, setMetricTarget] = useState("")

  const metricCopy = getMetricTargetCopy(metricType)

  /** Why the active form cannot be added yet, or null when it can. */
  const blockReason = ((): string | null => {
    switch (goalType) {
      case "generic": {
        if (!description.trim()) return "Enter a description to add this goal."
        const error = validateNumberInput(genericTarget)
        return error && `Target: ${error}`
      }
      case "item": {
        if (selectedItems.length === 0) {
          return "Select at least one item to add."
        }
        const error = validateNumberInput(itemTarget)
        return error && `Quantity: ${error}`
      }
      case "metric": {
        if (!metricName) {
          return `Select a ${metricCopy.nameLabel.toLowerCase()} to add.`
        }
        const error = validateNumberInput(metricTarget)
        return error && `${metricCopy.targetLabel}: ${error}`
      }
    }
  })()

  const recordAdded = (texts: string[]) => {
    const entries = texts.map((text) => ({ id: nextEntryId.current++, text }))
    setAdded((prev) => [...entries, ...prev].slice(0, MAX_ADDED_SHOWN))
    setFormVersion((version) => version + 1)
    setFocusFirstField(true)
    onRefresh()
  }

  const createGeneric = async () => {
    const targetValue = parseTargetInput(genericTarget)
    if (targetValue === null) return
    const result = await addGoal(tileId, {
      description: description.trim(),
      targetValue,
      parentGroupId,
    })
    if (!result.success) return result.error
    recordAdded([`${description.trim()} x${formatNumber(targetValue)}`])
    setDescription("")
    setGenericTarget("1")
  }

  const createItems = async () => {
    const targetValue = parseTargetInput(itemTarget)
    if (targetValue === null) return
    const result = await createGoals(
      tileId,
      selectedItems.map((selectedItem) => {
        const parsed = parseItemName(selectedItem.name)
        return {
          type: "item" as const,
          itemId: resolveItemId(selectedItem),
          itemName: selectedItem.name,
          baseName: parsed.baseName,
          imageUrl: selectedItem.imageUrl,
          targetValue,
          exactVariant: parsed.variant ?? null,
        }
      }),
      { parentGroupId }
    )
    if (!result.success) {
      // Nothing was created, so keep the selection for another attempt.
      return result.error
    }
    recordAdded(
      selectedItems.map(
        (item) => `${item.name} x${formatNumber(targetValue)}`
      )
    )
    setSelectedItems([])
    setItemTarget("1")
  }

  const createMetric = async () => {
    const targetValue = parseTargetInput(metricTarget)
    if (targetValue === null) return
    const result = await createMetricGoal(
      tileId,
      metricType,
      metricName,
      targetValue,
      undefined,
      parentGroupId
    )
    if (!result.success) return result.error
    const unit = targetValue === 1 ? metricCopy.unitSingular : metricCopy.unit
    recordAdded([
      `${getMetricName(metricName)}: ${formatNumber(targetValue)}${unit ? ` ${unit}` : ""}`,
    ])
    setMetricName("")
    setMetricTarget("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // The drawer is portaled; keep the submit from reaching forms further up the React tree.
    event.stopPropagation()
    if (isSubmitting || blockReason) return

    setIsSubmitting(true)
    try {
      const error =
        goalType === "generic"
          ? await createGeneric()
          : goalType === "item"
            ? await createItems()
            : await createMetric()
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding goal:", error)
      toast({
        title: "Error",
        description: "Failed to add the goal",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCount = selectedItems.length

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetHeader className="px-6 pt-6 pr-14 pb-3 text-left">
        <SheetTitle className="flex items-center gap-2">
          <Target aria-hidden="true" className="h-5 w-5" />
          Add New Goal {parentGroupId ? "to Group" : ""}
        </SheetTitle>
        <SheetDescription>
          Add as many goals as you like, then press Done.
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-1 pb-4">
        {/* Above the form, so it stays in view on a short or narrow screen. */}
        <AddedGoalsList entries={added} />

        <GoalTypePicker
          value={goalType}
          onChange={(type, { viaKeyboard }) => {
            setGoalType(type)
            setFocusFirstField(!viaKeyboard)
          }}
        />

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div
            key={goalType}
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
          >
            <div key={formVersion}>
              {goalType === "generic" && (
                <GenericGoalForm
                  description={description}
                  onDescriptionChange={setDescription}
                  targetValue={genericTarget}
                  onTargetValueChange={setGenericTarget}
                  autoFocus={focusFirstField}
                />
              )}

              {goalType === "item" && (
                <ItemGoalForm
                  selectedItems={selectedItems}
                  onSelectedItemsChange={setSelectedItems}
                  targetValue={itemTarget}
                  onTargetValueChange={setItemTarget}
                  autoFocus={focusFirstField}
                />
              )}

              {goalType === "metric" && (
                <MetricGoalForm
                  metricType={metricType}
                  onMetricTypeChange={(type) => {
                    setMetricType(type)
                    setMetricName("")
                    setMetricTarget("")
                  }}
                  metricName={metricName}
                  onMetricNameChange={setMetricName}
                  targetValue={metricTarget}
                  onTargetValueChange={setMetricTarget}
                  womLinked={womLinked}
                  onOpenTrackerSettings={onOpenTrackerSettings}
                  autoFocus={focusFirstField}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t bg-background px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {blockReason && !isSubmitting && (
          <p
            id="add-goal-reason"
            className="text-xs text-muted-foreground"
          >
            {blockReason}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={!!blockReason || isSubmitting}
            aria-describedby={blockReason ? "add-goal-reason" : undefined}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : goalType === "item" ? (
              <>
                <Package aria-hidden="true" className="mr-2 h-4 w-4" />
                Add Item Goal{selectedCount > 1 ? `s (${selectedCount})` : ""}
              </>
            ) : goalType === "metric" ? (
              <>
                <BarChart2 aria-hidden="true" className="mr-2 h-4 w-4" />
                Add {METRIC_GOAL_LABEL} Goal
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                Add Goal
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </form>
  )
}
