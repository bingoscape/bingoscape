"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, LayoutDashboard, Shield, Users } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    href: "/super-admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/super-admin/users", label: "Users", icon: Users },
  { href: "/super-admin/clans", label: "Clans", icon: Shield },
  { href: "/super-admin/events", label: "Events", icon: Calendar },
] as const

/**
 * Section navigation. A left rail from `lg`, a four-up strip below that.
 * The current section carries `aria-current="page"` (also for detail pages
 * inside the section) and a non-colour cue (bevel + bar).
 */
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Super admin" className="lg:w-56 lg:shrink-0">
      <p className="text-muted-foreground mb-2 hidden px-3 text-xs font-medium tracking-wider uppercase lg:block">
        Super admin
      </p>
      <ul className="osrs-panel grid grid-cols-4 gap-1 p-1 lg:flex lg:flex-col lg:gap-1 lg:p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
                  active
                    ? "osrs-bevel-inset border-border bg-accent text-accent-foreground lg:border-l-primary lg:border-l-4"
                    : "text-foreground hover:bg-accent/60 hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
