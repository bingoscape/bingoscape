import type { GoalTreeNode } from "@/app/actions/goal-groups"
import type { DbGoalGroup, Goal } from "@/types/model"

/**
 * Builds the nested Goal tree (groups and Goals ordered by orderIndex) from the
 * flat lists that the Event page already loads, so the Tile panel needs no
 * client-side fetching. Mirrors `getGoalTree` in goal-groups.ts.
 */
export function buildGoalTree(
  goals: Goal[] | undefined,
  groups: DbGoalGroup[] | undefined
): GoalTreeNode[] {
  const allGoals = goals ?? []
  const allGroups = groups ?? []

  const build = (parentId: string | null): GoalTreeNode[] => {
    const nodes: GoalTreeNode[] = []

    const childGroups = allGroups
      .filter((g) => (g.parentGroupId ?? null) === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
    for (const group of childGroups) {
      nodes.push({
        type: "group",
        id: group.id,
        data: group,
        children: build(group.id),
      })
    }

    const childGoals = allGoals
      .filter((g) => (g.parentGroupId ?? null) === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
    for (const goal of childGoals) {
      nodes.push({
        type: "goal",
        id: goal.id,
        // Goal carries extra relation fields (progress, values); the node
        // shape only needs the base columns plus optional itemGoal.
        data: goal as unknown as Extract<
          GoalTreeNode["data"],
          { description: string }
        >,
      })
    }

    return nodes
  }

  return build(null)
}

export interface GoalProgressEntry {
  goalId: string
  currentValue: number
  isComplete: boolean
}

/** One Team's progress per Goal, from the Goals' loaded teamProgress rows. */
export function getTeamGoalProgress(
  goals: Goal[] | undefined,
  teamId: string
): GoalProgressEntry[] {
  return (goals ?? []).map((goal) => {
    const currentValue =
      goal.teamProgress?.find((p) => p.teamId === teamId)?.currentValue ?? 0
    return {
      goalId: goal.id,
      currentValue,
      isComplete: currentValue >= goal.targetValue,
    }
  })
}
