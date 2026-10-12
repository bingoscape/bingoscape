"use client"

import { useId, useRef, useState } from "react"
import { createRememberedChoice } from "@/hooks/use-remembered-choice"
import { parseTargetInput } from "@/lib/number-input"
import { getMetricTargetCopy } from "@/lib/osrs-metrics"
import { buildMetricGoalInput, formatAddedGoal } from "./goal-inputs"
import { MetricCombobox } from "./metric-combobox"
import { MetricTypeSwitch } from "./metric-type-switch"
import { NumberField } from "./number-field"
import {
  InlineError,
  QuickAddButton,
  type QuickAddFormProps,
} from "./quick-add-shared"
import { SkillGrid } from "./skill-grid"
import { TargetPresets } from "./target-presets"
import type { MetricType } from "./types"
import { WomLinkNotice } from "./wom-link-notice"

const METRIC_TYPES: readonly MetricType[] = ["skill", "boss", "activity"]

/** Which of skill, boss and activity was used last, for the next Tile. */
export const rememberedMetricType = createRememberedChoice<MetricType>(
  "bingoscape:goals:quick-add-metric-type",
  METRIC_TYPES,
  "skill"
)

interface QuickAddMetricProps extends QuickAddFormProps {
  /** Whether the Board has a Wise Old Man competition, which feeds the progress. */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
}

/**
 * XP / Kills in one row of choices: a skill from a scrolling icon strip (or a
 * boss or activity from a searchable list), then the target, then Enter.
 */
export function QuickAddMetric({
  onAdd,
  announce,
  womLinked,
  onOpenTrackerSettings,
}: QuickAddMetricProps) {
  const targetId = useId()
  const [metricType, setMetricType] = rememberedMetricType.useValue()
  const [metricName, setMetricName] = useState("")
  const [target, setTarget] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  // Remounts the picker after each add, so it is empty and can take focus again.
  const [pickerVersion, setPickerVersion] = useState(0)
  const [focusPicker, setFocusPicker] = useState(false)
  const targetRef = useRef<HTMLInputElement>(null)

  const copy = getMetricTargetCopy(metricType)
  const noun = copy.nameLabel.toLowerCase()

  const submit = () => {
    if (!metricName) {
      setPickError(`Select ${noun === "activity" ? "an" : "a"} ${noun} first.`)
      return
    }
    const targetValue = parseTargetInput(target)
    if (targetValue === null) {
      setAttempted(true)
      targetRef.current?.focus()
      return
    }

    const input = buildMetricGoalInput(metricType, metricName, targetValue)
    const previous = { metricName, target }
    setMetricName("")
    setTarget("")
    setAttempted(false)
    setPickError(null)
    setFocusPicker(true)
    setPickerVersion((version) => version + 1)

    void onAdd(input).then((result) => {
      if (result.success) {
        announce(`Added ${formatAddedGoal(input)}`)
        return
      }
      // Put back what was chosen, unless the user already started the next one.
      setMetricName((current) => current || previous.metricName)
      setTarget((current) => current || previous.target)
    })
  }

  const handlePick = (name: string, options: { viaKeyboard: boolean }) => {
    setMetricName(name)
    setPickError(null)
    // Arrow keys step through the skills; any other way of picking moves on.
    if (!options.viaKeyboard) targetRef.current?.focus()
  }

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        // Keep the submit from reaching a form further up the React tree.
        event.stopPropagation()
        submit()
      }}
    >
      <MetricTypeSwitch
        compact
        value={metricType}
        onChange={(type, { viaKeyboard }) => {
          setMetricType(type)
          setMetricName("")
          setTarget("")
          setAttempted(false)
          setPickError(null)
          setFocusPicker(!viaKeyboard)
          setPickerVersion((version) => version + 1)
        }}
      />

      {/* Keyed so each picker starts empty (and takes focus after an add). */}
      <div data-quick-add-primary="">
        {metricType === "skill" ? (
          <SkillGrid
            key={`skill-${pickerVersion}`}
            variant="strip"
            value={metricName}
            onValueChange={handlePick}
            autoFocus={focusPicker}
          />
        ) : (
          <MetricCombobox
            key={`${metricType}-${pickerVersion}`}
            metricType={metricType}
            value={metricName}
            onValueChange={(name) => handlePick(name, { viaKeyboard: false })}
            autoFocus={focusPicker}
            focusChangeAfterPick={false}
          />
        )}
      </div>
      {pickError && <InlineError>{pickError}</InlineError>}

      <NumberField
        id={targetId}
        inputRef={targetRef}
        compact
        label={copy.targetLabel}
        value={target}
        onValueChange={setTarget}
        unit={copy.unit}
        unitSingular={copy.unitSingular}
        placeholder={copy.targetPlaceholder}
        forceShowError={attempted}
        action={
          <QuickAddButton label={`Add ${copy.nameLabel.toLowerCase()} goal`} />
        }
      />
      <TargetPresets copy={copy} value={target} onSelect={setTarget} compact />

      {!womLinked && (
        <WomLinkNotice compact onOpenTrackerSettings={onOpenTrackerSettings} />
      )}
    </form>
  )
}
