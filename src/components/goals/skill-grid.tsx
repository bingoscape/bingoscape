"use client"

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
  onValueChange: (skill: string) => void
  /** Focus the first skill on mount. */
  autoFocus?: boolean
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
}: SkillGridProps) {
  const skills = getOrderedSkills()

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p id="skill-grid-label" className="text-sm font-medium">
          Skill
        </p>
        {value && (
          <p className="text-primary truncate text-sm font-medium">
            {getMetricName(value)}
          </p>
        )}
      </div>
      <RadioGroupPrimitive.Root
        aria-labelledby="skill-grid-label"
        value={value}
        onValueChange={onValueChange}
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
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
