"use client"

/* eslint-disable */
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Network, List, Package, Loader2 } from "lucide-react"
import type { Tile, Goal } from "@/app/actions/events"
import { addGoalValue, deleteGoalValue, type GoalValue } from "@/app/actions/goals"
import { toast } from "@/hooks/use-toast"
import { GoalTreeEditor } from "./goal-tree-editor"
import { getGoalTree, type GoalTreeNode } from "@/app/actions/goal-groups"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OsrsItemSearch } from "./osrs-item-search"
import { createItemGoal } from "@/app/actions/bingo"
import { parseItemName } from "osrs-item-data"
import type { OsrsItem } from "@/types/osrs-items"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface GoalsTabProps {
  selectedTile: Tile | null
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  onNewGoalChange: (field: string, value: any) => void
  onGoalValuesUpdate?: (goalId: string, goalValues: GoalValue[]) => void
}

export function GoalsTab({
  selectedTile,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
  onGoalValuesUpdate,
}: GoalsTabProps) {
  const [newGoalValue, setNewGoalValue] = useState({ value: "", description: "" })
  const [selectedGoalForValue, setSelectedGoalForValue] = useState<string | null>(null)
  const [goalValuesState, setGoalValuesState] = useState<Record<string, GoalValue[]>>({})
  const [goalTree, setGoalTree] = useState<GoalTreeNode[]>([])
  const [goalType, setGoalType] = useState<"generic" | "item">("generic")
  const [selectedItems, setSelectedItems] = useState<OsrsItem[]>([])
  const [itemGoalTargetValue, setItemGoalTargetValue] = useState<number>(1)
  const [isCreatingBulk, setIsCreatingBulk] = useState(false)

  // Load goal tree when selectedTile changes
  useEffect(() => {
    if (selectedTile?.id) {
      loadGoalTree()
    }
  }, [selectedTile?.id])

  const loadGoalTree = async () => {
    if (!selectedTile?.id) return
    const tree = await getGoalTree(selectedTile.id)
    setGoalTree(tree)
  }

  const handleAddItemGoal = async () => {
    if (!selectedTile?.id || selectedItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      })
      return
    }

    setIsCreatingBulk(true)
    let successCount = 0
    let failCount = 0

    // Create goals for each selected item
    for (const selectedItem of selectedItems) {
      const itemId = Array.isArray(selectedItem.id) ? selectedItem.id[0]! : selectedItem.id
      const parsed = parseItemName(selectedItem.name)

      const result = await createItemGoal(
        selectedTile.id,
        itemId,
        selectedItem.name,
        parsed.baseName,
        selectedItem.imageUrl,
        itemGoalTargetValue,
        parsed.variant ?? null
      )

      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }

    setIsCreatingBulk(false)

    // Show summary toast
    if (failCount === 0) {
      toast({
        title: "Item goals created",
        description: `Successfully created ${successCount} item goal${successCount !== 1 ? 's' : ''}.`,
      })
    } else if (successCount === 0) {
      toast({
        title: "Error",
        description: `Failed to create all ${failCount} item goals.`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Partially completed",
        description: `Created ${successCount} goal${successCount !== 1 ? 's' : ''}, ${failCount} failed.`,
        variant: "default",
      })
    }

    // Reset form
    setSelectedItems([])
    setItemGoalTargetValue(1)
    setGoalType("generic")

    // Reload goal tree
    void loadGoalTree()
  }

  // Initialize goal values state when selectedTile changes
  useEffect(() => {
    if (selectedTile?.goals) {
      const initialState: Record<string, GoalValue[]> = {}
      selectedTile.goals.forEach((goal) => {
        initialState[goal.id] = goal.goalValues || []
      })
      setGoalValuesState(initialState)
    }
  }, [selectedTile])

  const handleAddGoalValue = async (goalId: string) => {
    if (!newGoalValue.value || !newGoalValue.description) {
      toast({
        title: "Error",
        description: "Please provide both value and description",
        variant: "destructive",
      })
      return
    }

    const result = await addGoalValue(goalId, Number.parseFloat(newGoalValue.value), newGoalValue.description)

    if (result.success && result.goalValue) {
      toast({
        title: "Goal value added",
        description: "The goal value has been successfully added.",
      })

      // Update local state
      setGoalValuesState((prev) => ({
        ...prev,
        [goalId]: [...(prev[goalId] || []), result.goalValue!],
      }))

      // Notify parent component if callback provided
      if (onGoalValuesUpdate) {
        const updatedValues = [...(goalValuesState[goalId] || []), result.goalValue]
        onGoalValuesUpdate(goalId, updatedValues)
      }

      setNewGoalValue({ value: "", description: "" })
      setSelectedGoalForValue(null)
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to add goal value",
        variant: "destructive",
      })
    }
  }

  const handleDeleteGoalValue = async (goalValueId: string, goalId: string) => {
    const result = await deleteGoalValue(goalValueId)

    if (result.success) {
      toast({
        title: "Goal value deleted",
        description: "The goal value has been successfully deleted.",
      })

      // Update local state
      setGoalValuesState((prev) => ({
        ...prev,
        [goalId]: (prev[goalId] || []).filter((gv) => gv.id !== goalValueId),
      }))

      // Notify parent component if callback provided
      if (onGoalValuesUpdate) {
        const updatedValues = (goalValuesState[goalId] || []).filter((gv) => gv.id !== goalValueId)
        onGoalValuesUpdate(goalId, updatedValues)
      }
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete goal value",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 bg-background text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Goals Management</h3>
      </div>

      <GoalTreeEditor
        tileId={selectedTile?.id || ""}
        tree={goalTree}
        hasSufficientRights={hasSufficientRights}
        onRefresh={loadGoalTree}
        onDeleteGoal={onDeleteGoal}
        onAddGoal={onAddGoal}
        newGoal={newGoal}
        onNewGoalChange={onNewGoalChange}
      />
    </div>
  )
}
