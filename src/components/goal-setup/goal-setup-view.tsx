"use client"

import { useCallback, useId, useMemo, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react"
import { QUICK_ADD_PRIMARY_SELECTOR } from "@/components/goals/quick-add-bar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { lacksGoals } from "@/lib/board-health"
import {
  getSetupTiles,
  mergeIds,
  pluralize,
  pruneSelection,
  updateSelection,
} from "@/lib/goal-setup"
import type { Tile } from "@/types/model"
import { ApplyGoalsDialog, type ApplyMode } from "./apply-goals-dialog"
import { SetupRow } from "./setup-row"

interface DialogState {
  targetIds: readonly string[]
  modes: readonly ApplyMode[]
  initialMode: ApplyMode
  /** The targets are the current selection, which is done with once applied. */
  clearsSelection: boolean
}

interface GoalSetupViewProps {
  bingoId: string
  tiles: Tile[]
  /** Whether the Board has a Wise Old Man competition (feeds XP / Kills progress). */
  womLinked: boolean
  /** Back to the Board. */
  onBack: () => void
  /** Show the Tile in the side panel. */
  onOpenTile: (tileId: string) => void
  /** Reload the page data (goals were saved). */
  onRefresh: () => void
  onOpenTrackerSettings?: () => void
}

/**
 * Board-level goal setup: every Tile as a row, so an organiser can go down
 * the Board adding goals, copy a Tile's goals to another, or put the same goal
 * on a selection of Tiles, without opening Tiles one by one.
 *
 * Structure: a labelled list. The rows are its roving focus stops: one Tab
 * stop for the whole list; Up/Down/Home/End move between rows, Enter opens the
 * row's quick-add bar and puts the cursor in it, Space selects the row, and
 * Escape inside the bar closes it and returns to the row. A list (not a grid)
 * because the rows are cards with several controls rather than a table of
 * cells; each row is named by its title and described by its summary.
 *
 * Rendering: all rows are plain DOM. A board has at most about a hundred
 * Tiles and a closed row is a handful of elements, so there is no windowing;
 * the heavy part (the quick-add bar) exists for one row at a time.
 */
export function GoalSetupView({
  bingoId,
  tiles,
  womLinked,
  onBack,
  onOpenTile,
  onRefresh,
  onOpenTrackerSettings,
}: GoalSetupViewProps) {
  const ids = useId()
  const hintId = `${ids}-hint`
  const filterId = `${ids}-filter`
  const listRef = useRef<HTMLUListElement>(null)
  const anchorRef = useRef<string | null>(null)

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [onlyMissing, setOnlyMissing] = useState(false)
  // Tiles that lacked goals while the filter was on. They stay in the list
  // after they got goals, so a row does not vanish under the cursor.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const { rows, hiddenCount } = useMemo(() => getSetupTiles(tiles), [tiles])
  const missingIds = useMemo(
    () => new Set(rows.filter(lacksGoals).map((tile) => tile.id)),
    [rows]
  )

  if (onlyMissing) {
    const merged = mergeIds(pinned, missingIds)
    if (merged !== pinned) setPinned(merged)
  }
  const rowIds = useMemo(() => new Set(rows.map((tile) => tile.id)), [rows])
  const pruned = pruneSelection(selected, rowIds)
  if (pruned !== selected) setSelected(pruned)

  const visibleRows = useMemo(
    () =>
      onlyMissing
        ? rows.filter((tile) => missingIds.has(tile.id) || pinned.has(tile.id))
        : rows,
    [onlyMissing, rows, missingIds, pinned]
  )
  const visibleIds = useMemo(
    () => visibleRows.map((tile) => tile.id),
    [visibleRows]
  )
  const tabbableId =
    activeId && visibleIds.includes(activeId) ? activeId : visibleIds[0]

  const focusRow = useCallback((tileId: string | undefined) => {
    if (!tileId) return
    const rowElement = Array.from(listRef.current?.children ?? []).find(
      (child) => (child as HTMLElement).dataset.setupRow === tileId
    )
    ;(rowElement as HTMLElement | undefined)?.focus()
  }, [])

  const handleToggleSelect = useCallback(
    (tileId: string, checked: boolean, shiftKey: boolean) => {
      setSelected((previous) =>
        updateSelection(
          previous,
          visibleIds,
          tileId,
          checked,
          shiftKey ? anchorRef.current : null
        )
      )
      anchorRef.current = tileId
    },
    [visibleIds]
  )

  const handleToggleOpen = useCallback((tileId: string, open: boolean) => {
    setOpenId(open ? tileId : null)
    setActiveId(tileId)
  }, [])

  const openCopy = useCallback((tileId: string) => {
    setDialog({
      targetIds: [tileId],
      modes: ["copy"],
      initialMode: "copy",
      clearsSelection: false,
    })
  }, [])

  const handleToggleFilter = (checked: boolean) => {
    setOnlyMissing(checked)
    setPinned(checked ? new Set(missingIds) : new Set())
  }

  const selectedTiles = rows.filter((tile) => selected.has(tile.id))
  const dialogTargets = dialog
    ? rows.filter((tile) => dialog.targetIds.includes(tile.id))
    : []

  const closeDialog = () => {
    setDialog(null)
    // The button that opened the dialog may be gone (the selection is cleared
    // once applied); do not leave the keyboard on nothing.
    window.setTimeout(() => {
      const active = document.activeElement
      if (!active || active === document.body) focusRow(tabbableId)
    }, 50)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.defaultPrevented) return
    const target = event.target as HTMLElement
    const rowElement = target.closest<HTMLElement>("[data-setup-row]")
    const tileId = rowElement?.dataset.setupRow
    if (!rowElement || !tileId) return

    // Escape inside the open quick-add bar: close it and go back to the row.
    if (event.key === "Escape" && target !== rowElement) {
      // The item search empties itself on its first Escape.
      if (
        target.matches('[role="combobox"]') &&
        (target as HTMLInputElement).value !== ""
      ) {
        return
      }
      if (openId !== tileId) return
      event.preventDefault()
      setOpenId(null)
      rowElement.focus()
      return
    }
    if (target !== rowElement) return

    const index = visibleIds.indexOf(tileId)
    const moveTo = (next: number) => {
      event.preventDefault()
      const nextId =
        visibleIds[Math.max(0, Math.min(visibleIds.length - 1, next))]
      setActiveId(nextId ?? null)
      focusRow(nextId)
    }

    switch (event.key) {
      case "ArrowDown":
        return moveTo(index + 1)
      case "ArrowUp":
        return moveTo(index - 1)
      case "Home":
        return moveTo(0)
      case "End":
        return moveTo(visibleIds.length - 1)
      case "Enter": {
        event.preventDefault()
        if (openId === tileId) {
          // Already open: just put the cursor back into the bar.
          rowElement
            .querySelector<HTMLElement>(QUICK_ADD_PRIMARY_SELECTOR)
            ?.focus()
        } else {
          setOpenId(tileId)
        }
        return
      }
      case " ": {
        event.preventDefault()
        handleToggleSelect(tileId, !selected.has(tileId), event.shiftKey)
        return
      }
      case "Escape": {
        if (openId === tileId) {
          event.preventDefault()
          setOpenId(null)
        }
        return
      }
    }
  }

  const missingCount = missingIds.size

  return (
    <section
      aria-label="Goal setup"
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back to board
        </Button>
        <h3 className="osrs-heading text-base">Set up goals</h3>
        <p className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
          {missingCount > 0 ? (
            <>
              <CircleDashed
                aria-hidden="true"
                className="text-info h-3.5 w-3.5"
              />
              {missingCount} of {pluralize(rows.length, "tile")}{" "}
              {missingCount === 1 ? "has" : "have"} no goals
            </>
          ) : (
            <>
              <CheckCircle2
                aria-hidden="true"
                className="text-success h-3.5 w-3.5"
              />
              Every tile has goals
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id={filterId}
            checked={onlyMissing}
            onCheckedChange={handleToggleFilter}
          />
          <Label htmlFor={filterId} className="text-sm">
            Only tiles without goals
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={missingCount === 0}
          onClick={() => {
            setSelected(new Set(missingIds))
            anchorRef.current = null
          }}
        >
          Select all without goals
        </Button>
        <p
          id={hintId}
          className="text-muted-foreground text-xs pointer-coarse:hidden"
        >
          Up and Down move between tiles. Enter adds goals, Space selects,
          Escape closes the form.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleRows.length === 0 ? (
          <p
            role="status"
            className="text-muted-foreground flex items-center gap-2 rounded-sm border border-dashed p-4 text-sm"
          >
            <CheckCircle2 aria-hidden="true" className="text-success h-4 w-4" />
            {rows.length === 0
              ? "This board has no tiles to set up."
              : "Every tile has goals."}
          </p>
        ) : (
          <ul
            ref={listRef}
            role="list"
            aria-label="Tiles"
            aria-describedby={hintId}
            className="space-y-1.5"
            onKeyDown={handleKeyDown}
            onFocus={(event) => {
              const rowId = (event.target as HTMLElement).closest<HTMLElement>(
                "[data-setup-row]"
              )?.dataset.setupRow
              if (rowId) setActiveId(rowId)
            }}
          >
            {visibleRows.map((tile) => (
              <SetupRow
                key={tile.id}
                tile={tile}
                active={tile.id === tabbableId}
                selected={selected.has(tile.id)}
                open={openId === tile.id}
                womLinked={womLinked}
                onToggleSelect={handleToggleSelect}
                onToggleOpen={handleToggleOpen}
                onCopy={openCopy}
                onOpenTile={onOpenTile}
                onRefresh={onRefresh}
                onOpenTrackerSettings={onOpenTrackerSettings}
              />
            ))}
          </ul>
        )}
        {hiddenCount > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            {pluralize(hiddenCount, "hidden tile")} not listed. Reveal a hidden
            tile to set up its goals.
          </p>
        )}
      </div>

      {selectedTiles.length > 0 && (
        <div className="bg-card sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2 shadow-md">
          <p role="status" className="text-sm font-medium">
            {pluralize(selectedTiles.length, "tile")} selected
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(new Set())
              anchorRef.current = null
            }}
          >
            Clear selection
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={() =>
              setDialog({
                targetIds: selectedTiles.map((tile) => tile.id),
                modes: ["goals", "copy"],
                initialMode: "goals",
                clearsSelection: true,
              })
            }
          >
            Apply a goal to selected tiles
          </Button>
        </div>
      )}

      {dialog && (
        <ApplyGoalsDialog
          bingoId={bingoId}
          targets={dialogTargets}
          allTiles={rows}
          modes={dialog.modes}
          initialMode={dialog.initialMode}
          womLinked={womLinked}
          onOpenTrackerSettings={onOpenTrackerSettings}
          onClose={closeDialog}
          onApplied={() => {
            onRefresh()
            if (dialog.clearsSelection) {
              setSelected(new Set())
              anchorRef.current = null
            }
          }}
        />
      )}
    </section>
  )
}
