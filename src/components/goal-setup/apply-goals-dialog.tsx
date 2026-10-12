"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react"
import {
  applyGoalsToTiles,
  type GoalBatchResult,
  type GoalBatchSource,
} from "@/app/actions/goal-batch"
import { formatAddedGoal } from "@/components/goals/goal-inputs"
import {
  QUICK_ADD_PRIMARY_SELECTOR,
  QuickAddBar,
} from "@/components/goals/quick-add-bar"
import type { AddGoalResult } from "@/components/goals/use-pending-goals"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { NewGoalInput } from "@/app/actions/bingo"
import { summarizeGoalCompletion } from "@/lib/goal-summary"
import { MAX_GOALS_PER_BATCH, validateBatchSize } from "@/lib/goal-validation"
import { buildGoalTree } from "@/lib/goal-tree"
import {
  countGoalTree,
  describeBatchConfirmation,
  describeBatchResult,
  formatGoalCounts,
  pluralize,
  tilePosition,
} from "@/lib/goal-setup"
import { GoalTreePreview } from "./goal-tree-preview"
import { TileSourcePicker } from "./tile-source-picker"
import type { Tile } from "@/types/model"

export type ApplyMode = "goals" | "copy"
type Step = "choose" | "confirm" | "done"

/** Tiles listed in the confirmation before the list scrolls. */
const TILE_LIST_HEIGHT = "max-h-28"

interface ApplyGoalsDialogProps {
  bingoId: string
  /** The Tiles that receive the goals, in Board order. */
  targets: readonly Tile[]
  /** Every listed Tile, to pick a copy source from. */
  allTiles: readonly Tile[]
  /** What the user may choose between; a single mode hides the switch. */
  modes: readonly ApplyMode[]
  initialMode: ApplyMode
  womLinked: boolean
  onOpenTrackerSettings?: () => void
  /** The dialog was closed (Cancel, Done, Escape). */
  onClose: () => void
  /** The server created the goals; the page data is stale now. */
  onApplied: () => void
}

function tileLabel(tile: Tile): string {
  return `${tile.title} (tile ${tilePosition(tile)})`
}

/**
 * Puts goals on several Tiles in one go: either new goals added with the
 * quick-add bar, or the whole goal set of another Tile. Three steps: choose,
 * check (exactly what is added to how many Tiles), result. The request is one
 * all-or-nothing server call, so a failure leaves every Tile as it was and the
 * dialog stays on the check step, ready to try again.
 *
 * Goals are only ever added after what a Tile already has; there is no
 * "replace" here on purpose (see applyGoalsToTiles).
 */
