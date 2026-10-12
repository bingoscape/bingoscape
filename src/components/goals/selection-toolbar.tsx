"use client"

import { CheckSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SelectionToolbarProps {
  selectedCount: number
  onClear: () => void
}

export function SelectionToolbar({
  selectedCount,
  onClear,
}: SelectionToolbarProps) {
  return (
    <div
      role="status"
      className="rounded-lg border-2 border-info bg-background p-3 animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CheckSquare aria-hidden="true" className="h-5 w-5 text-info" />
          <span className="font-medium text-info">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""}{" "}
            selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            className="h-8 pointer-coarse:min-h-11"
          >
            <X aria-hidden="true" className="mr-1 h-4 w-4" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  )
}
