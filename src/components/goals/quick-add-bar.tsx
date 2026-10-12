"use client"

import { useEffect, useRef, useState } from "react"
import { BarChart2, Package, Target } from "lucide-react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { createRememberedChoice } from "@/hooks/use-remembered-choice"
import { METRIC_GOAL_LABEL } from "@/lib/osrs-metrics"
import { cn } from "@/lib/utils"
import { QuickAddGeneric } from "./quick-add-generic"
import { QuickAddItem } from "./quick-add-item"
import { QuickAddMetric, rememberedMetricType } from "./quick-add-metric"
import { canAutoFocus, type QuickAddFormProps } from "./quick-add-shared"
import type { GoalType } from "./types"

const GOAL_TYPES: readonly GoalType[] = ["item", "metric", "generic"]

/** Which kind of Goal was added last, so the next Tile starts on it. */
const rememberedGoalType = createRememberedChoice<GoalType>(
  "bingoscape:goals:quick-add-type",
  GOAL_TYPES,
  "item"
)

/** Forgets the remembered Goal type and metric type (tests, sign-out). */
export function resetQuickAddMemory() {
  rememberedGoalType.reset()
  rememberedMetricType.reset()
}

const TYPE_OPTIONS = [
  { type: "item", label: "Item", Icon: Package },
  { type: "metric", label: METRIC_GOAL_LABEL, Icon: BarChart2 },
  { type: "generic", label: "Other", Icon: Target },
] as const

/** The form control to focus first: the first one inside an element marked as primary. */
export const QUICK_ADD_PRIMARY_SELECTOR =
  '[data-quick-add-primary] [role="radio"], [data-quick-add-primary] input:not([aria-hidden="true"])'

interface QuickAddBarProps {
  /** Adds one top-level Goal (optimistically); resolves once the server answered. */
  onAdd: QuickAddFormProps["onAdd"]
  /** Whether the Board has a Wise Old Man competition, which feeds XP / Kills progress. */
  womLinked: boolean
  /** Opens the tracker settings, where the competition is linked. */
  onOpenTrackerSettings?: () => void
  /**
   * Focus the main field when the bar appears. `true` only does so when that
   * will not be a surprise (see `canAutoFocus`); `"force"` always does, for a
   * bar the user just asked for.
   */
  focusOnMount?: boolean | "force"
  /** Stronger outline, to make the bar the obvious next step on an empty Tile. */
  prominent?: boolean
}

/**
 * Adds Goals to a Tile in one or two interactions: pick a type, then search
 * and press Enter (Item), pick a skill, type a target and press Enter
 * (XP / Kills), or describe a task (Other). The type is remembered, so a
 * board of one Item Goal per Tile stays on Item.
 */
export function QuickAddBar({
  onAdd,
  womLinked,
  onOpenTrackerSettings,
  focusOnMount = false,
  prominent = false,
}: QuickAddBarProps) {
  const [goalType, setGoalType] = rememberedGoalType.useValue()
  // Read out by screen readers; the key makes a repeated message speak again.
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" })
  const bodyRef = useRef<HTMLDivElement>(null)
  const arrowKeyPressed = useRef(false)
  const focusBodyAfterSwitch = useRef(false)

  const focusPrimaryField = () =>
    bodyRef.current
      ?.querySelector<HTMLElement>(QUICK_ADD_PRIMARY_SELECTOR)
      ?.focus()

  useEffect(() => {
    if (focusOnMount && (focusOnMount === "force" || canAutoFocus())) {
      focusPrimaryField()
    }
  }, [focusOnMount])

  // After a click on another type, move to its main field. Arrow keys leave
  // focus on the switch so they keep working.
  useEffect(() => {
    if (!focusBodyAfterSwitch.current) return
    focusBodyAfterSwitch.current = false
    focusPrimaryField()
  }, [goalType])

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ id: previous.id + 1, text }))

  const formProps = { onAdd, announce }

  return (
    <div
      role="search"
      aria-label="Add a goal"
      className={cn(
        "bg-card space-y-2 rounded-lg border p-2 @sm:p-3",
        prominent && "border-primary/60 ring-primary/30 ring-1"
      )}
    >
      <RadioGroupPrimitive.Root
        aria-label="Goal type"
        value={goalType}
        orientation="horizontal"
        onKeyDownCapture={(event) => {
          arrowKeyPressed.current = event.key.startsWith("Arrow")
        }}
        onPointerDownCapture={() => {
          arrowKeyPressed.current = false
        }}
        onValueChange={(next) => {
          focusBodyAfterSwitch.current = !arrowKeyPressed.current
          setGoalType(next as GoalType)
        }}
        className="bg-muted grid grid-cols-[1fr_1.3fr_1fr] gap-1 rounded-lg border p-1"
      >
        {TYPE_OPTIONS.map(({ type, label, Icon }) => (
          <RadioGroupPrimitive.Item
            key={type}
            value={type}
            className={cn(
              "flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors motion-reduce:transition-none pointer-coarse:min-h-11",
              "focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
              "text-muted-foreground hover:text-foreground",
              "data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:border-border data-[state=checked]:border data-[state=checked]:shadow-sm"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>

      <div ref={bodyRef}>
        {goalType === "item" && <QuickAddItem {...formProps} />}
        {goalType === "metric" && (
          <QuickAddMetric
            {...formProps}
            womLinked={womLinked}
            onOpenTrackerSettings={onOpenTrackerSettings}
          />
        )}
        {goalType === "generic" && <QuickAddGeneric {...formProps} />}
      </div>

      <div aria-live="polite" className="sr-only">
        <span key={announcement.id}>{announcement.text}</span>
      </div>
    </div>
  )
}
