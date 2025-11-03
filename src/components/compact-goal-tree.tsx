"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Badge } from "@/components/ui/badge"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Layers, Target, CheckCircle2, Circle, Package } from "lucide-react"
import type { GoalTreeNode } from "@/app/actions/goal-groups"

interface TeamProgress {
  goalId: string
  currentValue: number
  isComplete: boolean
}

interface CompactGoalTreeProps {
  tree: GoalTreeNode[]
  teamProgress: TeamProgress[]
  showProgress?: boolean
  maxDepth?: number
  className?: string
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

/**
 * Compact Goal Tree Component for Hovercard Display
 *
 * Features:
 * - Icon-only display with hover tooltips for descriptions
 * - Mini progress bars (4px height)
 * - Item goal support (icon + badge)
 * - Compact spacing (8px indentation per level)
 * - AND/OR badges
 * - Completion indicators
 */
export function CompactGoalTree({
  tree,
  teamProgress,
  showProgress = true,
  maxDepth,
  className = "",
}: CompactGoalTreeProps) {
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
    const evaluatedChildren = (node.children ?? []).map((child) => evaluateGroup(child))

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`space-y-1 ${className}`}>
        {evaluatedTree.map((node) => (
          <CompactTreeNode
            key={node.id}
            node={node}
            depth={0}
            showProgress={showProgress}
            maxDepth={maxDepth}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}

interface CompactTreeNodeProps {
  node: ProgressNode
  depth: number
  showProgress: boolean
  maxDepth?: number
}

function CompactTreeNode({ node, depth, showProgress, maxDepth }: CompactTreeNodeProps) {
  const marginLeft = depth * 8 // 8px per level for compact spacing

  // Don't render beyond maxDepth if specified
  if (maxDepth !== undefined && depth > maxDepth) {
    return null
  }

  if (node.type === "group") {
    const groupData = node.data as any
    const hasChildren = node.children && node.children.length > 0

    return (
      <div style={{ marginLeft: `${marginLeft}px` }}>
        <div className="flex items-center gap-1 py-0.5">
          {/* Group Icon with Tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Layers className={`h-3 w-3 ${node.isGroupComplete ? "text-green-500" : "text-blue-500"}`} />
                <Badge variant={groupData.logicalOperator === "AND" ? "default" : "secondary"} className="text-[10px] h-4 px-1">
                  {groupData.logicalOperator}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                <strong>Group ({groupData.logicalOperator}):</strong>
                {" "}{groupData.logicalOperator === "AND"
                  ? "All goals required"
                  : "Any one goal required"}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Mini Progress */}
          {showProgress && node.groupProgress && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <AnimatedProgress value={node.groupProgress.percentage} className="h-1 flex-1" />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {node.groupProgress.completed}/{node.groupProgress.total}
              </span>
            </div>
          )}

          {/* Completion Indicator */}
          {node.isGroupComplete && (
            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
          )}
        </div>

        {/* Render Children */}
        {hasChildren && (
          <div className="space-y-1">
            {node.children!.map((child) => (
              <CompactTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                showProgress={showProgress}
                maxDepth={maxDepth}
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
  const isComplete = progress?.isComplete ?? false
  const currentValue = progress?.currentValue ?? 0
  const targetValue = goalData.targetValue
  const percentage = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0
  const isItemGoal = goalData.goalType === "item" && goalData.itemGoal
  const itemGoal = goalData.itemGoal

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      <div className="flex items-center gap-1 py-0.5">
        {/* Goal Icon with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 shrink-0">
              {isItemGoal && itemGoal ? (
                <>
                  <img
                    src={itemGoal.imageUrl}
                    alt={itemGoal.baseName}
                    className="h-4 w-4 object-contain"
                  />
                  <Badge variant="secondary" className="text-[10px] h-3 px-0.5">
                    <Package className="h-2.5 w-2.5" />
                  </Badge>
                </>
              ) : (
                <Target className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">
              <strong>{goalData.description}</strong>
              {isItemGoal && itemGoal && (
                <span className="block text-muted-foreground">
                  {itemGoal.baseName}
                  {itemGoal.exactVariant && ` (${itemGoal.exactVariant})`}
                </span>
              )}
              <span className="block text-muted-foreground">
                Target: {targetValue}
              </span>
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Mini Progress Bar */}
        {showProgress && (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <AnimatedProgress
              value={percentage}
              className="h-1 flex-1"
              indicatorClassName={isComplete ? "bg-green-500" : "bg-blue-500"}
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {currentValue}/{targetValue}
            </span>
          </div>
        )}

        {/* Completion Indicator */}
        {isComplete ? (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        ) : currentValue > 0 ? (
          <Circle className="h-3 w-3 text-yellow-500 shrink-0" />
        ) : (
          <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </div>
    </div>
  )
}
