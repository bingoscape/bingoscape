"use client"

import { TriangleAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMetricTargetCopy } from "@/lib/osrs-metrics"
import { parseNumberInput } from "@/lib/number-input"
import { cn } from "@/lib/utils"
import { MetricSelectItems } from "./metric-select-items"
import { NumberField } from "./number-field"
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
  /** Focus the first field on mount. */
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

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="metric-type" className="text-sm font-medium">
          Track
        </Label>
        <Select
          value={metricType}
          onValueChange={(v) => onMetricTypeChange(v as MetricType)}
        >
          <SelectTrigger id="metric-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {(["skill", "boss", "activity"] as const).map((type) => (
              <SelectItem key={type} value={type}>
                {getMetricTargetCopy(type).typeOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="metric-name" className="text-sm font-medium">
          {copy.nameLabel}
        </Label>
        <Select value={metricName} onValueChange={onMetricNameChange}>
          <SelectTrigger id="metric-name" autoFocus={autoFocus}>
            <SelectValue placeholder={copy.namePlaceholder} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <MetricSelectItems metricType={metricType} />
          </SelectContent>
        </Select>
      </div>

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
