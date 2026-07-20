"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Overview", href: "/profile" },
  // { name: "Stats", href: "/profile/stats" },
  // { name: "Settings", href: "/profile/settings" },
  { name: "API Keys", href: "/profile/api-keys" },
]

export function ProfileNavigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-1 mb-8 overflow-x-auto border-b border-border/40 pb-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
