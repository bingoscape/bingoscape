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
    <div className="rounded-lg border-2 border-info bg-background p-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-info" />
          <span className="font-medium text-info">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""}{" "}
            selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="h-8"
          >
            <X className="mr-1 h-4 w-4" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  )
}
