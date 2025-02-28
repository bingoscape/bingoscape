import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2 } from 'lucide-react'
import { type Tile, type Goal } from '@/app/actions/events'

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
  onNewGoalChange
}: GoalsTabProps) {
  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
      <h3 className="text-lg font-semibold">Goals</h3>
      {selectedTile?.goals?.map(goal => (
        <div key={goal.id} className="flex justify-between items-center">
          <span>{goal.description} (Target: {goal.targetValue})</span>
          {hasSufficientRights && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteGoal(goal.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {hasSufficientRights && (
        <>
          <h3 className="text-lg font-semibold">Add New Goal</h3>
          <div className="space-y-2">
            <Input
              placeholder="Goal description"
              value={newGoal.description ?? ''}
              onChange={(e) => onNewGoalChange('description', e.target.value)}
            />
            <Input
              type="number"
              placeholder="Target value"
              value={newGoal.targetValue ?? ''}
              onChange={(e) => onNewGoalChange('targetValue', parseInt(e.target.value))}
            />
            <Button onClick={onAddGoal}>Add Goal</Button>
          </div>
        </>
      )}
    </div>
  )
}
