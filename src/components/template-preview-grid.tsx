"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ExportedBingo } from "@/app/actions/bingo-import-export"

interface TemplatePreviewGridProps {
  templateData: string | null
  title: string
  className?: string
  isDetailView?: boolean
}

export function TemplatePreviewGrid({
  templateData,
  title,
  className,
  isDetailView = false,
}: TemplatePreviewGridProps) {
  const [parsedData, setParsedData] = useState<ExportedBingo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (templateData) {
      try {
        const parsed = JSON.parse(templateData) as ExportedBingo
        setParsedData(parsed)
        setError(null)
      } catch (err) {
        console.error("Error parsing template data:", err)
        setError("Invalid template data")
      }
    }
  }, [templateData])

  if (error) {
    return (
      <div className={cn("relative rounded-md overflow-hidden bg-muted flex items-center justify-center", className)}>
        <p className="text-muted-foreground">Error loading template preview</p>
      </div>
    )
  }

  if (!parsedData) {
    return (
      <div className={cn("relative rounded-md overflow-hidden bg-muted flex items-center justify-center", className)}>
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-3/4 h-3/4 opacity-50">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-muted-foreground/20 rounded-sm" />
          ))}
        </div>
      </div>
    )
  }

  const { metadata, tiles } = parsedData
  const { rows, columns } = metadata

  // For list view, limit the grid size to make it more compact
  const displayRows = isDetailView ? rows : Math.min(rows, 5)
  const displayColumns = isDetailView ? columns : Math.min(columns, 5)

  // If we're limiting the display, only show a subset of tiles
  const displayTiles = isDetailView ? tiles : tiles.slice(0, displayRows * displayColumns)

  return (
    <div
      className={cn(
        "relative rounded-md overflow-hidden bg-muted p-2",
        className,
        isDetailView ? "aspect-square w-full max-w-[80vh] mx-auto" : "aspect-square",
      )}
    >
      <div
        className="grid gap-1 h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${displayColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${displayRows}, minmax(0, 1fr))`,
        }}
      >
        {displayTiles.map((tile, index) => (
          <div key={index} className="border border-primary rounded overflow-hidden aspect-square relative">
            {tile.headerImage ? (
              <Image src={tile.headerImage || "/placeholder.svg"} alt={tile.title} fill className="object-contain" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-[8px] md:text-xs font-semibold truncate px-1">
                  {tile.title}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show a message if we're not showing the full grid */}
      {!isDetailView && (rows > displayRows || columns > displayColumns) && (
        <div className="absolute bottom-0 right-0 bg-background/80 text-xs p-1 rounded-tl">
          {rows}×{columns} grid
        </div>
      )}
    </div>
  )
}

