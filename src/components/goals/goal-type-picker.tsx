"use client"

import { useRef } from "react"
import { Target, Package, BarChart2 } from "lucide-react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { cn } from "@/lib/utils"
import { METRIC_GOAL_LABEL } from "@/lib/osrs-metrics"
import type { GoalType } from "./types"

interface GoalTypePickerProps {
  value: GoalType
  /**
   * `viaKeyboard` is true when an arrow key moved the selection; the caller
   * should then leave focus on the radio so the arrow keys keep working.
   */
  onChange: (type: GoalType, options: { viaKeyboard: boolean }) => void
}

/** Item and XP / Kills are the common goals, so they lead and get more room. */
const GOAL_TYPE_OPTIONS = [
  { type: "item", label: "Item", hint: "Drops and items", Icon: Package },
  { type: "metric", label: METRIC_GOAL_LABEL, hint: "Skills and bosses", Icon: BarChart2 },
  { type: "generic", label: "Other", hint: "Custom task", Icon: Target },
] as const

/**
 * Card grid for choosing which kind of Goal to add. A radio group: Tab
 * enters it, the arrow keys move the selection.
 */
export function GoalTypePicker({ value, onChange }: GoalTypePickerProps) {
  const arrowKeyPressed = useRef(false)

  return (
    <div className="space-y-2">
      <p
        id="goal-type-label"
        className="text-sm font-semibold text-foreground"
      >
        Goal type
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby="goal-type-label"
        value={value}
        onKeyDownCapture={(e) => {
          arrowKeyPressed.current = e.key.startsWith("Arrow")
        }}
        onPointerDownCapture={() => {
          arrowKeyPressed.current = false
        }}
        onValueChange={(next) => {
          onChange(next as GoalType, { viaKeyboard: arrowKeyPressed.current })
        }}
        orientation="horizontal"
        className="grid grid-cols-[1fr_1fr_0.8fr] gap-2"
      >
        {GOAL_TYPE_OPTIONS.map(({ type, label, hint, Icon }) => (
          <RadioGroupPrimitive.Item
            key={type}
            value={type}
            aria-label={label}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center transition-colors duration-200",
              "focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
              value === type
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-accent"
            )}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span className="text-sm leading-tight font-semibold">{label}</span>
            <span className="text-[11px] leading-tight font-normal opacity-80">
              {hint}
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  )
}
