"use client"

import { Component, Goal } from "lucide-react"

interface DragPreviewProps {
  isGroup: boolean
  /** Number of nodes dragged together; the badge only shows for more than one. */
  selectedCount: number | null
}

export function DragPreview({ isGroup, selectedCount }: DragPreviewProps) {
  return (
    <div className="relative -top-16 max-w-32 rounded-lg border border-border bg-card p-3 opacity-90 shadow-lg 5xl:left-[-12vw]">
      <div className="flex items-center gap-2 text-sm font-medium">
        {isGroup ? (
          <>
            <Component className="mr-2 h-6 w-6" />
            Group
          </>
        ) : (
          <>
            <Goal className="mr-2 h-6 w-6" />
            Goal
          </>
        )}
      </div>
      {selectedCount !== null && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-sm bg-info text-xs font-bold text-info-foreground shadow-md">
          {selectedCount}
        </div>
      )}
    </div>
  )
}
