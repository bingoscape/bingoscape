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
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree")
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
        <div className="flex gap-2">
          <Button
            variant={viewMode === "tree" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("tree")}
          >
            <Network className="h-4 w-4 mr-2" />
            Tree View
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List View
          </Button>
        </div>
      </div>

      {viewMode === "tree" ? (
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
      ) : (
        <div className="space-y-6 p-4">
        {/* Existing goals */}
        {selectedTile?.goals && selectedTile.goals.length > 0 ? (
          <div className="space-y-4">
            {selectedTile.goals.map((goal) => {
              const currentGoalValues = goalValuesState[goal.id] || goal.goalValues || []
              const isItemGoal = goal.goalType === "item" && (goal as any).itemGoal

              return (
                <Card key={goal.id} className="shadow-sm hover:shadow-md transition-shadow bg-card border-border goal-card">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isItemGoal && (
                            <img
                              src={(goal as any).itemGoal.imageUrl}
                              alt={(goal as any).itemGoal.baseName}
                              className="h-8 w-8 object-contain flex-shrink-0"
                            />
                          )}
                          <CardTitle className="text-base text-foreground">{goal.description}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="px-2 py-1 bg-green-500 text-foreground rounded-full text-xs font-medium">
                            Target: {goal.targetValue}
                          </div>
                          <div className="px-2 py-1 bg-blue-500 text-foreground rounded-full text-xs font-medium">
                            {currentGoalValues.length} values
                          </div>
                        </div>
                      </div>
                      {hasSufficientRights && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteGoal(goal.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Goal Values */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm font-medium">Predefined Values</Label>
                        {hasSufficientRights && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedGoalForValue(goal.id)}
                            className="h-7"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Value
                          </Button>
                        )}
                      </div>

                      {currentGoalValues.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {currentGoalValues.map((goalValue) => (
                            <div key={goalValue.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="px-2 py-1 bg-blue-500 text-foreground rounded-full text-xs font-mono font-medium">
                                  {goalValue.value}
                                </div>
                                <span className="text-muted-foreground text-sm">{goalValue.description}</span>
                              </div>
                              {hasSufficientRights && (
                                <button
                                  onClick={() => handleDeleteGoalValue(goalValue.id, goal.id)}
                                  className="text-red-500 hover:text-red-300 p-1 rounded hover:bg-muted/80 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-muted rounded-lg border-2 border-dashed border-muted-foreground">
                          <p className="text-sm text-muted-foreground">No predefined values yet</p>
                          {hasSufficientRights && (
                            <p className="text-xs text-muted-foreground mt-1">Click "Add Value" to create predefined values</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add Goal Value Form */}
                    {selectedGoalForValue === goal.id && hasSufficientRights && (
                      <div className="border border-border rounded-lg p-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label htmlFor="goalValue" className="text-xs">
                              Value
                            </Label>
                            <Input
                              id="goalValue"
                              type="number"
                              step="0.1"
                              value={newGoalValue.value}
                              onChange={(e) => setNewGoalValue((prev) => ({ ...prev, value: e.target.value }))}
                              placeholder="1.0"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="goalDescription" className="text-xs">
                              Description
                            </Label>
                            <Input
                              id="goalDescription"
                              value={newGoalValue.description}
                              onChange={(e) => setNewGoalValue((prev) => ({ ...prev, description: e.target.value }))}
                              placeholder="Full completion"
                              className="h-8"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAddGoalValue(goal.id)} className="h-7">
                            Add Value
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedGoalForValue(null)
                              setNewGoalValue({ value: "", description: "" })
                            }}
                            className="h-7"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No goals have been set for this tile yet.</p>
          </div>
        )}

        {/* Add new goal form */}
        {hasSufficientRights && (
          <Card className="border-2 border-dashed border-border bg-muted/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Goal Type Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Goal Type</Label>
                <RadioGroup
                  value={goalType}
                  onValueChange={(value) => setGoalType(value as "generic" | "item")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="generic" id="generic" />
                    <Label htmlFor="generic" className="cursor-pointer font-normal">
                      Generic Goal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item" id="item" />
                    <Label htmlFor="item" className="cursor-pointer font-normal flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      OSRS Item Goal
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Generic Goal Form */}
              {goalType === "generic" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="goalDescription" className="text-sm font-medium text-muted-foreground">
                        Description
                      </Label>
                      <Input
                        id="goalDescription"
                        value={newGoal.description || ""}
                        onChange={(e) => onNewGoalChange("description", e.target.value)}
                        placeholder="Complete the task..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="targetValue" className="text-sm font-medium text-muted-foreground">
                        Target Value
                      </Label>
                      <Input
                        id="targetValue"
                        type="number"
                        value={newGoal.targetValue?.toString() || ""}
                        onChange={(e) => onNewGoalChange("targetValue", Number.parseInt(e.target.value))}
                        placeholder="1"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={onAddGoal} className="w-full bg-green-500 hover:bg-green-600 text-foreground">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                </>
              )}

              {/* Item Goal Form */}
              {goalType === "item" && (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Select OSRS Items</Label>
                      <div className="mt-1">
                        <OsrsItemSearch
                          onItemSelect={(items) => {
                            if (Array.isArray(items)) {
                              setSelectedItems(items)
                            } else {
                              setSelectedItems([items])
                            }
                          }}
                          selectedItems={selectedItems}
                          placeholder="Search for items..."
                          multiSelect={true}
                        />
                      </div>
                      {selectedItems.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected - a separate goal will be created for each item
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="itemTargetValue" className="text-sm font-medium text-muted-foreground">
                        Quantity Required
                      </Label>
                      <Input
                        id="itemTargetValue"
                        type="number"
                        value={itemGoalTargetValue}
                        onChange={(e) => setItemGoalTargetValue(Number.parseInt(e.target.value) || 1)}
                        placeholder="1"
                        min="1"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of times this item must be obtained
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddItemGoal}
                    disabled={selectedItems.length === 0 || isCreatingBulk}
                    className="w-full bg-green-500 hover:bg-green-600 text-foreground"
                  >
                    {isCreatingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating {selectedItems.length} Goal{selectedItems.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-2" />
                        Add Item Goal{selectedItems.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      )}
    </div>
  )
}
