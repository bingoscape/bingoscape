"use client"

import { useState } from "react"
import { TriangleAlert } from "lucide-react"
import { getMetricTargetCopy } from "@/lib/osrs-metrics"
import { parseNumberInput } from "@/lib/number-input"
import { cn } from "@/lib/utils"
import { MetricCombobox } from "./metric-combobox"
import { MetricTypeSwitch } from "./metric-type-switch"
import { NumberField } from "./number-field"
import { SkillGrid } from "./skill-grid"
import type { MetricType } from "./types"

interface MetricGoalFormProps {
  metricType: MetricType
  onMetricTypeChange: (type: MetricType) => void
  metricName: string
  onMetricNameChange: (name: string) => void
  /** Raw text of the target field. */
  targetValue: string
  onTargetValueChange: (raw: string) => void
  /** Whether the Board has a Wise Old Man competition, which feeds the progress. */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
  /** Focus the skill, boss or activity picker on mount. */
  autoFocus?: boolean
}

/** Skill (XP), boss (kills) and activity goals; progress comes from Wise Old Man. */
export function MetricGoalForm({
  metricType,
  onMetricTypeChange,
  metricName,
  onMetricNameChange,
  targetValue,
  onTargetValueChange,
  womLinked,
  onOpenTrackerSettings,
  autoFocus = true,
}: MetricGoalFormProps) {
  const copy = getMetricTargetCopy(metricType)
  const parsedTarget = parseNumberInput(targetValue)
  // Switching type with the arrow keys leaves focus on the switch so the arrow
  // keys keep working; any other way of switching focuses the new picker.
  const [focusPicker, setFocusPicker] = useState(autoFocus)

  return (
    <div className="space-y-4">
      <MetricTypeSwitch
        value={metricType}
        onChange={(type, { viaKeyboard }) => {
          setFocusPicker(!viaKeyboard)
          onMetricTypeChange(type)
        }}
      />

      {/* Keyed by type so each picker starts fresh (and takes focus) when switched to. */}
      {metricType === "skill" ? (
        <SkillGrid
          key="skill"
          value={metricName}
          onValueChange={onMetricNameChange}
          autoFocus={focusPicker}
        />
      ) : (
        <MetricCombobox
          key={metricType}
          metricType={metricType}
          value={metricName}
          onValueChange={onMetricNameChange}
          autoFocus={focusPicker}
        />
      )}

      <div className="space-y-2">
        <NumberField
          id="metric-target"
          label={copy.targetLabel}
          value={targetValue}
          onValueChange={onTargetValueChange}
          unit={copy.unit}
          unitSingular={copy.unitSingular}
          placeholder={copy.targetPlaceholder}
        />
        {copy.presets.length > 0 && (
          <div
            role="group"
            aria-label={`${copy.targetLabel} presets`}
            className="flex flex-wrap gap-1.5"
          >
            {copy.presets.map((preset) => {
              const active =
                parsedTarget.kind === "number" &&
                parsedTarget.value === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTargetValueChange(String(preset.value))}
                  className={cn(
                    "focus-visible:ring-ring ring-offset-background inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden pointer-coarse:min-h-11",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {copy.helper} In a SUM group, this target is illustrative and does
          not cap contributions.
        </p>
      </div>

      {!womLinked && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-foreground"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-px h-4 w-4 shrink-0 text-warning"
          />
          <p>
            XP and kill progress won&apos;t sync until a Wise Old Man
            competition is linked.{" "}
            {onOpenTrackerSettings && (
              <button
                type="button"
                onClick={onOpenTrackerSettings}
                className="focus-visible:ring-ring rounded-xs font-medium text-primary underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
              >
                Open tracker settings
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
