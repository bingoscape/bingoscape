"use client"

import { Target, Package, BarChart2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { GoalType } from "./types"

interface GoalTypePickerProps {
  value: GoalType
  onChange: (type: GoalType) => void
}

const GOAL_TYPE_OPTIONS = [
  { type: "generic", label: "Generic", Icon: Target },
  { type: "item", label: "Item", Icon: Package },
  { type: "metric", label: "Metric", Icon: BarChart2 },
] as const

/** Card grid for choosing which kind of Goal to add. */
export function GoalTypePicker({ value, onChange }: GoalTypePickerProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold text-foreground">
        Select Goal Type
      </Label>
      <div className="grid grid-cols-3 gap-3">
        {GOAL_TYPE_OPTIONS.map(({ type, label, Icon }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
              value === type
                ? "border-primary bg-primary/5 text-primary shadow-sm"
                : "border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-accent"
            )}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
