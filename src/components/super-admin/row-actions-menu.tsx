"use client"

import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface RowAction {
  key: string
  label: string
  icon?: LucideIcon
  onSelect: () => void
  destructive?: boolean
  /** When set the item is disabled and this explains why. */
  disabledReason?: string
}

interface RowActionsMenuProps {
  /** The row's name; produces the unique accessible name "Actions for <name>". */
  subject: string
  actions: RowAction[]
}

/** One overflow menu per row. Dialogs are rendered by the caller, outside the menu. */
export function RowActionsMenu({ subject, actions }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${subject}`}
          className="h-9 w-9"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action, index) => {
          const Icon = action.icon
          const previous = actions[index - 1]
          return (
            <div key={action.key}>
              {action.destructive && previous && !previous.destructive ? (
                <DropdownMenuSeparator />
              ) : null}
              <DropdownMenuItem
                disabled={Boolean(action.disabledReason)}
                onSelect={action.onSelect}
                className={cn(
                  "min-h-9 flex-wrap",
                  action.destructive && "text-danger focus:text-danger"
                )}
              >
                {Icon ? <Icon aria-hidden="true" /> : null}
                <span>{action.label}</span>
                {action.disabledReason ? (
                  <span className="text-muted-foreground basis-full pl-6 text-xs">
                    {action.disabledReason}
                  </span>
                ) : null}
              </DropdownMenuItem>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
