"use client"

import { useId } from "react"
import { AlertCircle, Circle, CircleDot } from "lucide-react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { describeNewGoals } from "@/lib/goal-summary"
import { cn } from "@/lib/utils"
import {
  type CombineMode,
  type CombinePlan,
  type CombineState,
} from "./combine-options"

const OPTIONS: ReadonlyArray<{ mode: CombineMode; label: string }> = [
  { mode: "separate", label: "Separate goals" },
  { mode: "all", label: "All of these" },
  { mode: "any", label: "Any one of these" },
  { mode: "atLeast", label: "At least N of these" },
]

interface CombineChoiceProps {
  state: CombineState
  onChange: (state: CombineState) => void
  plan: CombinePlan
  /** The names of the selected items, as the preview lists them. */
  names: string[]
  /** The goals go into an existing group instead of the top level of the tile. */
  nested: boolean
}

/**
 * "How should these count?" for two or more items added at once. A radio
 * group of four choices, the number for "At least N" and a one-line preview
 * of what the choice means. Separate goals is preselected by the parent.
 */
export function CombineChoice({
  state,
  onChange,
  plan,
  names,
  nested,
}: CombineChoiceProps) {
  const ids = useId()
  const labelId = `${ids}-label`
  const inputId = `${ids}-at-least`
  const errorId = `${ids}-error`
  const suffixId = `${ids}-suffix`
  const count = names.length

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-foreground text-sm font-semibold">
        How should these count?
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        value={state.mode}
        onValueChange={(mode) =>
          onChange({ ...state, mode: mode as CombineMode })
        }
        className="grid grid-cols-2 gap-2"
      >
        {OPTIONS.map(({ mode, label }) => {
          const selected = state.mode === mode
          const Icon = selected ? CircleDot : Circle
          return (
            <RadioGroupPrimitive.Item
              key={mode}
              value={mode}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm leading-tight transition-colors motion-reduce:transition-none pointer-coarse:min-h-11",
                "focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
                selected
                  ? "border-primary bg-primary/10 text-foreground font-semibold"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:bg-accent"
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0", selected && "text-primary")}
              />
              {label}
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>

      {state.mode === "atLeast" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor={inputId} className="text-sm font-medium">
            At least
          </Label>
          <Input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={state.atLeast}
            onChange={(event) =>
              onChange({ ...state, atLeast: event.target.value })
            }
            aria-invalid={plan.error !== null}
            aria-describedby={[suffixId, plan.error ? errorId : null]
              .filter(Boolean)
              .join(" ")}
            className={cn(
              "h-9 w-16 text-center tabular-nums",
              plan.error && "border-danger focus-visible:ring-danger"
            )}
          />
          <span id={suffixId} className="text-muted-foreground">
            of {count} items
          </span>
        </div>
      )}

      {plan.error && (
        <p
          id={errorId}
          role="alert"
          className="text-danger flex items-start gap-1.5 text-xs"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-px h-3.5 w-3.5 shrink-0"
          />
          <span>{plan.error}</span>
        </p>
      )}
      <div aria-live="polite">
        {!plan.error && (
          <p className="bg-muted/50 text-foreground rounded-md px-2.5 py-1.5 text-xs wrap-anywhere">
            {describeNewGoals(names, plan.rule, { nested })}
          </p>
        )}
      </div>
    </div>
  )
}
