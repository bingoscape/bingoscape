"use client"

import { useId, useRef } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { cn } from "@/lib/utils"
import { getMetricIds, getMetricName, getWikiIconUrl } from "@/lib/osrs-metrics"

/** Wise Old Man's skill ids in the order of the in-game skills tab (overall first). */
const IN_GAME_SKILL_ORDER: readonly string[] = [
  "overall",
  "attack",
  "hitpoints",
  "mining",
  "strength",
  "agility",
  "smithing",
  "defence",
  "herblore",
  "fishing",
  "ranged",
  "thieving",
  "cooking",
  "prayer",
  "crafting",
  "firemaking",
  "magic",
  "fletching",
  "woodcutting",
  "runecrafting",
  "slayer",
  "farming",
  "construction",
  "hunter",
]

/**
 * The skills in tab order. A skill Wise Old Man knows but the list above does
 * not (a new skill) goes last instead of disappearing.
 */
function getOrderedSkills(): string[] {
  const known = new Set(getMetricIds("skill"))
  const ordered = IN_GAME_SKILL_ORDER.filter((skill) => known.has(skill))
  const listed = new Set(ordered)
  return [...ordered, ...getMetricIds("skill").filter((s) => !listed.has(s))]
}

interface SkillGridProps {
  /** The selected skill's Wise Old Man id, or "" when none is selected. */
  value: string
  /**
   * `viaKeyboard` is true when an arrow key moved the selection; the caller
   * should then not move focus away, so the arrow keys keep working.
   */
  onValueChange: (skill: string, options: { viaKeyboard: boolean }) => void
  /** Focus the first skill on mount. */
  autoFocus?: boolean
  /**
   * `grid` (default) lists all skills with a heading; `strip` is a single
   * horizontally scrolling row without heading, for the quick-add bar.
   */
  variant?: "grid" | "strip"
}

/**
 * Single-select grid of skill icons. A radio group: Tab enters it, the arrow
 * keys move the selection. Every skill shows its icon and its name; the
 * selected one also gets a border, a tint and a check mark.
 */
export function SkillGrid({
  value,
  onValueChange,
  autoFocus = false,
  variant = "grid",
}: SkillGridProps) {
  const skills = getOrderedSkills()
  const labelId = useId()
  const arrowKeyPressed = useRef(false)
  const strip = variant === "strip"

  return (
    <div className={strip ? undefined : "space-y-1.5"}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-2",
          strip && "sr-only"
        )}
      >
        <p id={labelId} className="text-sm font-medium">
          Skill
        </p>
        {value && (
          <p className="text-primary truncate text-sm font-medium">
            {getMetricName(value)}
          </p>
        )}
      </div>
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        value={value}
        onKeyDownCapture={(e) => {
          arrowKeyPressed.current = e.key.startsWith("Arrow")
        }}
        onPointerDownCapture={() => {
          arrowKeyPressed.current = false
        }}
        onValueChange={(skill) =>
          onValueChange(skill, { viaKeyboard: arrowKeyPressed.current })
        }
        className={
          strip
            ? "flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain pb-1.5"
            : "grid grid-cols-4 gap-1.5 sm:grid-cols-5"
        }
      >
        {skills.map((skill, index) => {
          const name = getMetricName(skill)
          return (
            <RadioGroupPrimitive.Item
              key={skill}
              value={skill}
              aria-label={name}
              title={name}
              autoFocus={autoFocus && index === 0}
              className={cn(
                "group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border-2 px-0 py-1.5 text-center transition-colors motion-reduce:transition-none",
                "focus-visible:ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
                strip && "w-16 shrink-0 snap-start",
                "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground",
                "data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-foreground"
              )}
            >
              <span className="relative block h-6 w-6 shrink-0">
                <Image
                  fill
                  src={getWikiIconUrl(skill)}
                  alt=""
                  sizes="24px"
                  className="object-contain"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden"
                  }}
                />
              </span>
              <span className="w-full truncate px-0.5 text-[11px] leading-tight tracking-tight">
                {name}
              </span>
              <RadioGroupPrimitive.Indicator className="bg-primary text-primary-foreground absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full">
                <Check aria-hidden="true" className="h-2.5 w-2.5" />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>
    </div>
  )
}
