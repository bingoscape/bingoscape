"use client"

import Image from "next/image"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Badge } from "@/components/ui/badge"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Layers,
  Target,
  CheckCircle2,
  Circle,
  Package,
  BarChart2,
} from "lucide-react"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { getWikiIconUrl } from "@/lib/osrs-metrics"

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
  inSumGroup?: boolean
  parentGroupTarget?: number
  children?: ProgressNode[]
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
  const evaluateGroup = (
    node: GoalTreeNode,
    inSumGroup = false,
    parentGroupTarget = 0
  ): ProgressNode => {
    if (node.type === "goal") {
      const progress = teamProgress.find((p) => p.goalId === node.id)
      return {
        ...node,
        progress,
        inSumGroup,
        parentGroupTarget,
      }
    }

    // It's a group - evaluate children
    const groupData = node.data as any
    const isSumGroup = groupData.logicalOperator === "SUM"
    const sumGroupTarget = isSumGroup
      ? (groupData.minRequiredGoals as number) || 1
      : 0
    const evaluatedChildren = (node.children ?? []).map((child) =>
      evaluateGroup(child, isSumGroup, sumGroupTarget)
    )

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
    let displayTotal = totalChildren
    let displayCompleted = completedCount

    if (groupData.logicalOperator === "AND") {
      isComplete = totalChildren > 0 && completedCount === totalChildren
    } else if (groupData.logicalOperator === "OR") {
      // OR - check if at least minRequiredGoals are complete
      isComplete = completedCount >= minRequired
      displayTotal = minRequired
    } else {
      // SUM
      let sum = 0
      for (const child of evaluatedChildren) {
        if (child.type === "goal") {
          sum += child.progress?.currentValue ?? 0
        } else {
          sum += child.isGroupComplete ? 1 : 0
        }
      }
      isComplete = sum >= minRequired
      displayTotal = minRequired
      displayCompleted = sum
    }

    return {
      ...node,
      children: evaluatedChildren,
      isGroupComplete: isComplete,
      inSumGroup,
      parentGroupTarget,
      groupProgress: {
        completed: displayCompleted,
        total: displayTotal,
        percentage:
          displayTotal > 0 ? (displayCompleted / displayTotal) * 100 : 0,
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

function CompactTreeNode({
  node,
  depth,
  showProgress,
  maxDepth,
}: CompactTreeNodeProps) {
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
                <Layers
                  className={`h-3 w-3 ${node.isGroupComplete ? "text-green-500" : "text-blue-500"}`}
                />
                <Badge
                  variant={
                    groupData.logicalOperator === "AND"
                      ? "default"
                      : "secondary"
                  }
                  className="h-4 px-1 text-[10px]"
                >
                  {groupData.logicalOperator}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                <strong>Group ({groupData.logicalOperator}):</strong>{" "}
                {groupData.logicalOperator === "AND"
                  ? "All goals required"
                  : groupData.logicalOperator === "OR"
                    ? `At least ${groupData.minRequiredGoals || 1} goal(s) required`
                    : `Requires cumulative progress of ${groupData.minRequiredGoals || 1}`}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Mini Progress */}
          {showProgress && node.groupProgress && (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <AnimatedProgress
                value={node.groupProgress.percentage}
                className="h-1 flex-1"
              />
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {node.groupProgress.completed}/{node.groupProgress.total}
              </span>
            </div>
          )}

          {/* Completion Indicator */}
          {node.isGroupComplete && (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
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
  const percentage =
    targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0
  const isItemGoal = goalData.goalType === "item" && goalData.itemGoal
  const itemGoal = goalData.itemGoal
  const isMetricGoal = goalData.goalType === "metric" && goalData.metricGoal
  const metricGoal = goalData.metricGoal

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      <div className="flex items-center gap-1 py-0.5">
        {/* Goal Icon with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex shrink-0 items-center gap-1">
              {isItemGoal && itemGoal ? (
                <>
                  <div className="relative h-4 w-4 shrink-0">
                    <Image
                      fill
                      src={itemGoal.imageUrl}
                      alt={itemGoal.baseName}
                      className="object-cover"
                    />
                  </div>
                  <Badge variant="secondary" className="h-3 px-0.5 text-[10px]">
                    <Package className="h-2.5 w-2.5" />
                  </Badge>
                </>
              ) : isMetricGoal && metricGoal ? (
                <>
                  {metricGoal.metricName ? (
                    <div className="relative h-4 w-4 shrink-0">
                      <Image
                        fill
                        src={getWikiIconUrl(metricGoal.metricName)}
                        alt={metricGoal.metricName}
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    </div>
                  ) : (
                    <BarChart2 className="h-3 w-3 text-blue-500" />
                  )}
                  <Badge
                    variant="secondary"
                    className="h-3 px-0.5 text-[10px] uppercase"
                  >
                    {metricGoal.metricType}
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

        {/* Mini Progress Bar or Contributor View */}
        {showProgress &&
          (node.inSumGroup ? (
            <div className="mr-1 flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <Badge
                variant="outline"
                className="h-3.5 border-indigo-200 bg-indigo-50 px-1 py-0 text-[9px] font-semibold text-indigo-600"
              >
                +{currentValue}
              </Badge>
              {node.parentGroupTarget && node.parentGroupTarget > 0 ? (
                <span className="whitespace-nowrap text-[9px] font-medium text-muted-foreground">
                  ({((currentValue / node.parentGroupTarget) * 100).toFixed(0)}%
                  of target)
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <AnimatedProgress
                value={percentage}
                className="h-1 flex-1"
                indicatorClassName={isComplete ? "bg-green-500" : "bg-blue-500"}
              />
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {currentValue}/{targetValue}
              </span>
            </div>
          ))}

        {/* Completion Indicator */}
        {isComplete ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
        ) : currentValue > 0 ? (
          <Circle className="h-3 w-3 shrink-0 text-yellow-500" />
        ) : (
          <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
