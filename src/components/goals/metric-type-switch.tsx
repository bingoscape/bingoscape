"use client"

import { useId, useRef } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { cn } from "@/lib/utils"
import { getMetricTargetCopy } from "@/lib/osrs-metrics"
import type { MetricType } from "./types"

const METRIC_TYPES: readonly MetricType[] = ["skill", "boss", "activity"]

interface MetricTypeSwitchProps {
  value: MetricType
  /**
   * `viaKeyboard` is true when an arrow key moved the selection; the caller
   * should then leave focus on the switch so the arrow keys keep working.
   */
  onChange: (type: MetricType, options: { viaKeyboard: boolean }) => void
  /** Keeps the "Track" label for screen readers only and trims the height. */
  compact?: boolean
}

/** Segmented control for what to track: a skill, a boss or an activity. */
export function MetricTypeSwitch({
  value,
  onChange,
  compact = false,
}: MetricTypeSwitchProps) {
  const arrowKeyPressed = useRef(false)
  const labelId = useId()

  return (
    <div className={compact ? undefined : "space-y-1.5"}>
      <p
        id={labelId}
        className={cn("text-sm font-medium", compact && "sr-only")}
      >
        Track
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        value={value}
        orientation="horizontal"
        onKeyDownCapture={(e) => {
          arrowKeyPressed.current = e.key.startsWith("Arrow")
        }}
        onPointerDownCapture={() => {
          arrowKeyPressed.current = false
        }}
        onValueChange={(next) =>
          onChange(next as MetricType, { viaKeyboard: arrowKeyPressed.current })
        }
        className="bg-muted grid grid-cols-3 gap-1 rounded-lg border p-1"
      >
        {METRIC_TYPES.map((type) => (
          <RadioGroupPrimitive.Item
            key={type}
            value={type}
            className={cn(
              "flex items-center justify-center rounded-md px-2 text-sm font-medium transition-colors motion-reduce:transition-none pointer-coarse:min-h-11",
              compact ? "min-h-8" : "min-h-9",
              "focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
              "text-muted-foreground hover:text-foreground",
              "data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:border-border data-[state=checked]:border data-[state=checked]:shadow-sm"
            )}
          >
            {getMetricTargetCopy(type).nameLabel}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  )
}
