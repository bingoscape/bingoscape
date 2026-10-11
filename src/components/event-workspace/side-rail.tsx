"use client"

import { Info, LayoutGrid, PanelRightOpen, Trophy, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PanelTab } from "@/components/event-workspace/use-workspace-params"

const RAIL_TABS: { value: PanelTab; label: string; icon: LucideIcon }[] = [
  { value: "tile", label: "Tile", icon: LayoutGrid },
  { value: "teams", label: "Teams", icon: Users },
  { value: "prize", label: "Prize", icon: Trophy },
  { value: "info", label: "Info", icon: Info },
]

interface SideRailProps {
  activeTab: PanelTab
  /** Pick a tab; the caller expands the panel. */
  onSelectTab: (tab: PanelTab) => void
  onExpand: () => void
}

/** The collapsed side panel: an icon column that expands on click. */
export function SideRail({ activeTab, onSelectTab, onExpand }: SideRailProps) {
  return (
    <nav
      aria-label="Event details"
      className="flex flex-col items-center gap-1 py-2"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Expand side panel"
        title="Expand side panel (Ctrl/Cmd+\)"
        onClick={onExpand}
      >
        <PanelRightOpen aria-hidden="true" />
      </Button>
      {RAIL_TABS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={value === activeTab ? "secondary" : "ghost"}
          size="icon"
          aria-label={label}
          aria-pressed={value === activeTab}
          title={label}
          onClick={() => onSelectTab(value)}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </nav>
  )
}
