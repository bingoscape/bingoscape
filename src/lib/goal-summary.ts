import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { formatNumber } from "@/lib/number-input"
import { getMetricName } from "@/lib/osrs-metrics"

/**
 * One-line, plain-language description of what completes a Tile, derived from
 * its Goal tree with the same rules `evaluateTileCompletion` applies:
 *
 * - everything at the top level must be done (an implicit AND),
 * - an AND group needs all of its children,
 * - an OR group needs at least `minRequiredGoals` of its children,
 * - a SUM group needs its pooled progress to reach `minRequiredGoals`
 *   (a child Goal adds its progress, a child group adds 1 once complete),
 * - a group without children can never be completed.
 */

type GoalKind = "item" | "skill" | "boss" | "activity" | "task" | "group"

const KIND_NOUNS: Record<
  GoalKind,
  readonly [singular: string, plural: string]
> = {
  item: ["item", "items"],
  skill: ["XP goal", "XP goals"],
  boss: ["kill goal", "kill goals"],
  activity: ["activity goal", "activity goals"],
  task: ["task", "tasks"],
  group: ["group", "groups"],
}

const KIND_ORDER: readonly GoalKind[] = [
  "item",
  "skill",
  "boss",
  "activity",
  "task",
  "group",
]

/** Up to this many members are listed by name; more are counted by kind. */
const MAX_NAMED_MEMBERS = 3
/** Counted kinds shown before the rest is folded into "+N more". */
const MAX_COUNTED_KINDS = 3
/** Groups nested deeper than this (the top level is depth 0) are folded into a count. */
const MAX_GROUP_DEPTH = 2
const MAX_NAME_LENGTH = 32

interface GoalLike {
  description?: string
  goalType?: string
  metricGoal?: { metricType?: string; metricName?: string } | null
}

interface GroupLike {
  logicalOperator?: string
  minRequiredGoals?: number
}

function asGoal(node: GoalTreeNode): GoalLike {
  return node.data as GoalLike
}

function goalKind(goal: GoalLike): GoalKind {
  if (goal.goalType === "item") return "item"
  if (goal.goalType === "metric") {
    const metricType = goal.metricGoal?.metricType
    if (metricType === "skill") return "skill"
    if (metricType === "boss") return "boss"
    if (metricType === "activity") return "activity"
  }
  return "task"
}

function truncate(text: string): string {
  return text.length > MAX_NAME_LENGTH
    ? `${text.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…`
    : text
}

/** "Abyssal whip", "Attack XP", "Zulrah kills": how a Goal reads in the sentence. */
function goalName(goal: GoalLike): string {
  const kind = goalKind(goal)
  const description = (goal.description ?? "").replace("#", " ").trim()
  const metricName = goal.metricGoal?.metricName
  const metric = metricName ? getMetricName(metricName) : description

  let name: string
  if (kind === "skill") name = `${metric} XP`
  else if (kind === "boss") name = `${metric} kills`
  else if (kind === "activity") name = metric
  else name = description
  return truncate(name || KIND_NOUNS[kind][0])
}

function nodeKind(node: GoalTreeNode): GoalKind {
  return node.type === "group" ? "group" : goalKind(asGoal(node))
}

function countGoals(nodes: GoalTreeNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total + (node.type === "group" ? countGoals(node.children ?? []) : 1),
    0
  )
}

/** "2 items, 1 XP goal", folding what does not fit into "+N more". */
function describeCounts(nodes: GoalTreeNode[]): string {
  const counts = new Map<GoalKind, number>()
  for (const node of nodes) {
    const kind = nodeKind(node)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }

  const parts = KIND_ORDER.flatMap((kind) => {
    const count = counts.get(kind) ?? 0
    if (count === 0) return []
    const [singular, plural] = KIND_NOUNS[kind]
    return [{ count, text: `${count} ${count === 1 ? singular : plural}` }]
  })

  const shown = parts.slice(0, MAX_COUNTED_KINDS)
  const hidden = parts
    .slice(MAX_COUNTED_KINDS)
    .reduce((total, part) => total + part.count, 0)
  const text = shown.map((part) => part.text).join(", ")
  return hidden > 0 ? `${text} +${hidden} more` : text
}

function describeMembers(nodes: GoalTreeNode[], depth: number): string {
  if (nodes.length > MAX_NAMED_MEMBERS) return describeCounts(nodes)
  return nodes.map((node) => describeMember(node, depth)).join(", ")
}

function describeMember(node: GoalTreeNode, depth: number): string {
  if (node.type === "goal") return goalName(asGoal(node))

  const { lead, body } = describeGroup(node, depth)
  return lead ? `${lead} (${body})` : body
}

/**
 * A group as `lead` ("any 2 of") and `body` (its members). `lead` is null when
 * the group adds no rule of its own: an AND group with one child is that child.
 */
function describeGroup(
  group: GoalTreeNode,
  depth: number
): { lead: string | null; body: string } {
  const children = group.children ?? []
  if (children.length === 0) {
    return { lead: null, body: "an empty group (never completes)" }
  }
  if (depth >= MAX_GROUP_DEPTH) {
    const goals = countGoals(children)
    return {
      lead: null,
      body: `a nested group (${goals} ${goals === 1 ? "goal" : "goals"})`,
    }
  }

  const { logicalOperator, minRequiredGoals } = group.data as GroupLike
  const min = minRequiredGoals || 1
  const body = describeMembers(children, depth + 1)

  if (logicalOperator === "OR") return { lead: `any ${min} of`, body }
  if (logicalOperator === "SUM") {
    return { lead: `a combined total of ${formatNumber(min)} across`, body }
  }
  return children.length === 1 ? { lead: null, body } : { lead: "all of", body }
}

/**
 * What completes the Tile, e.g. "Complete all of: Abyssal whip, any 1 of
 * (Zulrah kills, Vorkath kills)". Returns null for a Tile without Goals.
 */
export function summarizeGoalCompletion(tree: GoalTreeNode[]): string | null {
  const [first, ...rest] = tree
  if (!first) return null

  if (rest.length === 0) {
    if (first.type === "goal") return `Complete: ${goalName(asGoal(first))}`
    const { lead, body } = describeGroup(first, 0)
    return lead ? `Complete ${lead}: ${body}` : `Complete: ${body}`
  }

  return `Complete all of: ${describeMembers(tree, 0)}`
}
