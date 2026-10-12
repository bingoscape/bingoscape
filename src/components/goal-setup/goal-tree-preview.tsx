"use client"

import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { buildGoalChip, describeGroupRule } from "@/lib/goal-setup"
import { cn } from "@/lib/utils"
import { GoalChips } from "./goal-chips"

interface TreeGoalData {
  description: string
  targetValue: number
  goalType?: string
  itemGoal?: { imageUrl: string } | null
  metricGoal?: { metricType: string; metricName: string } | null
}

interface TreeGroupData {
  name?: string | null
  logicalOperator?: string
  minRequiredGoals?: number
}

function PreviewNodes({
  nodes,
  nested,
}: {
  nodes: readonly GoalTreeNode[]
  nested: boolean
}) {
  return (
    <ul
      role="list"
      className={cn(
        "space-y-1.5",
        nested && "border-border ml-1.5 border-l pl-3"
      )}
    >
      {nodes.map((node) => {
        if (node.type === "group") {
          const group = node.data as TreeGroupData
          const children = node.children ?? []
          return (
            <li key={node.id} className="space-y-1.5">
              <p className="text-sm font-medium">
                {describeGroupRule(group)}
                {group.name ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({group.name})
                  </span>
                ) : null}
                :
              </p>
              {children.length > 0 ? (
                <PreviewNodes nodes={children} nested />
              ) : (
                <p className="text-muted-foreground ml-3 text-xs">
                  An empty group (never completes)
                </p>
              )}
            </li>
          )
        }
        const data = node.data as TreeGoalData
        return (
          <li key={node.id}>
            <GoalChips
              label="Goal"
              max={1}
              chips={[
                buildGoalChip({
                  key: node.id,
                  goalType: data.goalType,
                  description: data.description,
                  targetValue: data.targetValue,
                  itemImageUrl: data.itemGoal?.imageUrl,
                  metricType: data.metricGoal?.metricType,
                  metricName: data.metricGoal?.metricName,
                }),
              ]}
            />
          </li>
        )
      })}
    </ul>
  )
}

interface GoalTreePreviewProps {
  tree: readonly GoalTreeNode[]
  /** Accessible name of the list. */
  label: string
}

/**
 * Read-only view of a goal tree for the copy preview: groups with how they
 * combine their members ("Any 2 of", "All of", ...), nested as deep as they
 * are, and every goal with its target.
 */
export function GoalTreePreview({ tree, label }: GoalTreePreviewProps) {
  return (
    <div role="group" aria-label={label}>
      <PreviewNodes nodes={tree} nested={false} />
    </div>
  )
}
