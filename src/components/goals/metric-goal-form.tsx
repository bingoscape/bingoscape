"use client"

import { useState } from "react"
import { getMetricTargetCopy } from "@/lib/osrs-metrics"
import { MetricCombobox } from "./metric-combobox"
import { MetricTypeSwitch } from "./metric-type-switch"
import { NumberField } from "./number-field"
import { SkillGrid } from "./skill-grid"
import { TargetPresets } from "./target-presets"
import type { MetricType } from "./types"
import { WomLinkNotice } from "./wom-link-notice"

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
        <TargetPresets
          copy={copy}
          value={targetValue}
          onSelect={onTargetValueChange}
        />
        <p className="text-muted-foreground text-xs">
          {copy.helper} In a SUM group, this target is illustrative and does not
          cap contributions.
        </p>
      </div>

      {!womLinked && (
        <WomLinkNotice onOpenTrackerSettings={onOpenTrackerSettings} />
      )}
    </div>
  )
}
