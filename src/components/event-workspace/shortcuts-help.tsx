"use client"

import { useEffect, useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  isDialogOpen,
  isTypingTarget,
} from "@/components/event-workspace/keyboard"

interface Shortcut {
  keys: string[]
  label: string
}

interface ShortcutsHelpProps {
  /** More than one Board: `[` and `]` switch between them. */
  hasMultipleBoards: boolean
  /** The side panel can be collapsed (desktop, signed-in view). */
  canCollapsePanel: boolean
}

export function getShortcuts({
  hasMultipleBoards,
  canCollapsePanel,
}: ShortcutsHelpProps): Shortcut[] {
  return [
    { keys: ["←", "↑", "↓", "→"], label: "Move between Tiles" },
    { keys: ["Home", "End"], label: "First / last Tile in the row" },
    { keys: ["Enter", "Space"], label: "Open the focused Tile" },
    { keys: ["Esc"], label: "Close the Tile" },
    ...(hasMultipleBoards
      ? [{ keys: ["[", "]"], label: "Previous / next Board" }]
      : []),
    ...(canCollapsePanel
      ? [{ keys: ["Ctrl/⌘", "\\"], label: "Collapse the side panel" }]
      : []),
    { keys: ["Ctrl/⌘", "/"], label: "Show this list" },
  ]
}

/** Keyboard shortcut cheat sheet; also opens with Ctrl/Cmd+/. */
export function ShortcutsHelp(props: ShortcutsHelpProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || !(event.ctrlKey || event.metaKey)) return
      if (event.altKey || event.shiftKey || event.defaultPrevented) return
      if (isTypingTarget(event.target) || isDialogOpen()) return
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 lg:inline-flex"
          aria-keyshortcuts="Control+/ Meta+/"
          title="Keyboard shortcuts (Ctrl/⌘+/)"
        >
          <Keyboard aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Keyboard shortcuts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <h3 className="osrs-heading text-foreground mb-2 text-sm">
          Keyboard shortcuts
        </h3>
        <dl className="flex flex-col gap-2 text-sm">
          {getShortcuts(props).map(({ keys, label }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex shrink-0 gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}
