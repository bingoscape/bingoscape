"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/** How groups, ordering and multi-select work; closed until asked for. */
export function GoalsHelp() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 flex items-center gap-1 rounded-sm px-1 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:min-h-11">
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
            open && "rotate-90"
          )}
        />
        How do groups work?
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="bg-muted/50 text-muted-foreground mt-1 list-disc space-y-1 rounded-lg border py-3 pr-3 pl-7 text-sm">
          <li>
            Goals outside any group must all be done. A group makes its own rule
            for the goals inside it.
          </li>
          <li>
            <strong className="text-foreground">AND</strong> needs every goal in
            the group, <strong className="text-foreground">OR</strong> needs at
            least the minimum you set (default 1), and{" "}
            <strong className="text-foreground">SUM</strong> adds up the
            progress of its goals until it reaches the target.
          </li>
          <li>
            Drag a goal onto a group to move it in, or onto another goal to
            reorder.
          </li>
          <li>
            <strong className="text-foreground">Ctrl/Cmd+Click</strong> a goal
            (or focus it and press{" "}
            <strong className="text-foreground">Space</strong>) to select
            several and move them together.
          </li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
