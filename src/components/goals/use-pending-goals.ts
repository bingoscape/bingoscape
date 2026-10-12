"use client"

import { useCallback, useRef, useState } from "react"
import { createGoals, type NewGoalInput } from "@/app/actions/bingo"
import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { getItemDisplayName } from "@/components/osrs-item-option"
import { toast } from "@/hooks/use-toast"
import { getMetricName } from "@/lib/osrs-metrics"

export type AddGoalResult =
  | { success: true }
  | { success: false; error: string }

/**
 * A Goal that was added from the quick-add bar and is not in the tree yet:
 * `saving` while the server action runs, `saved` while the page refresh that
 * delivers the real Goal is on its way.
 */
export interface PendingGoal {
  key: string
  tileId: string
  status: "saving" | "saved"
  /** The real Goal's id, known once saved. */
  goalId?: string
  input: NewGoalInput
}

/** What a pending Goal's row shows. */
export function describePendingGoal(pending: PendingGoal) {
  const { input } = pending
  switch (input.type) {
    case "item":
      return {
        description: getItemDisplayName({ name: input.itemName }),
        targetValue: input.targetValue,
        item: { imageUrl: input.imageUrl, baseName: input.baseName },
        metric: null,
      }
    case "metric":
      return {
        description: getMetricName(input.metricName),
        targetValue: input.targetValue,
        item: null,
        metric: { metricType: input.metricType, metricName: input.metricName },
      }
    case "generic":
      return {
        description: input.description.trim(),
        targetValue: input.targetValue,
        item: null,
        metric: null,
      }
  }
}

/** A pending Goal as a top-level tree node, so tree-wide logic (the summary) can include it. */
export function pendingGoalToNode(pending: PendingGoal): GoalTreeNode {
  const { description, targetValue, metric } = describePendingGoal(pending)
  return {
    type: "goal",
    id: pending.key,
    data: {
      id: pending.key,
      tileId: pending.tileId,
      parentGroupId: null,
      description,
      targetValue,
      goalType: pending.input.type,
      orderIndex: Number.MAX_SAFE_INTEGER,
      // The node type does not declare metricGoal, but every loaded metric Goal has it.
      ...(metric ? { metricGoal: metric } : {}),
    },
  }
}

function treeHasGoal(nodes: GoalTreeNode[], goalId: string): boolean {
  return nodes.some(
    (node) =>
      node.id === goalId ||
      (node.type === "group" && treeHasGoal(node.children ?? [], goalId))
  )
}

interface UsePendingGoalsOptions {
  tileId: string
  /** The saved tree; a pending Goal disappears once its saved twin shows up here. */
  tree: GoalTreeNode[]
  /** Called after a Goal was saved, to load it into the tree. */
  onRefresh: () => void
}

/**
 * Optimistic layer over the Goal tree for adding single top-level Goals.
 * `addGoal` shows the Goal as pending right away, creates it with
 * `createGoals`, and either keeps it until the refreshed tree contains it or
 * takes it back and shows the server's error. Adds are sent one after the
 * other, so Goals land in the order they were added.
 */
export function usePendingGoals({
  tileId,
  tree,
  onRefresh,
}: UsePendingGoalsOptions) {
  const [entries, setEntries] = useState<PendingGoal[]>([])
  const [seenTree, setSeenTree] = useState(tree)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const nextKey = useRef(0)

  const isConfirmed = (entry: PendingGoal, nodes: GoalTreeNode[]) =>
    entry.goalId !== undefined && treeHasGoal(nodes, entry.goalId)

  // The tree changed: forget the Goals it now contains.
  if (tree !== seenTree) {
    setSeenTree(tree)
    setEntries((prev) => {
      const next = prev.filter((entry) => !isConfirmed(entry, tree))
      return next.length === prev.length ? prev : next
    })
  }

  const addGoal = useCallback(
    (input: NewGoalInput): Promise<AddGoalResult> => {
      const key = `pending-${nextKey.current++}`
      setEntries((prev) => [...prev, { key, tileId, status: "saving", input }])

      const remove = () =>
        setEntries((prev) => prev.filter((entry) => entry.key !== key))

      const fail = (error: string): AddGoalResult => {
        remove()
        toast({ title: "Error", description: error, variant: "destructive" })
        return { success: false, error }
      }

      const run = async (): Promise<AddGoalResult> => {
        try {
          const result = await createGoals(tileId, [input], {
            parentGroupId: null,
          })
          if (!result.success) return fail(result.error)

          const goalId = result.goals[0]?.goal?.id
          if (goalId) {
            setEntries((prev) =>
              prev.map((entry) =>
                entry.key === key
                  ? { ...entry, status: "saved", goalId }
                  : entry
              )
            )
          } else {
            remove()
          }
          onRefresh()
          return { success: true }
        } catch (error) {
          console.error("Error adding goal:", error)
          return fail("Failed to add the goal")
        }
      }

      const result = queue.current.then(run)
      queue.current = result
      return result
    },
    [tileId, onRefresh]
  )

  const pendingGoals = entries.filter(
    (entry) => entry.tileId === tileId && !isConfirmed(entry, tree)
  )

  return { pendingGoals, addGoal }
}
