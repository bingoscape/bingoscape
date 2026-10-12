import type { LucideIcon } from "lucide-react"
import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface BingoTypeCardProps {
  /** Radio group name. */
  name: string
  value: string
  checked: boolean
  onSelect: (value: string) => void
  icon: LucideIcon
  title: string
  description: string
  /** Why the card cannot be chosen. Disables the card and is announced with it. */
  disabledReason?: string
}

/**
 * One option of the board type radio group. A real radio input (visually
 * hidden) sits in a label, so arrow keys, Space and the checked state come
 * from the browser; the card only draws them. The selection is shown with a
 * check mark and a ring, not by colour alone.
 */
export function BingoTypeCard({
  name,
  value,
  checked,
  onSelect,
  icon: Icon,
  title,
  description,
  disabledReason,
}: BingoTypeCardProps) {
  const disabled = disabledReason !== undefined
  const reasonId = `${name}-${value}-reason`

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className={cn(
          "osrs-panel relative flex h-full cursor-pointer flex-col gap-1 rounded-sm p-4 transition-[filter] hover:brightness-110",
          "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid",
          checked && "ring-osrs-yellow ring-2 ring-inset",
          disabled && "cursor-not-allowed opacity-60 hover:brightness-100"
        )}
      >
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          aria-describedby={disabled ? reasonId : undefined}
          onChange={() => onSelect(value)}
          className="sr-only"
        />
        {checked && (
          <CheckCircle2
            aria-hidden="true"
            className="text-success absolute top-2 right-2 size-5"
          />
        )}
        <Icon
          aria-hidden="true"
          className={cn(
            "mb-2 size-8",
            checked ? "text-foreground" : "text-muted-foreground"
          )}
        />
        <span className="osrs-heading text-base">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </label>
      {disabled && (
        <p id={reasonId} className="text-danger text-xs">
          {disabledReason}
        </p>
      )}
    </div>
  )
}
