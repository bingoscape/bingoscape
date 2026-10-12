import type { GoalTreeNode } from "@/app/actions/goal-groups"
import { formatNumber } from "@/lib/number-input"
import { getMetricName, getMetricTargetCopy } from "@/lib/osrs-metrics"

/**
 * Pure helpers behind the board-level goal setup view: which Tiles are
 * listed, searching them, range selection, goal chips, and the plain-language
 * sentences of the confirmation and result steps.
 */

interface SetupTile {
  index: number
  isHidden: boolean
}

/** 1-based position of a Tile on the Board, as people count them. */
export function tilePosition(tile: Pick<SetupTile, "index">): number {
  return tile.index + 1
}

/**
 * The Tiles the setup view lists, in Board order. Hidden Tiles are left out
 * (they are placeholders until revealed, see board-health.ts); their number is
 * returned so the view can say that they exist.
 */
export function getSetupTiles<T extends SetupTile>(
  tiles: readonly T[]
): { rows: T[]; hiddenCount: number } {
  const ordered = [...tiles].sort((a, b) => a.index - b.index)
  const rows = ordered.filter((tile) => !tile.isHidden)
  return { rows, hiddenCount: ordered.length - rows.length }
}

/**
 * Whether a Tile matches what was typed in a Tile picker: part of the title
 * (any case), or the position ("7" or "#7"). A number also matches titles
 * that contain it ("99 Slayer"). An empty query matches everything.
 */
export function matchesTileQuery(
  tile: { index: number; title: string },
  query: string
): boolean {
  const needle = query.trim().toLowerCase().replace(/^#/, "")
  if (needle === "") return true
  if (/^\d+$/.test(needle) && Number(needle) === tilePosition(tile)) return true
  return tile.title.toLowerCase().includes(needle)
}

/** The ids from `anchorId` to `targetId` (both included) in list order. */
export function idsBetween(
  orderedIds: readonly string[],
  anchorId: string,
  targetId: string
): string[] {
  const from = orderedIds.indexOf(anchorId)
  const to = orderedIds.indexOf(targetId)
  if (from < 0 || to < 0) return [targetId]
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1)
}

/**
 * The selection after clicking `targetId`'s checkbox. With an anchor (shift
 * click) the whole range from the anchor to the target is set to `checked`;
 * otherwise only the target is. Returns a new Set.
 */
