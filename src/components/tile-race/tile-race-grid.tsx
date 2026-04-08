"use client"

import React, { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Tile, Bingo } from "@/app/actions/events"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, Save } from "lucide-react"
import { BingoTile } from "@/components/bingo-tile"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import {
  updateTile,
  deleteTile,
  createTileAtPosition,
} from "@/app/actions/bingo"

export interface TileRaceGridProps {
  tiles: Tile[]
  columns: number
  rows: number
  userRole?: string
  currentTeamId?: string
  onTileClick?: (tile: Tile) => void
  isLocked?: boolean
  bingo?: Bingo
  currentTileIndex?: number
  onTilesUpdated?: () => void
  isEditMode?: boolean
}

export function TileRaceGrid({
  tiles = [],
  columns = 5,
  rows = 5,
  userRole,
  currentTeamId,
  onTileClick,
  isLocked,
  bingo,
  currentTileIndex,
  onTilesUpdated,
  isEditMode = false,
}: TileRaceGridProps) {
  const [isEditing, setIsEditing] = useState(isEditMode)
  const isManagement = userRole === "admin" || userRole === "management"

  const gridRef = useRef<HTMLDivElement>(null)
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 })

  // Sync isEditing with parent's edit mode
  useEffect(() => {
    setIsEditing(isEditMode)
  }, [isEditMode])

  // We use local state to maintain UI responsiveness while server actions run
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles)

  useEffect(() => {
    setLocalTiles(tiles)
  }, [tiles])

  useEffect(() => {
    if (!gridRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(gridRef.current)
    return () => observer.disconnect()
  }, [])

  // Filter out tiles that are not placed on the board, and sort them
  const sortedTiles = localTiles
    .filter((t) => t.gridX != null && t.gridY != null)
    .sort((a, b) => {
      const idxA = a.index !== null && a.index !== undefined ? a.index : 0
      const idxB = b.index !== null && b.index !== undefined ? b.index : 0
      return idxA - idxB
    })

  const handleCreateTile = async (x: number, y: number) => {
    if (!bingo) return
    try {
      const result = await createTileAtPosition(bingo.id, x, y)
      if (result.success && "tile" in result && result.tile) {
        const newTile: Tile = {
          ...result.tile,
          goals: [],
          teamTileSubmissions: [],
        }
        setLocalTiles((prev) => [...prev, newTile])
        onTilesUpdated?.()
        toast({
          title: "Tile created",
          description: "A new tile has been added to the board.",
        })
      } else {
        toast({
          title: "Error",
          description:
            ("error" in result ? result.error : undefined) ||
            "Failed to create tile",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create tile",
        variant: "destructive",
      })
    }
  }

  const handleUpdateTile = async (tileId: string, updates: Partial<Tile>) => {
    try {
      const result = await updateTile(tileId, updates)
      if (result.success) {
        setLocalTiles((prev) =>
          prev.map((t) => (t.id === tileId ? { ...t, ...updates } : t))
        )
        onTilesUpdated?.()
        toast({
          title: "Tile updated",
          description: "Successfully updated tile.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update tile",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update tile",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTile = async (tileId: string) => {
    if (!bingo) return
    if (!confirm("Are you sure you want to delete this tile?")) return
    try {
      const result = await deleteTile(tileId, bingo.id)
      if (result.success) {
        setLocalTiles((prev) => prev.filter((t) => t.id !== tileId))
        onTilesUpdated?.()
        toast({
          title: "Tile deleted",
          description: "Successfully deleted tile.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete tile",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete tile",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {isManagement && (
        <div className="flex justify-end">
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "default" : "outline"}
            className="gap-2"
          >
            <Edit2 className="h-4 w-4" />
            {isEditing ? "Exit Edit Mode" : "Edit Board"}
          </Button>
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-xl border bg-muted/20"
        ref={gridRef}
      >
        {/* SVG overlay for path lines */}
        {gridSize.width > 0 && gridSize.height > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Normal paths between tiles in sequence */}
            {sortedTiles.map((tile, i) => {
              if (i === sortedTiles.length - 1) return null
              const nextTile = sortedTiles[i + 1]

              if (
                tile.gridX == null ||
                tile.gridY == null ||
                nextTile?.gridX == null ||
                nextTile?.gridY == null
              )
                return null

              const x1 = ((tile.gridX + 0.5) / columns) * gridSize.width
              const y1 = ((tile.gridY + 0.5) / rows) * gridSize.height
              const x2 = ((nextTile.gridX + 0.5) / columns) * gridSize.width
              const y2 = ((nextTile.gridY + 0.5) / rows) * gridSize.height

              return (
                <g key={`line-${tile.id}-${nextTile.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    strokeWidth="3"
                    className="stroke-current text-primary/40"
                    strokeDasharray="6 6"
                  />
                  <circle cx={x2} cy={y2} r="5" className="fill-primary/60" />
                </g>
              )
            })}

            {/* Jump paths (Chutes and Ladders) */}
            {sortedTiles.map((tile) => {
              if (!tile.jumpToIndex || tile.index === tile.jumpToIndex)
                return null

              const targetTile = sortedTiles.find(
                (t) => t.index === tile.jumpToIndex
              )
              if (
                !targetTile ||
                tile.gridX == null ||
                tile.gridY == null ||
                targetTile.gridX == null ||
                targetTile.gridY == null
              )
                return null

              const isLadder = tile.jumpToIndex > (tile.index ?? 0)
              const strokeColor = isLadder ? "text-green-500" : "text-red-500"

              const x1 = ((tile.gridX + 0.5) / columns) * gridSize.width
              const y1 = ((tile.gridY + 0.5) / rows) * gridSize.height
              const x2 = ((targetTile.gridX + 0.5) / columns) * gridSize.width
              const y2 = ((targetTile.gridY + 0.5) / rows) * gridSize.height

              // Simple curve: we use a quadratic bezier.
              // Calculate a control point that bows out perpendicular to the line between the two points.
              const cx = (x1 + x2) / 2
              const cy = (y1 + y2) / 2
              const dx = x2 - x1
              const dy = y2 - y1
              // Orthogonal vector
              const nx = -dy
              const ny = dx
              // Normalize
              const len = Math.sqrt(nx * nx + ny * ny) || 1
              // Bow out distance, e.g., 20 pixels
              const dist = 30
              const curveX = cx + (nx / len) * dist
              const curveY = cy + (ny / len) * dist

              return (
                <g key={`jump-${tile.id}`}>
                  <path
                    d={`M ${x1} ${y1} Q ${curveX} ${curveY}, ${x2} ${y2}`}
                    fill="transparent"
                    strokeWidth="4"
                    className={cn("stroke-current", strokeColor, "opacity-75")}
                    strokeDasharray="8 4"
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r="6"
                    className={cn("fill-current", strokeColor)}
                  />
                </g>
              )
            })}
          </svg>
        )}

        {/* Actual Grid */}
        <div
          className={cn(
            "relative z-10 grid w-full gap-2 p-2 sm:gap-3 sm:p-3 md:gap-4 md:p-4",
            `grid-cols-${columns}`
          )}
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: rows * columns }).map((_, i) => {
            const x = i % columns
            const y = Math.floor(i / columns)
            const tile = localTiles.find((t) => t.gridX === x && t.gridY === y)
            const isCurrent = tile && tile.index === currentTileIndex

            const sequence = tile
              ? sortedTiles.findIndex((t) => t.id === tile.id) + 1
              : undefined

            const isStart = sequence === 1
            const isEnd =
              sequence !== undefined &&
              sequence === sortedTiles.length &&
              sortedTiles.length > 1

            return (
              <div key={`cell-${x}-${y}`} className="relative">
                {tile ? (
                  isEditing ? (
                    <EditTilePopover
                      tile={tile}
                      onUpdate={handleUpdateTile}
                      onDelete={handleDeleteTile}
                      userRole={userRole || "participant"}
                      isCurrent={isCurrent}
                      isLocked={isLocked}
                      sequence={sequence}
                      sortedTiles={sortedTiles}
                    />
                  ) : (
                    <div
                      className={cn(
                        "relative rounded-lg transition-all",
                        isStart &&
                          !isCurrent &&
                          "shadow-[0_0_15px_rgba(34,197,94,0.5)] ring-2 ring-green-500",
                        isEnd &&
                          !isCurrent &&
                          "shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-2 ring-amber-500"
                      )}
                    >
                      <BingoTile
                        tile={tile}
                        onClick={() => onTileClick?.(tile)}
                        onTogglePlaceholder={() => {}}
                        userRole={
                          (userRole as
                            | "participant"
                            | "management"
                            | "admin") || "participant"
                        }
                        currentTeamId={currentTeamId}
                        isLocked={isLocked || false}
                      />
                      {/* Overlay Index */}
                      {sequence !== undefined && (
                        <div
                          className={cn(
                            "absolute left-1 top-1 z-20 flex min-h-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold shadow",
                            isStart
                              ? "bg-green-500 text-white dark:bg-green-600"
                              : isEnd
                                ? "bg-amber-500 text-white dark:bg-amber-600"
                                : "min-w-[1.5rem] bg-background/90 text-foreground"
                          )}
                        >
                          {isStart
                            ? "1 - Start"
                            : isEnd
                              ? `${sequence} - Finish`
                              : sequence}
                        </div>
                      )}
                      {/* Current Marker Overlay */}
                      {isCurrent && (
                        <div className="pointer-events-none absolute inset-0 z-20 animate-pulse rounded-lg ring-4 ring-primary ring-offset-2" />
                      )}
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        void handleCreateTile(x, y)
                      }
                    }}
                    disabled={!isEditing}
                    className={cn(
                      "relative aspect-square min-h-[60px] w-full touch-manipulation overflow-hidden rounded-lg border-2 border-dashed transition-all duration-300 ease-in-out sm:min-h-[80px] md:min-h-[100px] lg:min-h-[120px]",
                      !isEditing
                        ? "cursor-default border-muted-foreground/20 opacity-0"
                        : "cursor-pointer border-muted-foreground/40 bg-muted/20 hover:border-muted-foreground/60 hover:bg-muted/40"
                    )}
                  >
                    {isEditing && (
                      <span className="sr-only">
                        Create tile at {x}, {y}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EditTilePopover({
  tile,
  onUpdate,
  onDelete,
  userRole,
  isCurrent,
  isLocked,
  sequence,
  sortedTiles,
}: {
  tile: Tile
  onUpdate: (id: string, updates: Partial<Tile>) => void
  onDelete: (id: string) => void
  userRole: string
  isCurrent?: boolean
  isLocked?: boolean
  sequence?: number
  sortedTiles: Tile[]
}) {
  const [title, setTitle] = useState(tile.title || "")
  const [weight, setWeight] = useState(tile.weight || 1)
  const [index, setIndex] = useState(tile.index !== undefined ? tile.index : 1)

  const initialJumpSequence = (() => {
    if (tile.jumpToIndex === null || tile.jumpToIndex === undefined) return ""
    const targetIdx = sortedTiles.findIndex((t) => t.index === tile.jumpToIndex)
    return targetIdx >= 0 ? targetIdx + 1 : ""
  })()

  const [jumpToSequence, setJumpToSequence] = useState<number | "">(
    initialJumpSequence
  )
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = () => {
    let targetRawIndex: number | null = null
    if (jumpToSequence !== "") {
      const targetTile = sortedTiles[Number(jumpToSequence) - 1]
      if (targetTile && targetTile.index !== undefined) {
        targetRawIndex = targetTile.index
      }
    }

    onUpdate(tile.id, {
      title,
      weight: Number(weight),
      index: Number(index),
      jumpToIndex: targetRawIndex,
    })
    setIsOpen(false)
  }

  const isStart = sequence === 1
  const isEnd =
    sequence !== undefined &&
    sequence === sortedTiles.length &&
    sortedTiles.length > 1

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative cursor-pointer rounded-lg ring-2 transition-all hover:opacity-90",
            isStart && !isCurrent
              ? "shadow-[0_0_15px_rgba(34,197,94,0.5)] ring-green-500"
              : isEnd && !isCurrent
                ? "shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-amber-500"
                : "ring-primary/50"
          )}
        >
          <BingoTile
            tile={tile}
            onClick={() => setIsOpen(true)}
            onTogglePlaceholder={() => {}}
            userRole={
              (userRole as "participant" | "management" | "admin") ||
              "participant"
            }
            currentTeamId={undefined}
            isLocked={isLocked || false}
          />
          {sequence !== undefined && (
            <div
              className={cn(
                "absolute left-1 top-1 z-20 flex min-h-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold shadow ring-1",
                isStart
                  ? "bg-green-500 text-white ring-green-600 dark:bg-green-600 dark:ring-green-700"
                  : isEnd
                    ? "bg-amber-500 text-white ring-amber-600 dark:bg-amber-600 dark:ring-amber-700"
                    : "min-w-[1.5rem] bg-background/90 text-foreground ring-primary"
              )}
            >
              {isStart
                ? "1 - Start"
                : isEnd
                  ? `${sequence} - Finish`
                  : sequence}
            </div>
          )}
          {isCurrent && (
            <div className="pointer-events-none absolute inset-0 z-20 animate-pulse rounded-lg ring-4 ring-primary ring-offset-2" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4 p-4">
        <div className="space-y-2">
          <h4 className="font-semibold leading-none">Edit Race Tile</h4>
          <p className="text-sm text-muted-foreground">
            Adjust properties for this tile.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="weight">Weight (XP)</Label>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="index">Advanced: Sort Index</Label>
              <Input
                id="index"
                type="number"
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="jumpToSequence">Jump To Tile # (Optional)</Label>
            <Input
              id="jumpToSequence"
              type="number"
              placeholder="e.g. 5 for ladder, 2 for chute"
              value={jumpToSequence}
              onChange={(e) =>
                setJumpToSequence(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(tile.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
