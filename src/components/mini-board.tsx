"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { getMiniBoardTiles } from "@/app/actions/events"
import { Lock, } from "lucide-react"

interface MiniBoardProps {
  bingoId: string
  rows: number
  columns: number
  visible?: boolean
}

type MiniTile = {
  id: string
  index: number
  isHidden: boolean
  title: string
  headerImage: string | null
  isCompleted?: boolean
}

export function MiniBoard({
  bingoId,
  rows,
  columns,
  visible = true,
}: MiniBoardProps) {
  const [tiles, setTiles] = useState<MiniTile[]>([])
  const [loading, setLoading] = useState(visible)

  useEffect(() => {
    if (!visible) {
      return
    }

    let mounted = true
    const loadTiles = async () => {
      try {
        const data = await getMiniBoardTiles(bingoId)
        if (mounted) {
          setTiles(data as MiniTile[])
          setLoading(false)
        }
      } catch (_error) {
        if (mounted) setLoading(false)
      }
    }

    void loadTiles()

    return () => {
      mounted = false
    }
  }, [bingoId, visible])

  if (!visible) {
    return (
      <div
        className="grid gap-1 overflow-hidden osrs-panel-inset rounded-sm p-1.5 opacity-80 sm:gap-1.5 sm:p-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * columns }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-sm border-2 border-dashed border-muted-foreground/30 bg-muted/20"
          >
            {i === Math.floor((rows * columns) / 2) && (
              <Lock className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="grid animate-pulse gap-1 overflow-hidden osrs-panel-inset rounded-sm p-1.5 opacity-50 sm:gap-1.5 sm:p-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * columns }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-sm border border-border/50 bg-muted/40"
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="grid gap-1 overflow-hidden osrs-panel-inset rounded-sm p-1.5 sm:gap-1.5 sm:p-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-sm ${
            tile.isHidden
              ? "border-2 border-dashed border-muted-foreground/30 bg-muted/20"
              : tile.isCompleted
                ? "osrs-slot border-2 border-success"
                : "osrs-slot"
          }`}
          title={tile.isHidden ? "Hidden Tile" : tile.title}
        >
          {tile.isHidden ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground/30">
              ?
            </div>
          ) : tile.headerImage ? (
            <Image
              fill
              src={tile.headerImage}
              alt={tile.title}
              className={`object-cover p-0.5 ${tile.isCompleted ? "saturate-110 brightness-110" : "opacity-90"}`}
            />
          ) : (
            <div
              className={`absolute inset-0 flex items-center justify-center ${tile.isCompleted ? "bg-success" : "bg-primary/20"}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
