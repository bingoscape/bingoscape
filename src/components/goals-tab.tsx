/* eslint-disable */
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, CheckCircle2, Clock } from "lucide-react"
import type { Tile, Goal } from "@/app/actions/events"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface GoalsTabProps {
  selectedTile: Tile | null
  newGoal: Partial<Goal>
  hasSufficientRights: boolean
  onDeleteGoal: (goalId: string) => void
  onAddGoal: () => void
  onNewGoalChange: <K extends keyof Goal>(field: K, value: Goal[K]) => void
}

interface GoalProgress {
  approved: number
  total: number
}

export function GoalsTab({
  selectedTile,
  newGoal,
  hasSufficientRights,
  onDeleteGoal,
  onAddGoal,
  onNewGoalChange,
}: GoalsTabProps) {
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null)

  // Calculate goal progress based on submissions
  const calculateGoalProgress = (goalId: string): GoalProgress => {
    // Find all submissions for this goal across all teams
    let approvedCount = 0
    let totalCount = 0

    selectedTile?.teamTileSubmissions?.forEach((teamSubmission) => {
      const goalSubmissions = teamSubmission.submissions.filter((sub) => sub.goalId === goalId)
      totalCount += goalSubmissions.length
      approvedCount += goalSubmissions.filter((sub) => sub.status === "approved").length
    })

    return {
      approved: approvedCount,
      total: totalCount,
    }
  }

  return (
    <div className="p-4 space-y-6 max-h-[60vh] flex flex-col">
      <div className="overflow-y-auto flex-1 pr-2">
        {selectedTile?.goals && selectedTile.goals.length > 0 ? (
          <div className="space-y-6">
            {selectedTile.goals.map((goal) => {
              const progress = calculateGoalProgress(goal.id)
              const approvedProgress = progress.approved
              const totalProgress = progress.total

              // Calculate percentages
              const approvedPercentage =
                goal.targetValue > 0 ? Math.min(100, (approvedProgress / goal.targetValue) * 100) : 0

              const virtualPercentage =
                goal.targetValue > 0 ? Math.min(100, (totalProgress / goal.targetValue) * 100) : 0

              return (
                <div key={goal.id} className="border rounded-lg p-4 relative">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-medium">{goal.description}</h3>
                      <p className="text-sm text-muted-foreground">Target: {goal.targetValue}</p>
                    </div>
                    {hasSufficientRights && (
                      <AlertDialog
                        open={goalToDelete === goal.id}
                        onOpenChange={(open) => !open && setGoalToDelete(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setGoalToDelete(goal.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this goal? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                onDeleteGoal(goal.id)
                                setGoalToDelete(null)
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {/* Official Progress (Approved Submissions) */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-muted-foreground">Approved</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Progress based on approved submissions</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Progress
                          value={approvedPercentage}
                          className="h-2.5 flex-1 bg-muted"
                          aria-label={`Approved progress for ${goal.description}`}
                        />
                        <span className="text-sm font-medium min-w-[80px] text-right">
                          {approvedProgress} / {goal.targetValue}
                        </span>
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        {approvedPercentage.toFixed(0)}% complete
                      </div>
                    </div>

                    {/* Virtual Progress (All Submissions) */}
                    {totalProgress > approvedProgress && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-amber-500" />
                                  <span className="text-xs text-muted-foreground">Virtual</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Progress including pending and in-review submissions</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Progress
                            value={virtualPercentage}
                            className="h-2.5 flex-1 bg-muted"
                            aria-label={`Virtual progress for ${goal.description}`}
                          />
                          <span className="text-sm font-medium min-w-[80px] text-right">
                            {totalProgress} / {goal.targetValue}
                          </span>
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                          {virtualPercentage.toFixed(0)}% potential
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submission counts by team */}
                  {selectedTile.teamTileSubmissions && selectedTile.teamTileSubmissions.length > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <h4 className="text-sm font-medium mb-2">Team Submissions</h4>
                      <div className="space-y-2">
                        {selectedTile.teamTileSubmissions.map((teamSubmission) => {
                          const teamGoalSubmissions = teamSubmission.submissions.filter((sub) => sub.goalId === goal.id)
                          if (teamGoalSubmissions.length === 0) return null

                          const approvedTeamSubmissions = teamGoalSubmissions.filter(
                            (sub) => sub.status === "approved",
                          ).length

                          return (
                            <div key={teamSubmission.teamId} className="flex justify-between items-center text-sm">
                              <span>{teamSubmission.team.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600 font-medium">{approvedTeamSubmissions}</span>
                                {approvedTeamSubmissions < teamGoalSubmissions.length && (
                                  <span className="text-amber-500">
                                    (+{teamGoalSubmissions.length - approvedTeamSubmissions})
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No goals have been set for this tile yet.</p>
          </div>
        )}
      </div>

      {hasSufficientRights && (
        <div className="border rounded-lg p-4 space-y-4 mt-4">
          <h3 className="font-medium">Add New Goal</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Input
                id="description"
                value={newGoal.description ?? ""}
                onChange={(e) => onNewGoalChange("description", e.target.value)}
                placeholder="Enter goal description"
              />
            </div>
            <div>
              <label htmlFor="targetValue" className="block text-sm font-medium text-gray-700 mb-1">
                Target Value
              </label>
              <Input
                id="targetValue"
                type="number"
                min="1"
                value={newGoal.targetValue?.toString() ?? ""}
                onChange={(e) => onNewGoalChange("targetValue", Number(e.target.value))}
                placeholder="Enter target value"
              />
            </div>
            <Button
              onClick={onAddGoal}
              disabled={!newGoal.description || !newGoal.targetValue || newGoal.targetValue < 1}
              className="w-full"
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
