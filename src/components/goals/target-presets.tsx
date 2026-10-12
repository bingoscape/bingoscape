"use client"

import { parseNumberInput } from "@/lib/number-input"
import type { MetricTargetCopy } from "@/lib/osrs-metrics"
import { cn } from "@/lib/utils"

interface TargetPresetsProps {
  copy: MetricTargetCopy
  /** Raw text of the target field; the preset matching it is shown as pressed. */
  value: string
  onSelect: (raw: string) => void
  /** Shorter chip labels ("Level 99" instead of "Level 99 (13,034,431 XP)"). */
  compact?: boolean
}

/** Quick-pick chips for the target of a skill or boss Goal. Renders nothing without presets. */
export function TargetPresets({
  copy,
  value,
  onSelect,
  compact = false,
}: TargetPresetsProps) {
  if (copy.presets.length === 0) return null
  const parsed = parseNumberInput(value)

  return (
    <div
      role="group"
      aria-label={`${copy.targetLabel} presets`}
      className="flex flex-wrap gap-1.5"
    >
      {copy.presets.map((preset) => {
        const active = parsed.kind === "number" && parsed.value === preset.value
        return (
          <button
            key={preset.value}
            type="button"
            aria-pressed={active}
            title={compact ? preset.label : undefined}
            onClick={() => onSelect(String(preset.value))}
            className={cn(
              "focus-visible:ring-ring ring-offset-background inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden motion-reduce:transition-none pointer-coarse:min-h-11",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {compact ? preset.label.replace(/\s*\(.*\)$/, "") : preset.label}
          </button>
        )
      })}
    </div>
  )
}
