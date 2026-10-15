"use client"

import { memo, useId, useMemo } from "react"
import Image from "next/image"
import {
  ChevronUp,
  CircleDashed,
  Copy,
  PanelRightOpen,
  Plus,
} from "lucide-react"
import { QuickAddBar } from "@/components/goals/quick-add-bar"
import {
  describePendingGoal,
  pendingGoalToNode,
  usePendingGoals,
  type PendingGoal,
} from "@/components/goals/use-pending-goals"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { summarizeGoalCompletion } from "@/lib/goal-summary"
import { buildGoalTree } from "@/lib/goal-tree"
import {
  buildGoalChip,
  buildTreeChips,
  tilePosition,
  type GoalChipData,
} from "@/lib/goal-setup"
import { cn, getOptimizedImageUrl } from "@/lib/utils"
import type { Tile } from "@/types/model"
import { GoalChips } from "./goal-chips"

function pendingChip(pending: PendingGoal): GoalChipData {
  const { description, targetValue, item, metric } =
    describePendingGoal(pending)
  return buildGoalChip({
    key: pending.key,
    goalType: pending.input.type,
    description,
    targetValue,
    itemImageUrl: item?.imageUrl,
    metricType: metric?.metricType,
    metricName: metric?.metricName,
    // Saved goals only wait for the refreshed page; they no longer show a spinner.
    pending: pending.status === "saving",
  })
}

export interface SetupRowProps {
  tile: Tile
  /** Roving tabindex: the one row that is a tab stop of the list. */
  active: boolean
  selected: boolean
  /** The quick-add bar of this row is open. */
  open: boolean
  womLinked: boolean
  onToggleSelect: (tileId: string, checked: boolean, shiftKey: boolean) => void
  onToggleOpen: (tileId: string, open: boolean) => void
  onCopy: (tileId: string) => void
  onOpenTile: (tileId: string) => void
  /** Reload the page data after a goal was saved. */
  onRefresh: () => void
  onOpenTrackerSettings?: () => void
}

/**
 * One Tile of the goal setup list: position, title, a one-line summary of
 * what completes it, its goals as chips, and the actions for it. The row
 * itself is the list's roving focus stop (arrow keys move between rows, see
 * goal-setup-view.tsx); the controls inside it are only tab stops while it is
 * the active row, so Tab does not walk through hundreds of buttons.
 *
 * Goals added from the row's quick-add bar are optimistic, exactly as in the
 * Tile panel (usePendingGoals), and stay visible as pending chips even while
 * the bar is closed.
 */
export const SetupRow = memo(function SetupRow({
  tile,
  active,
  selected,
  open,
  womLinked,
  onToggleSelect,
  onToggleOpen,
  onCopy,
  onOpenTile,
  onRefresh,
  onOpenTrackerSettings,
}: SetupRowProps) {
  const ids = useId()
  const titleId = `${ids}-title`
  const summaryId = `${ids}-summary`
  const barId = `${ids}-bar`

  const tree = useMemo(
    () => buildGoalTree(tile.goals, tile.goalGroups),
    [tile.goals, tile.goalGroups]
  )
  const { pendingGoals, addGoal } = usePendingGoals({
    tileId: tile.id,
    tree,
    onRefresh,
  })

  const chips = useMemo(
    () => [...buildTreeChips(tree), ...pendingGoals.map(pendingChip)],
    [tree, pendingGoals]
  )
  const summary = useMemo(
    () =>
      summarizeGoalCompletion([
        ...tree,
        ...pendingGoals.map(pendingGoalToNode),
      ]),
    [tree, pendingGoals]
  )
  const hasGoals = chips.length > 0
  const tabIndex = active ? 0 : -1

  return (
    <li
      data-setup-row={tile.id}
      data-selected={selected ? "true" : undefined}
      tabIndex={tabIndex}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      className={cn(
        "bg-card focus-visible:ring-ring flex flex-col gap-2 rounded-sm border px-2 py-2 focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset sm:px-3",
        !hasGoals && "bg-muted/20 border-dashed",
        selected && "border-primary/70 bg-primary/5"
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* The label is the touch target: 44px on coarse pointers, the box stays small. */}
        <label className="flex size-6 shrink-0 cursor-pointer items-center justify-center pointer-coarse:size-11">
          <Checkbox
            checked={selected}
            tabIndex={tabIndex}
            aria-label={`Select ${tile.title}`}
            onClick={(event) =>
              onToggleSelect(tile.id, !selected, event.shiftKey)
            }
          />
        </label>
        <div className="flex min-w-0 items-start gap-2">
          {tile.headerImage ? (
            <Image
              unoptimized
              src={getOptimizedImageUrl(tile.headerImage)}
              alt=""
              width={32}
              height={32}
              className="bg-secondary h-8 w-8 shrink-0 rounded-sm object-contain"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2">
              <span className="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">
                {tilePosition(tile)}
              </span>
              <span
                id={titleId}
                className="min-w-0 text-sm font-medium wrap-anywhere"
              >
                {tile.title}
              </span>
            </p>
            <p
              id={summaryId}
              className="text-muted-foreground flex items-start gap-1.5 text-xs"
            >
              {!hasGoals && (
                <CircleDashed
                  aria-hidden="true"
                  className="text-info mt-0.5 h-3.5 w-3.5 shrink-0"
                />
              )}
              <span className="wrap-anywhere">{summary ?? "No goals yet"}</span>
            </p>
          </div>
        </div>

        {hasGoals && (
          <div className="col-span-2 sm:col-span-2 sm:col-start-2">
            <GoalChips chips={chips} label={`Goals of ${tile.title}`} />
          </div>
        )}

        <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:col-start-3 sm:row-start-1">
          <RowActions
            title={tile.title}
            open={open}
            barId={barId}
            tabIndex={tabIndex}
            onToggleOpen={() => onToggleOpen(tile.id, !open)}
            onCopy={() => onCopy(tile.id)}
            onOpenTile={() => onOpenTile(tile.id)}
          />
        </div>
      </div>

      {open && (
        <div
          id={barId}
          role="group"
          aria-label={`Add goals to ${tile.title}`}
          className="@container"
        >
          <QuickAddBar
            onAdd={addGoal}
            womLinked={womLinked}
            onOpenTrackerSettings={onOpenTrackerSettings}
            focusOnMount="force"
          />
        </div>
      )}
    </li>
  )
})

interface RowActionsProps {
  title: string
  open: boolean
  barId: string
  tabIndex: number
  onToggleOpen: () => void
  onCopy: () => void
  onOpenTile: () => void
}

function RowActions({
  title,
  open,
  barId,
  tabIndex,
  onToggleOpen,
  onCopy,
  onOpenTile,
}: RowActionsProps) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        tabIndex={tabIndex}
        aria-expanded={open}
        aria-controls={open ? barId : undefined}
        aria-label={`${open ? "Close the goal form of" : "Add goals to"} ${title}`}
        onClick={onToggleOpen}
      >
        {open ? <ChevronUp aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {open ? "Close" : "Add goals"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        tabIndex={tabIndex}
        aria-label={`Copy goals to ${title} from another tile`}
        onClick={onCopy}
      >
        <Copy aria-hidden="true" />
        Copy from...
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        tabIndex={tabIndex}
        aria-label={`Open ${title} in the tile panel`}
        onClick={onOpenTile}
      >
        <PanelRightOpen aria-hidden="true" />
      </Button>
    </>
  )
}