export function updateSelection(
  selected: ReadonlySet<string>,
  orderedIds: readonly string[],
  targetId: string,
  checked: boolean,
  anchorId: string | null
): Set<string> {
  const next = new Set(selected)
  const ids = anchorId ? idsBetween(orderedIds, anchorId, targetId) : [targetId]
  for (const id of ids) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

/** `selected` without ids that are no longer listed; the same Set when nothing changed. */
export function pruneSelection(
  selected: ReadonlySet<string>,
  validIds: ReadonlySet<string>
): ReadonlySet<string> {
  let changed = false
  const next = new Set<string>()
  for (const id of selected) {
    if (validIds.has(id)) next.add(id)
    else changed = true
  }
  return changed ? next : selected
}

/** `current` plus `extra`; the same Set when `extra` adds nothing new. */
export function mergeIds(
  current: ReadonlySet<string>,
  extra: Iterable<string>
): ReadonlySet<string> {
  let next: Set<string> | null = null
  for (const id of extra) {
    if (current.has(id)) continue
    next ??= new Set(current)
    next.add(id)
  }
  return next ?? current
}

/** How many goals and groups a goal tree holds. */
export function countGoalTree(nodes: readonly GoalTreeNode[]): {
  goals: number
  groups: number
} {
  let goals = 0
  let groups = 0
  for (const node of nodes) {
    if (node.type === "group") {
      groups++
      const inner = countGoalTree(node.children ?? [])
      goals += inner.goals
      groups += inner.groups
    } else {
      goals++
    }
  }
  return { goals, groups }
}

export type GoalChipKind = "item" | "metric" | "task" | "group"

/** What a goal chip of a Tile row shows. */
export interface GoalChipData {
  key: string
  kind: GoalChipKind
  label: string
  /** "x1", "50 kills", "13,034,431 XP"; null for a group. */
  target: string | null
  imageUrl?: string
  /** Added from the row's quick-add and not saved yet. */
  pending?: boolean
}

interface GoalChipParts {
  key: string
  goalType?: string
  description: string
  targetValue: number
  itemImageUrl?: string | null
  metricType?: string | null
  metricName?: string | null
  pending?: boolean
}

/** A chip for one goal; the same for saved goals and pending ones. */
export function buildGoalChip(parts: GoalChipParts): GoalChipData {
  const { key, targetValue, pending } = parts
  const target = formatNumber(targetValue)
  const description = parts.description.replace("#", " ").trim()

  if (parts.goalType === "metric" && parts.metricName) {
    const copy = getMetricTargetCopy(parts.metricType ?? "skill")
    const unit = targetValue === 1 ? copy.unitSingular : copy.unit
    return {
      key,
      kind: "metric",
      label: getMetricName(parts.metricName),
      target: `${target}${unit ? ` ${unit}` : ""}`,
      pending,
    }
  }
  if (parts.goalType === "item") {
    return {
      key,
      kind: "item",
      label: description,
      target: `x${target}`,
      imageUrl: parts.itemImageUrl ?? undefined,
      pending,
    }
  }
  return {
    key,
    kind: "task",
    label: description,
    target: `x${target}`,
    pending,
  }
}

interface TreeGoalData {
  description: string
  targetValue: number
  goalType?: string
  itemGoal?: { imageUrl: string } | null
  metricGoal?: { metricType: string; metricName: string } | null
}

interface TreeGroupData {
  logicalOperator?: string
  minRequiredGoals?: number
}

/** "All of 3", "Any 2 of 4", "Total 1,000 across 2": a group chip's label. */
export function describeGroupChip(
  group: TreeGroupData,
  goalCount: number
): string {
  const min = group.minRequiredGoals || 1
  if (group.logicalOperator === "OR") return `Any ${min} of ${goalCount}`
  if (group.logicalOperator === "SUM") {
    return `Total ${formatNumber(min)} across ${goalCount}`
  }
  return `All of ${goalCount}`
}

/** "All of", "Any 2 of", "A combined total of 1,000 across": how a group combines its members. */
export function describeGroupRule(group: TreeGroupData): string {
  const min = group.minRequiredGoals || 1
  if (group.logicalOperator === "OR") return `Any ${min} of`
  if (group.logicalOperator === "SUM") {
    return `A combined total of ${formatNumber(min)} across`
  }
  return "All of"
}

/** One chip per top-level goal or group of a Tile's goal tree. */
export function buildTreeChips(tree: readonly GoalTreeNode[]): GoalChipData[] {
  return tree.map((node) => {
    if (node.type === "group") {
      return {
        key: node.id,
        kind: "group" as const,
        label: describeGroupChip(
          node.data as TreeGroupData,
          countGoalTree(node.children ?? []).goals
        ),
        target: null,
      }
    }
    const data = node.data as TreeGoalData
    return buildGoalChip({
      key: node.id,
      goalType: data.goalType,
      description: data.description,
      targetValue: data.targetValue,
      itemImageUrl: data.itemGoal?.imageUrl,
      metricType: data.metricGoal?.metricType,
      metricName: data.metricGoal?.metricName,
    })
  })
}

/** "1 goal", "3 goals". */
export function pluralize(
  count: number,
  one: string,
  many = `${one}s`
): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "4 goals and 2 groups", "3 goals". */
export function formatGoalCounts(goals: number, groups: number): string {
  return groups > 0
    ? `${pluralize(goals, "goal")} and ${pluralize(groups, "group")}`
    : pluralize(goals, "goal")
}

export type BatchPlan =
  | { kind: "goals"; goalLabels: readonly string[] }
  | {
      kind: "copy"
      /** "Fire cape (tile 3)". */
      sourceLabel: string
      goals: number
      groups: number
    }

/**
 * What is about to happen, in words: `headline` states exactly what is added
 * to how many tiles, `note` says what happens to goals the tiles already have
 * (nothing: new goals are always added after them).
 */
export function describeBatchConfirmation(
  plan: BatchPlan,
  tileCount: number,
  tilesWithGoals: number
): { headline: string; note: string } {
  const each = tileCount > 1 ? `each of ${tileCount} tiles` : "1 tile"

  let headline: string
  if (plan.kind === "goals") {
    const count = plan.goalLabels.length
    headline = `Add ${pluralize(count, "goal")} to ${each}`
    if (tileCount > 1) {
      headline += ` (${pluralize(count * tileCount, "new goal")} in total)`
    }
  } else {
    headline = `Copy the goals of ${plan.sourceLabel} to ${each}: ${formatGoalCounts(plan.goals, plan.groups)}`
    if (tileCount > 1) {
      headline += ` per tile (${formatGoalCounts(plan.goals * tileCount, plan.groups * tileCount)} in total)`
    }
  }

  let note: string
  if (tilesWithGoals === 0) {
    note =
      tileCount === 1
        ? "This tile has no goals yet."
        : "None of these tiles has goals yet."
  } else {
    const who =
      tilesWithGoals === tileCount
        ? tileCount === 1
          ? "This tile already has goals"
          : "All of these tiles already have goals"
        : `${tilesWithGoals} of these tiles already ${tilesWithGoals === 1 ? "has" : "have"} goals`
    note = `${who}. They keep them; the new goals are added after them. Nothing is replaced or removed.`
  }

  return { headline: `${headline}.`, note }
}

/** "Created 10 goals on 5 tiles." */
export function describeBatchResult(result: {
  tilesUpdated: number
  goalsCreated: number
  groupsCreated: number
}): string {
  const created =
    result.groupsCreated > 0
      ? formatGoalCounts(result.goalsCreated, result.groupsCreated)
      : pluralize(result.goalsCreated, "goal")
  return `Created ${created} on ${pluralize(result.tilesUpdated, "tile")}.`
}