export function ApplyGoalsDialog({
  bingoId,
  targets,
  allTiles,
  modes,
  initialMode,
  womLinked,
  onOpenTrackerSettings,
  onClose,
  onApplied,
}: ApplyGoalsDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const firstStep = useRef(true)

  const [mode, setMode] = useState<ApplyMode>(initialMode)
  const [step, setStep] = useState<Step>("choose")
  const [staged, setStaged] = useState<NewGoalInput[]>([])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Extract<
    GoalBatchResult,
    { success: true }
  > | null>(null)

  const targetIds = useMemo(
    () => new Set(targets.map((tile) => tile.id)),
    [targets]
  )
  const sources = useMemo(
    () =>
      allTiles.filter(
        (tile) => (tile.goals?.length ?? 0) > 0 && !targetIds.has(tile.id)
      ),
    [allTiles, targetIds]
  )
  const source = sources.find((tile) => tile.id === sourceId) ?? null
  const sourceTree = useMemo(
    () => (source ? buildGoalTree(source.goals, source.goalGroups) : []),
    [source]
  )
  const sourceCounts = useMemo(() => countGoalTree(sourceTree), [sourceTree])
  const tilesWithGoals = targets.filter(
    (tile) => (tile.goals?.length ?? 0) > 0
  ).length

  // Moves focus to the new step so it is not left on a button that is gone.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    stepRef.current?.focus()
  }, [step])

  const stageGoal = async (input: NewGoalInput): Promise<AddGoalResult> => {
    setStaged((previous) =>
      previous.length >= MAX_GOALS_PER_BATCH ? previous : [...previous, input]
    )
    setError(null)
    return { success: true }
  }

  const rowsPerTile =
    mode === "goals" ? staged.length : sourceCounts.goals + sourceCounts.groups

  const review = () => {
    if (mode === "goals" && staged.length === 0) {
      setError("Add at least one goal first.")
      return
    }
    if (mode === "copy" && !source) {
      setError("Choose a tile to copy the goals from.")
      return
    }
    const sizeError = validateBatchSize(targets.length, rowsPerTile)
    if (sizeError) {
      setError(sizeError)
      return
    }
    setError(null)
    setStep("confirm")
  }

  const apply = async () => {
    const request: GoalBatchSource =
      mode === "goals"
        ? { kind: "goals", goals: staged }
        : { kind: "copy", sourceTileId: source?.id ?? "" }

    setSaving(true)
    setError(null)
    try {
      const response = await applyGoalsToTiles(
        bingoId,
        targets.map((tile) => tile.id),
        request
      )
      if (!response.success) {
        setError(response.error)
        return
      }
      setResult(response)
      setStep("done")
      onApplied()
    } catch (caught) {
      console.error("Error applying goals:", caught)
      setError("Could not reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const plan =
    mode === "goals"
      ? ({ kind: "goals", goalLabels: staged.map(formatAddedGoal) } as const)
      : ({
          kind: "copy",
          sourceLabel: source ? tileLabel(source) : "",
          goals: sourceCounts.goals,
          groups: sourceCounts.groups,
        } as const)
  const confirmation = describeBatchConfirmation(
    plan,
    targets.length,
    tilesWithGoals
  )

  const singleTarget = targets.length === 1 ? targets[0] : undefined
  const title =
    step === "done"
      ? "Goals added"
      : step === "confirm"
        ? "Check before adding"
        : singleTarget
          ? `Copy goals to ${singleTarget.title}`
          : `Apply a goal to ${targets.length} selected tiles`

  const chooseGoals = (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Add the goals once; each one is added to every selected tile.
      </p>
      <div className="@container">
        <QuickAddBar
          onAdd={stageGoal}
          womLinked={womLinked}
          onOpenTrackerSettings={onOpenTrackerSettings}
        />
      </div>
      {staged.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            To add ({pluralize(staged.length, "goal")})
          </p>
          <ul role="list" aria-label="Goals to add" className="space-y-1">
            {staged.map((input, index) => {
              const text = formatAddedGoal(input)
              return (
                <li
                  key={`${index}-${text}`}
                  className="bg-muted/40 flex items-center justify-between gap-2 rounded-sm border px-2 py-1 text-sm"
                >
                  <span className="min-w-0 wrap-anywhere">{text}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`Remove ${text}`}
                    onClick={() =>
                      setStaged((previous) =>
                        previous.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )

  const chooseCopy = (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Pick a tile; its goals (groups included) are copied to{" "}
        {singleTarget ? "this tile" : "every selected tile"}. Progress is never
        copied.
      </p>
      <TileSourcePicker
        tiles={sources}
        value={sourceId}
        onChange={(id) => {
          setSourceId(id)
          setError(null)
        }}
      />
      {source && (
        <div className="bg-muted/30 space-y-2 rounded-sm border p-3">
          <p className="text-sm font-medium">
            Goals of {tileLabel(source)}:{" "}
            {formatGoalCounts(sourceCounts.goals, sourceCounts.groups)}
          </p>
          <p className="text-muted-foreground text-xs">
            {summarizeGoalCompletion(sourceTree)}
          </p>
          <GoalTreePreview
            tree={sourceTree}
            label={`Goals that will be copied from ${source.title}`}
          />
        </div>
      )}
    </div>
  )

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // A save in flight cannot be taken back, so keep the result in view.
        if (!next && !saving) onClose()
      }}
    >
      <DialogContent
        ref={contentRef}
        className="max-w-2xl p-4 sm:p-6"
        onEscapeKeyDown={(event) => {
          // Escape in the item search empties it (the search handles that);
          // it should not also close the dialog.
          const target = event.target as HTMLInputElement | null
          if (target?.matches?.('[role="combobox"]') && target.value !== "") {
            event.preventDefault()
          }
        }}
        onOpenAutoFocus={(event) => {
          // Start in the main field, but not on touch screens: the on-screen
          // keyboard would cover the dialog before anything was asked.
          if (window.matchMedia?.("(pointer: coarse)")?.matches) return
          const field = contentRef.current?.querySelector<HTMLElement>(
            `${QUICK_ADD_PRIMARY_SELECTOR}, [data-autofocus]`
          )
          if (!field) return
          event.preventDefault()
          field.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "choose"
              ? "Nothing changes until you have checked it on the next step."
              : step === "confirm"
                ? "Nothing has been changed yet."
                : "The board is updating."}
          </DialogDescription>
        </DialogHeader>

        <div ref={stepRef} tabIndex={-1} className="space-y-3 outline-hidden">
          {step === "choose" &&
            (modes.length > 1 ? (
              <Tabs
                value={mode}
                onValueChange={(next) => {
                  setMode(next as ApplyMode)
                  setError(null)
                }}
              >
                <TabsList className="grid h-auto min-h-10 w-full grid-cols-2 pointer-coarse:min-h-11">
                  <TabsTrigger value="goals">New goals</TabsTrigger>
                  <TabsTrigger value="copy">
                    Copy a tile&apos;s goals
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="goals" className="mt-3">
                  {chooseGoals}
                </TabsContent>
                <TabsContent value="copy" className="mt-3">
                  {chooseCopy}
                </TabsContent>
              </Tabs>
            ) : modes[0] === "copy" ? (
              chooseCopy
            ) : (
              chooseGoals
            ))}

          {step === "confirm" && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{confirmation.headline}</p>
              {mode === "goals" ? (
                <ul
                  role="list"
                  aria-label="Goals to add"
                  className="list-disc space-y-0.5 pl-5 text-sm"
                >
                  {plan.kind === "goals" &&
                    plan.goalLabels.map((text, index) => (
                      <li key={`${index}-${text}`} className="wrap-anywhere">
                        {text}
                      </li>
                    ))}
                </ul>
              ) : (
                source && (
                  <GoalTreePreview
                    tree={sourceTree}
                    label={`Goals that will be copied from ${source.title}`}
                  />
                )
              )}
              <p className="text-muted-foreground text-sm">
                {confirmation.note}
              </p>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {pluralize(targets.length, "tile")}
                </p>
                <ul
                  role="list"
                  aria-label="Tiles that will change"
                  className={`${TILE_LIST_HEIGHT} flex flex-wrap gap-1 overflow-y-auto`}
                >
                  {targets.map((tile) => (
                    <li
                      key={tile.id}
                      className="bg-muted/50 max-w-full truncate rounded-sm border px-1.5 py-0.5 text-xs"
                    >
                      {tilePosition(tile)}. {tile.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div
              role="status"
              className="flex items-start gap-2 text-sm"
              data-testid="apply-result"
            >
              <CheckCircle2
                aria-hidden="true"
                className="text-success mt-0.5 h-4 w-4 shrink-0"
              />
              <p>{describeBatchResult(result)}</p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-danger flex items-start gap-1.5 text-sm"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                {step === "confirm" ? `Nothing was changed. ${error}` : error}
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          {step === "choose" && (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={review}>
                Review
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setError(null)
                  setStep("choose")
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={saving}
                aria-busy={saving}
                onClick={() => void apply()}
              >
                {saving && (
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                )}
                {saving
                  ? "Adding..."
                  : `Add to ${pluralize(targets.length, "tile")}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
