"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import {
  Layers,
  Target,
  CheckCircle2,
  Circle,
  Package,
} from "lucide-react"
import type { GoalTreeNode } from "@/app/actions/goal-groups"

interface TeamProgress {
  goalId: string
  currentValue: number
  isComplete: boolean
}

interface GoalProgressTreeProps {
  tree: GoalTreeNode[]
  teamId: string
  teamProgress: TeamProgress[]
  teamName: string
  teamColor: string
}

interface ProgressNode extends GoalTreeNode {
  progress?: TeamProgress
  isGroupComplete?: boolean
  groupProgress?: {
    completed: number
    total: number
    percentage: number
  }
}

export function GoalProgressTree({
  tree,
  teamId,
  teamProgress,
  teamName,
  teamColor,
}: GoalProgressTreeProps) {

  // Recursively evaluate group completion
  const evaluateGroup = (node: GoalTreeNode): ProgressNode => {
    if (node.type === "goal") {
      const goalData = node.data as any
      const progress = teamProgress.find((p) => p.goalId === node.id)
      return {
        ...node,
        progress,
      }
    }

    // It's a group - evaluate children
    const groupData = node.data as any
    const evaluatedChildren = (node.children || []).map((child) => evaluateGroup(child))

    // Count completed children
    const completedChildren = evaluatedChildren.filter((child) => {
      if (child.type === "goal") {
        return child.progress?.isComplete
      }
      return child.isGroupComplete
    })

    const totalChildren = evaluatedChildren.length
    const completedCount = completedChildren.length

    // Apply logical operator
    let isComplete = false
    const minRequired = (groupData.minRequiredGoals as number) || 1

    if (groupData.logicalOperator === "AND") {
      isComplete = totalChildren > 0 && completedCount === totalChildren
    } else {
      // OR - check if at least minRequiredGoals are complete
      isComplete = completedCount >= minRequired
    }

    // For OR groups, display as "X / minRequired" to show how many are needed
    // For AND groups, display as "X / total" since all are required
    const displayTotal = groupData.logicalOperator === "OR" ? minRequired : totalChildren
    const displayCompleted = completedCount

    return {
      ...node,
      children: evaluatedChildren,
      isGroupComplete: isComplete,
      groupProgress: {
        completed: displayCompleted,
        total: displayTotal,
        percentage: displayTotal > 0 ? (displayCompleted / displayTotal) * 100 : 0,
      },
    }
  }

  const evaluatedTree = tree.map((node) => evaluateGroup(node))

  // Calculate overall progress based on root-level items only
  const calculateOverallProgress = () => {
    const total = evaluatedTree.length
    const completed = evaluatedTree.filter((node) => {
      if (node.type === "goal") {
        return node.progress?.isComplete
      } else {
        return node.isGroupComplete
      }
    }).length

    return {
      total,
      completed,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  const overallProgress = calculateOverallProgress()

  return (
    <div className="border border-border rounded-lg p-6 shadow-sm transition-all hover:shadow-md bg-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: teamColor }} />
          <h4 className="font-semibold text-lg text-foreground">{teamName}</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {overallProgress.completed} / {overallProgress.total} goals
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {overallProgress.percentage.toFixed(0)}% complete
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {evaluatedTree.map((node) => (
          <ProgressTreeNode
            key={node.id}
            node={node}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

interface ProgressTreeNodeProps {
  node: ProgressNode
  depth: number
}

function ProgressTreeNode({ node, depth }: ProgressTreeNodeProps) {
  const marginLeft = depth * 24

  if (node.type === "group") {
    const groupData = node.data as any
    const hasChildren = node.children && node.children.length > 0

    return (
      <div style={{ marginLeft: `${marginLeft}px` }}>
        <Card
          className={`bg-blue-500/10 border-blue-500/30 transition-all ${
            node.isGroupComplete ? "border-green-500/50 bg-green-500/5" : ""
          }`}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Layers className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Group</span>
                <Badge variant={groupData.logicalOperator === "AND" ? "default" : "secondary"}>
                  {groupData.logicalOperator}
                </Badge>
                {node.isGroupComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {node.groupProgress && (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {node.groupProgress.completed} / {node.groupProgress.total}
                  </div>
                  <div className="w-24">
                    <Progress value={node.groupProgress.percentage} className="h-2" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {hasChildren && (
          <div className="mt-2 space-y-2">
            {node.children!.map((child) => (
              <ProgressTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Goal node
  const goalData = node.data as any
  const progress = node.progress
  const isComplete = progress?.isComplete || false
  const currentValue = progress?.currentValue || 0
  const targetValue = goalData.targetValue
  const percentage = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0
  const isItemGoal = goalData.goalType === "item" && goalData.itemGoal

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      <Card className={isComplete ? "border-green-500/50 bg-green-500/5" : ""}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {isItemGoal ? (
                <div className="flex items-center gap-1.5">
                  <img
                    src={goalData.itemGoal.imageUrl}
                    alt={goalData.itemGoal.baseName}
                    className="h-6 w-6 object-contain flex-shrink-0"
                  />
                  <Badge variant="secondary" className="text-xs h-5 px-1.5 flex-shrink-0">
                    <Package className="h-3 w-3" />
                  </Badge>
                </div>
              ) : (
                <Target className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{goalData.description}</span>
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : currentValue > 0 ? (
                <Circle className="h-4 w-4 text-yellow-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-foreground">
                {currentValue} / {targetValue}
              </div>
              <div className="w-32">
                <AnimatedProgress
                  value={percentage}
                  className="h-2"
                  indicatorClassName={isComplete ? "bg-green-500" : "bg-primary"}
                />
              </div>
              <div className="text-xs text-muted-foreground min-w-[40px] text-right">
                {percentage.toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
