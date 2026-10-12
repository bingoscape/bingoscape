"use client"

import { useId } from "react"
import { CheckCircle2, Minus, Plus, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ShipVisual } from "@/components/ship-visual"
import {
  describeFleetRules,
  presetsForBoard,
  type ShipFleetPreset,
} from "@/lib/ship-fleet-presets"
import {
  mergeShipRulesByLength,
  totalShipTiles,
  validateShipRulesFitBoard,
} from "@/lib/ship-rules"
import type { ShipRule } from "@/server/db/schema"

/** A ship needs at least two tiles; one tile would be a single-tile guess. */
export const MIN_SHIP_LENGTH = 2
export const MAX_SHIP_LENGTH = 10
export const MAX_SHIP_COUNT = 10

interface ShipRulesEditorProps {
  rules: ShipRule[]
  onChange: (rules: ShipRule[]) => void
  /** Board size, to offer presets that fit and to explain whether the fleet fits. */
  board?: { rows: number; columns: number }
  /** Show the fleet but do not allow changes (the event has started). */
  readOnly?: boolean
}

function nextDefaultLength(rules: ShipRule[]): number {
  const used = new Set(rules.map((rule) => rule.length))
  for (let length = MIN_SHIP_LENGTH; length <= MAX_SHIP_LENGTH; length++) {
    if (!used.has(length)) return length
  }
  return MIN_SHIP_LENGTH
}

function sameRules(a: ShipRule[], b: ShipRule[]): boolean {
  const left = mergeShipRulesByLength(a)
  const right = mergeShipRulesByLength(b)
  return (
    left.length === right.length &&
    left.every(
      (rule, i) =>
        rule.length === right[i]?.length && rule.count === right[i]?.count
    )
  )
}

interface NumberStepperProps {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
}

/** A recessed value between two 44px buttons. */
function NumberStepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
  decreaseLabel,
  increaseLabel,
}: NumberStepperProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="osrs-panel-inset inline-flex items-center rounded-sm"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-r-none"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={decreaseLabel}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span className="font-display min-w-8 px-1 text-center text-lg tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-l-none"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={increaseLabel}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )
}

/**
 * Edits the fleet every team has to place: rules of "N ships of length L".
 * Rules with the same length are merged, so the list never holds two entries
 * for one length (the server aggregates per length too).
 */
export function ShipRulesEditor({
  rules,
  onChange,
  board,
  readOnly = false,
}: ShipRulesEditorProps) {
  const headingId = useId()
  const totalShips = rules.reduce((sum, rule) => sum + rule.count, 0)
  const totalTiles = totalShipTiles(rules)
  const boardCells = board ? board.rows * board.columns : null
  const fitError = board
    ? validateShipRulesFitBoard(rules, board.rows, board.columns)
    : null
  const availablePresets = board
    ? presetsForBoard(board.rows, board.columns)
    : []
  const manifest = describeFleetRules(mergeShipRulesByLength(rules))

  const updateRule = (
    index: number,
    field: "length" | "count",
    value: number
  ) => {
    const clamped =
      field === "length"
        ? Math.min(MAX_SHIP_LENGTH, Math.max(MIN_SHIP_LENGTH, value))
        : Math.min(MAX_SHIP_COUNT, Math.max(1, value))
    let next = rules.map((rule, i) =>
      i === index ? { ...rule, [field]: clamped } : rule
    )

    if (field === "length") {
      const duplicateIndex = next.findIndex(
        (rule, i) => i !== index && rule.length === clamped
      )
      if (duplicateIndex >= 0) {
        const duplicate = next[duplicateIndex]!
        next[duplicateIndex] = {
          ...duplicate,
          count: Math.min(MAX_SHIP_COUNT, duplicate.count + next[index]!.count),
        }
        next = mergeShipRulesByLength(next.filter((_, i) => i !== index))
      }
    }

    onChange(next)
  }

  const applyPreset = (preset: ShipFleetPreset) => onChange(preset.rules)

  const addRule = () =>
    onChange([...rules, { length: nextDefaultLength(rules), count: 1 }])

  const removeRule = (index: number) =>
    onChange(rules.filter((_, i) => i !== index))

  const canAddRule =
    !readOnly &&
    new Set(rules.map((rule) => rule.length)).size <
      MAX_SHIP_LENGTH - MIN_SHIP_LENGTH + 1

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <div className="space-y-1">
        <h3 id={headingId} className="osrs-heading text-lg">
          What ships must each team place?
        </h3>
        <p className="text-muted-foreground text-sm">
          Each ship is one straight line of tiles, horizontal or vertical, with
          no gaps. Team leaders place their fleet before the event starts.
        </p>
      </div>

      {!readOnly && board && availablePresets.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Quick start
          </p>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                aria-pressed={sameRules(rules, preset.rules)}
                className="aria-pressed:text-osrs-yellow aria-pressed:osrs-bevel-inset h-auto flex-col items-start gap-0.5 px-3 py-2"
                onClick={() => applyPreset(preset)}
              >
                <span>{preset.label}</span>
                <span className="text-osrs-parchment font-sans text-xs font-normal">
                  {preset.description}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {rules.map((rule, index) => (
          <li key={index} className="osrs-panel space-y-3 rounded-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="osrs-heading text-base">Ship type {index + 1}</p>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="text-danger size-11 shrink-0"
                  onClick={() => removeRule(index)}
                  disabled={rules.length <= 1}
                  aria-label={`Remove ship type ${index + 1}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-muted-foreground">Each team places</span>
              <NumberStepper
                label={`Ships of type ${index + 1}`}
                value={rule.count}
                min={1}
                max={MAX_SHIP_COUNT}
                disabled={readOnly}
                onChange={(value) => updateRule(index, "count", value)}
                decreaseLabel={`Fewer ships of type ${index + 1}`}
                increaseLabel={`More ships of type ${index + 1}`}
              />
              <span className="text-muted-foreground">
                {rule.count === 1 ? "ship" : "ships"}, each
              </span>
              <NumberStepper
                label={`Length of ship type ${index + 1}`}
                value={rule.length}
                min={MIN_SHIP_LENGTH}
                max={MAX_SHIP_LENGTH}
                disabled={readOnly}
                onChange={(value) => updateRule(index, "length", value)}
                decreaseLabel={`Shorter ships of type ${index + 1}`}
                increaseLabel={`Longer ships of type ${index + 1}`}
              />
              <span className="text-muted-foreground">tiles long</span>
            </div>

            <ShipVisual length={rule.length} />
          </li>
        ))}
      </ul>

      {!readOnly && (
        <Button
          type="button"
          className="w-full"
          onClick={addRule}
          disabled={!canAddRule}
        >
          <Plus aria-hidden="true" />
          Add another ship type
        </Button>
      )}

      <div className="osrs-panel-inset space-y-2 rounded-sm p-3">
        <p className="osrs-heading text-base">Fleet summary</p>
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          {manifest.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {board && boardCells !== null && (
          <p className="text-sm">
            {totalShips} {totalShips === 1 ? "ship" : "ships"} covering{" "}
            {totalTiles} {totalTiles === 1 ? "tile" : "tiles"} on a {board.rows}
            ×{board.columns} board ({boardCells} tiles in total)
          </p>
        )}
        {board && (
          <p
            role="status"
            className={
              fitError
                ? "text-danger flex items-start gap-2 text-sm"
                : "text-success flex items-start gap-2 text-sm"
            }
          >
            {fitError ? (
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            )}
            {fitError ??
              `This fleet fits on a ${board.rows}×${board.columns} board`}
          </p>
        )}
      </div>
    </section>
  )
}
