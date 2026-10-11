import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import type React from "react"

import { cn } from "@/lib/utils"

interface StatProps {
  label: string
  value: number | string
  icon?: LucideIcon
  /** Secondary line, e.g. role breakdown. */
  children?: React.ReactNode
  /** Makes the whole tile a link to the (filtered) list behind the number. */
  href?: string
  className?: string
}

/**
 * Compact stat tile. Only link tiles react to hover/focus; static tiles do not
 * lift or animate, so nothing looks clickable that is not.
 */
export function Stat({
  label,
  value,
  icon: Icon,
  children,
  href,
  className,
}: StatProps) {
  const body = (
    <>
      <span className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        {label}
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      </span>
      <span className="osrs-heading text-primary mt-1 block text-2xl">
        {typeof value === "number" ? value.toLocaleString("en-GB") : value}
      </span>
      {children ? (
        <span className="text-muted-foreground mt-1 flex flex-wrap gap-1 text-xs">
          {children}
        </span>
      ) : null}
    </>
  )
  const base = "osrs-panel block rounded-sm p-3"

  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        "hover:bg-accent/40 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none",
        className
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  )
}
