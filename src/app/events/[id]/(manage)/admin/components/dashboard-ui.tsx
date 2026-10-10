import Link from "next/link"
import { type ReactNode } from "react"

export function StatCard({
  title,
  value,
  icon,
  alert = false,
}: {
  title: string
  value: string | number
  icon: ReactNode
  alert?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-foreground/10 p-4 shadow-xs backdrop-blur-md md:gap-4 md:p-6 ${alert && value && Number(value) > 0 ? "border-warning/50" : "border-border "}`}
    >
      <div
        className={`rounded-sm p-2.5 md:p-3 ${alert && value && Number(value) > 0 ? "bg-warning/10 text-warning " : "bg-primary/10 text-primary"}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground md:text-sm">
          {title}
        </p>
        <h3 className="text-xl font-bold md:text-2xl">{value}</h3>
      </div>
    </div>
  )
}

export function ActionTile({
  href,
  label,
  icon,
  badgeCount,
}: {
  href: string
  label: string
  icon: ReactNode
  badgeCount?: number
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/50 p-6 transition-all hover:scale-[1.02] hover:bg-card hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-primary "
    >
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm bg-destructive text-[10px] font-bold text-destructive-foreground">
          {badgeCount}
        </span>
      )}
      <div className="text-primary [&>svg]:h-8 [&>svg]:w-8">{icon}</div>
      <span className="text-center text-sm font-semibold">{label}</span>
    </Link>
  )
}
