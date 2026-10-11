import Link from "next/link"

import { cn } from "@/lib/utils"

export interface DetailTab {
  key: string
  label: string
  count?: number
}

interface DetailTabsProps {
  basePath: string
  tabs: DetailTab[]
  active: string
  label?: string
}

/**
 * Section switcher backed by `?tab=`: server-rendered links, so the active
 * section is bookmarkable and only its data is fetched. The first tab is the
 * default and has no query string.
 */
export function DetailTabs({
  basePath,
  tabs,
  active,
  label = "Sections",
}: DetailTabsProps) {
  return (
    <nav aria-label={label} className="mb-4">
      <ul className="osrs-panel-inset inline-flex max-w-full gap-1 overflow-x-auto rounded-sm p-1">
        {tabs.map((tab, index) => {
          const isActive = tab.key === active
          return (
            <li key={tab.key}>
              <Link
                href={index === 0 ? basePath : `${basePath}?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none pointer-coarse:min-h-11",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
                  isActive
                    ? "osrs-btn"
                    : "text-foreground hover:bg-accent/60 hover:text-accent-foreground"
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className="text-xs opacity-80">
                    {tab.count.toLocaleString("en-GB")}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function resolveTab(
  raw: string | string[] | undefined,
  tabs: DetailTab[]
): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return tabs.find((t) => t.key === value)?.key ?? tabs[0]!.key
}
