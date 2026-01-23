"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ExportedBingo } from "@/app/actions/bingo-import-export"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Zap } from "lucide-react"
import getRandomFrog from "@/lib/getRandomFrog"

interface TemplatePreviewGridProps {
  templateData: string | null
  className?: string
  isDetailView?: boolean
}

export function TemplatePreviewGrid({
  templateData,
  className,
  isDetailView = false,
}: TemplatePreviewGridProps) {
  const [parsedData, setParsedData] = useState<ExportedBingo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (templateData) {
      try {
        const parsed = JSON.parse(templateData) as ExportedBingo
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional state update from prop parsing
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
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-md bg-muted",
          className
        )}
      >
        <p className="text-muted-foreground">Error loading template preview</p>
      </div>
    )
  }

  if (!parsedData) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-md",
          className
        )}
      >
        <div className="grid h-3/4 w-3/4 grid-cols-3 grid-rows-3 gap-1 opacity-50">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-sm bg-muted-foreground/20" />
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
  const displayTiles = isDetailView
    ? tiles
    : tiles.slice(0, displayRows * displayColumns)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md p-2",
        className,
        isDetailView
          ? "mx-auto aspect-square w-full max-w-[80vh]"
          : "aspect-square"
      )}
    >
      <div
        className="grid h-full w-full gap-1"
        style={{
          gridTemplateColumns: `repeat(${displayColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${displayRows}, minmax(0, 1fr))`,
        }}
      >
        {displayTiles.map((tile, index) => (
          <HoverCard key={index} openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="relative aspect-square cursor-pointer overflow-hidden rounded border border-primary p-4 transition-all hover:scale-105 hover:shadow-md">
                {tile.headerImage ? (
                  <Image
                    src={tile.headerImage || getRandomFrog()}
                    alt={tile.title}
                    fill
                    className="object-scale-down"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary">
                    <span className="truncate px-1 text-[8px] font-semibold text-primary-foreground md:text-xs">
                      {tile.title}
                    </span>
                  </div>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-4" side="right">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{tile.title}</h4>
                  <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/30">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium">
                      {tile.weight} XP
                    </span>
                  </div>
                </div>

                {tile.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {tile.description}
                  </p>
                )}

                {tile.goals && tile.goals.length > 0 && (
                  <div className="pt-2">
                    <h5 className="mb-1 text-xs font-semibold">Goals:</h5>
                    <ul className="space-y-1 text-xs">
                      {tile.goals.map((goal, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {goal.description}
                          </span>
                          <span className="font-medium">
                            Target: {goal.targetValue}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tile.isHidden && (
                  <div className="mt-2 rounded bg-secondary p-1.5 text-xs">
                    <span className="font-medium">Hidden tile</span> - Not
                    visible on the board until revealed
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>

      {/* Show a message if we're not showing the full grid */}
      {!isDetailView && (rows > displayRows || columns > displayColumns) && (
        <div className="absolute bottom-0 right-0 rounded-tl bg-background/80 p-1 text-xs">
          {rows}×{columns} grid
        </div>
      )}
    </div>
  )
}
