"use client"

import { useMemo } from "react"
import { CheckCircle2, Minus, Plus, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"
import type { ShipRule } from "@/server/db/schema"

interface ShipRulesEditorProps {
  rules: ShipRule[]
  onChange: (rules: ShipRule[]) => void
  board?: { rows: number; columns: number }
}

function clampShipValue(field: "length" | "count", value: number): number {
  return Math.min(10, Math.max(1, value))
}

function nextDefaultLength(rules: ShipRule[]): number {
  const used = new Set(rules.map((rule) => rule.length))
  for (let length = 2; length <= 10; length++) {
    if (!used.has(length)) return length
  }
  return 2
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-r-none"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={decreaseLabel}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[2rem] px-2 text-center text-lg font-semibold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-l-none"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={increaseLabel}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function ShipRulesEditor({
  rules,
  onChange,
  board,
}: ShipRulesEditorProps) {
  const totalTiles = useMemo(() => totalShipTiles(rules), [rules])
  const totalShips = useMemo(
    () => rules.reduce((sum, rule) => sum + rule.count, 0),
    [rules]
  )
  const boardCells = board ? board.rows * board.columns : null
  const fitError = board
    ? validateShipRulesFitBoard(rules, board.rows, board.columns)
    : null
  const availablePresets = board ? presetsForBoard(board.rows, board.columns) : []
  const manifest = useMemo(() => describeFleetRules(rules), [rules])

  const updateRule = (
    index: number,
    field: "length" | "count",
    value: number
  ) => {
    const clamped = clampShipValue(field, value)
    let next = rules.map((rule, i) =>
      i === index ? { ...rule, [field]: clamped } : rule
    )

    if (field === "length") {
      const duplicateIndex = next.findIndex(
        (rule, i) => i !== index && rule.length === clamped
      )
      if (duplicateIndex >= 0) {
        next[duplicateIndex] = {
          ...next[duplicateIndex]!,
          count: next[duplicateIndex]!.count + next[index]!.count,
        }
        next = next.filter((_, i) => i !== index)
        next = mergeShipRulesByLength(next)
      }
    }

    onChange(next)
  }

  const applyPreset = (preset: ShipFleetPreset) => onChange(preset.rules)

  const addRule = () =>
    onChange([...rules, { length: nextDefaultLength(rules), count: 1 }])

  const removeRule = (index: number) =>
    onChange(rules.filter((_, i) => i !== index))

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label>What ships must each team place?</Label>
        <p className="text-sm text-muted-foreground">
          Each ship is one straight line on the board — horizontal or vertical,
          no gaps. Team leaders place them before the event starts.
        </p>
      </div>

      {board && availablePresets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick start
          </p>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto flex-col items-start gap-0.5 px-3 py-2"
                onClick={() => applyPreset(preset)}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {preset.description}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                Ship type {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRule(index)}
                disabled={rules.length <= 1}
                aria-label={`Remove ship type ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-muted-foreground">Each team places</span>
              <NumberStepper
                value={rule.count}
                min={1}
                max={10}
                onChange={(value) => updateRule(index, "count", value)}
                decreaseLabel="Fewer ships"
                increaseLabel="More ships"
              />
              <span className="text-muted-foreground">
                {rule.count === 1 ? "ship" : "ships"}, each
              </span>
              <NumberStepper
                value={rule.length}
                min={1}
                max={10}
                onChange={(value) => updateRule(index, "length", value)}
                decreaseLabel="Shorter ship"
                increaseLabel="Longer ship"
              />
              <span className="text-muted-foreground">tiles long</span>
            </div>

            <ShipVisual length={rule.length} />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={addRule}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add another ship type
        </Button>
      </div>

      <div
        className={cn(
          "rounded-lg border p-4",
          fitError ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"
        )}
      >
        <p className="mb-2 text-sm font-medium">Fleet summary</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {manifest.map((line, index) => (
            <li key={index}>• {line}</li>
          ))}
        </ul>
        {boardCells !== null && (
          <p className="mt-3 text-sm">
            <span className="font-medium text-foreground">
              {totalShips} ships
            </span>{" "}
            covering{" "}
            <span className="font-medium text-foreground">
              {totalTiles} tiles
            </span>{" "}
            on a {board!.rows}×{board!.columns} board ({boardCells} tiles
            total)
          </p>
        )}
        {fitError ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {fitError}
          </p>
        ) : (
          boardCells !== null && (
            <p className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              This fleet fits on the board
            </p>
          )
        )}
      </div>
    </div>
  )
}
