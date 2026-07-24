"use client"

import Image from "next/image"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Badge } from "@/components/ui/badge"
import { AnimatedProgress } from "@/components/ui/animated-progress"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  ChevronDown,
  ChevronRight,
  BarChart2,
  CheckCheck,
  Shuffle,
  Plus,
} from "lucide-react"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { getWikiIconUrl } from "@/lib/osrs-metrics"
import { useState } from "react"
import { cn } from "@/lib/utils"

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
  inSumGroup?: boolean
  parentGroupTarget?: number
  children?: ProgressNode[]
}

export function GoalProgressTree({
  tree,  teamProgress,
  teamName,
  teamColor,
}: GoalProgressTreeProps) {
  // Track collapsed state for groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

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
    const evaluatedChildren = (node.children || []).map((child) =>
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
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-all hover:shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shadow-xs"
              style={{ backgroundColor: teamColor }}
            />
            <h4 className="text-sm font-semibold text-foreground">
              {teamName}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-muted-foreground">
              {overallProgress.completed} / {overallProgress.total}
            </div>
            <div className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {overallProgress.percentage.toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {evaluatedTree.map((node) => (
            <ProgressTreeNode
              key={node.id}
              node={node}
              depth={0}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}

interface ProgressTreeNodeProps {
  node: ProgressNode
  depth: number
  collapsedGroups: Set<string>
  toggleGroup: (groupId: string) => void
}

function ProgressTreeNode({
  node,
  depth,
  collapsedGroups,
  toggleGroup,
}: ProgressTreeNodeProps) {
  const marginLeft = depth * 8 // Compact 8px indentation per level

  if (node.type === "group") {
    const groupData = node.data as any
    const hasChildren = node.children && node.children.length > 0
    const isCollapsed = collapsedGroups.has(node.id)


    return (
      <div style={{ marginLeft: `${marginLeft}px` }}>
        <Collapsible
          open={!isCollapsed}
          onOpenChange={() => toggleGroup(node.id)}
        >
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1 py-1 px-1.5 rounded-md border-l-2 mb-0.5 cursor-pointer transition-colors",
                groupData.logicalOperator === "AND" ? "border-blue-500 bg-blue-50/30 hover:bg-blue-100/30" : 
                groupData.logicalOperator === "OR" ? "border-purple-500 bg-purple-50/30 hover:bg-purple-100/30" : 
                "border-green-500 bg-green-50/30 hover:bg-green-100/30"
              )}
            >
              {/* Chevron Icon */}
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}

              {/* Group Icon with Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers
                      className={`h-3 w-3 shrink-0 ${node.isGroupComplete ? "text-green-500" : "text-blue-500"}`}
                    />
                    <Badge
                      variant={
                        groupData.logicalOperator === "AND"
                          ? "default"
                          : groupData.logicalOperator === "OR"
                            ? "secondary"
                            : "outline"
                      }
                      className={cn(
                        "h-5 px-1.5 text-[10px] font-medium flex items-center gap-1 shrink-0",
                        groupData.logicalOperator === "SUM" && "bg-green-50 text-green-700 border-green-200"
                      )}
                    >
                      {groupData.logicalOperator === "AND" && (
                        <><CheckCheck className="h-3 w-3" /> Complete All</>
                      )}
                      {groupData.logicalOperator === "OR" && (
                        <><Shuffle className="h-3 w-3" /> Complete Any {groupData.minRequiredGoals || 1}</>
                      )}
                      {groupData.logicalOperator === "SUM" && (
                        <><Plus className="h-3 w-3" /> Combined Total: {groupData.minRequiredGoals || 1}</>
                      )}
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

              {/* Group Name */}
              {groupData.name && (
                <span className="text-[10px] font-medium text-foreground truncate shrink-0 max-w-[100px]">
                  {groupData.name}
                </span>
              )}

              {/* Mini Progress */}
              {node.groupProgress && (
                <div className="flex min-w-[60px] flex-1 items-center justify-end gap-1 ml-auto">
                  <AnimatedProgress
                    value={node.groupProgress.percentage}
                    className="h-1 flex-1 max-w-[60px]"
                  />
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground shrink-0">
                    {node.groupProgress.completed}/{node.groupProgress.total}
                  </span>
                </div>
              )}

              {/* Completion Indicator */}
              {node.isGroupComplete && (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
              )}
            </div>
          </CollapsibleTrigger>

          {/* Collapsible Children */}
          {hasChildren && (
            <CollapsibleContent>
              <div className="mt-1 space-y-1">
                {node.children!.map((child) => (
                  <ProgressTreeNode
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    collapsedGroups={collapsedGroups}
                    toggleGroup={toggleGroup}
                  />
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
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
      <div className="flex items-center gap-1.5 py-1 px-2 my-0.5 rounded-full bg-muted/50 border border-muted/20 hover:bg-muted/80 transition-colors">
        {/* Goal Icon with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-1 min-w-0 items-center gap-1.5 cursor-help">
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
                  <Badge variant="secondary" className="h-3 px-0.5 text-[10px] shrink-0">
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
                    <BarChart2 className="h-3 w-3 shrink-0 text-blue-500" />
                  )}
                  <Badge
                    variant="secondary"
                    className="h-3 px-0.5 text-[10px] uppercase shrink-0"
                  >
                    {metricGoal.metricType}
                  </Badge>
                </>
              ) : (
                <Target className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate text-[10px] font-medium leading-none text-foreground/80">
                {goalData.description}
              </span>
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
        {node.inSumGroup ? (
          <div className="flex shrink-0 items-center justify-end gap-1.5 ml-2">
            <Badge
              variant="outline"
              className="rounded-full border-indigo-200/60 bg-indigo-50/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 shadow-xs dark:bg-indigo-950/50 dark:text-indigo-400"
            >
              +{currentValue}
            </Badge>
            {node.parentGroupTarget && node.parentGroupTarget > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-full border border-slate-200/40 bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0"
              >
                {((currentValue / node.parentGroupTarget) * 100).toFixed(0)}% share
              </Badge>
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-[60px] shrink-0 items-center justify-end gap-1 ml-2">
            <AnimatedProgress
              value={percentage}
              className="h-1 flex-1 max-w-[60px]"
              indicatorClassName={isComplete ? "bg-green-500" : "bg-blue-500"}
            />
            <span className="whitespace-nowrap text-[10px] text-muted-foreground shrink-0">
              {currentValue}/{targetValue}
            </span>
          </div>
        )}

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
