"use client"

/* eslint-disable */
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus } from "lucide-react"
import type { Tile, Goal } from "@/app/actions/events"
import { addGoalValue, deleteGoalValue, type GoalValue } from "@/app/actions/goals"
import { toast } from "@/hooks/use-toast"

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
      <div className="space-y-6 p-4">
        {/* Existing goals */}
        {selectedTile?.goals && selectedTile.goals.length > 0 ? (
          <div className="space-y-4">
            {selectedTile.goals.map((goal) => {
              const currentGoalValues = goalValuesState[goal.id] || goal.goalValues || []

              return (
                <Card key={goal.id} className="shadow-sm hover:shadow-md transition-shadow bg-card border-border goal-card">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base text-foreground">{goal.description}</CardTitle>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
