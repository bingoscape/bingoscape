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
      className={`flex items-center gap-3 rounded-2xl border bg-white/10 p-4 shadow-xs backdrop-blur-md dark:bg-black/10 md:gap-4 md:p-6 ${alert && value && Number(value) > 0 ? "border-amber-500/50" : "border-slate-200 dark:border-slate-800"}`}
    >
      <div
        className={`rounded-full p-2.5 md:p-3 ${alert && value && Number(value) > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500" : "bg-primary/10 text-primary"}`}
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
      className="relative flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/50 p-6 transition-all hover:scale-[1.02] hover:bg-white hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-primary dark:border-slate-800 dark:bg-black/20 dark:hover:bg-black/40"
    >
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {badgeCount}
        </span>
      )}
      <div className="text-primary [&>svg]:h-8 [&>svg]:w-8">{icon}</div>
      <span className="text-center text-sm font-semibold">{label}</span>
    </Link>
  )
}
