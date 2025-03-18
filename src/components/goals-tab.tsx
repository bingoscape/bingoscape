"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Trash2, Target, Plus, AlertCircle } from "lucide-react"
import type { Tile, Goal } from "@/app/actions/events"
import { cn } from "@/lib/utils"

interface GoalsTabProps {
  selectedTile: Tile | null
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  onNewGoalChange: (field: keyof Goal, value: number | string) => void
}

export function GoalsTab({
  selectedTile,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
}: GoalsTabProps) {
  const hasGoals = selectedTile?.goals && selectedTile.goals.length > 0

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 pb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Goals
        </h3>
        <Badge variant="outline" className="font-normal">
          {hasGoals
            ? `${selectedTile?.goals?.length} ${selectedTile?.goals?.length === 1 ? "goal" : "goals"}`
            : "No goals yet"}
        </Badge>
      </div>

      <Separator className="my-4" />

      {!hasGoals && (
        <div className="flex items-center justify-center p-6 bg-muted/50 rounded-lg">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No goals have been added to this tile yet.</p>
            {hasSufficientRights && <p className="text-sm mt-1">Use the form below to add your first goal.</p>}
          </div>
        </div>
      )}

      {hasGoals && (
        <div className="space-y-3">
          {selectedTile?.goals?.map((goal) => (
            <Card key={goal.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1">
                    <p className="font-medium break-words">{goal.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Target: <span className="font-semibold text-primary">{goal.targetValue}</span>
                    </p>
                  </div>
                  {hasSufficientRights && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteGoal(goal.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete goal: ${goal.description}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasSufficientRights && (
        <div className={cn("rounded-lg border p-4 bg-card", hasGoals && "mt-6")}>
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Goal
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Input
                id="goal-description"
                placeholder="What needs to be accomplished?"
                value={newGoal.description ?? ""}
                onChange={(e) => onNewGoalChange("description", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-target">Target Value</Label>
              <Input
                id="goal-target"
                type="number"
                min="1"
                placeholder="Quantity needed"
                value={newGoal.targetValue ?? ""}
                onChange={(e) => onNewGoalChange("targetValue", Number.parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Enter the numeric target that needs to be reached</p>
            </div>

            <Button
              onClick={onAddGoal}
              className="w-full sm:w-auto"
              disabled={!newGoal.description || !newGoal.targetValue}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

