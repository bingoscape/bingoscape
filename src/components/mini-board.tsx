"use client"

import { useEffect, useState } from "react"
import { getMiniBoardTiles } from "@/app/actions/events"
import { Lock, Check } from "lucide-react"

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

export function MiniBoard({ bingoId, rows, columns, visible = true }: MiniBoardProps) {
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
      } catch (error) {
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
        className="grid gap-1 sm:gap-1.5 bg-background/50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl overflow-hidden border border-border/50 shadow-inner backdrop-blur-md opacity-80" 
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * columns }).map((_, i) => (
          <div key={i} className="aspect-square flex items-center justify-center rounded sm:rounded-md bg-muted/20 border-2 border-dashed border-muted-foreground/30">
            {i === Math.floor((rows * columns) / 2) && (
              <Lock className="w-6 h-6 text-muted-foreground/50" />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div 
        className="grid gap-1 sm:gap-1.5 bg-background/50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl overflow-hidden opacity-50 animate-pulse border border-border/50 shadow-inner backdrop-blur-md" 
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * columns }).map((_, i) => (
          <div key={i} className="aspect-square rounded sm:rounded-md bg-muted/40 border border-border/50" />
        ))}
      </div>
    )
  }

  return (
    <div 
      className="grid gap-1 sm:gap-1.5 bg-background/50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl overflow-hidden shadow-inner backdrop-blur-md border border-border/50" 
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map(tile => (
        <div 
          key={tile.id} 
          className={`aspect-square relative flex items-center justify-center overflow-hidden rounded sm:rounded-md transition-transform hover:scale-105 ${
            tile.isHidden 
              ? "bg-muted/20 border-2 border-dashed border-muted-foreground/30" 
              : tile.isCompleted 
                ? "border-green-500 bg-green-50 dark:bg-green-900/20 border-2 shadow-sm"
                : "bg-card border border-border/80 shadow-sm"
          }`}
          title={tile.isHidden ? "Hidden Tile" : tile.title}
        >
          {tile.isHidden ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 font-bold text-xs">
              ?
            </div>
          ) : tile.headerImage ? (
            <img 
              src={tile.headerImage} 
              alt={tile.title} 
              className={`absolute inset-0 h-full w-full object-contain p-0.5 ${tile.isCompleted ? 'brightness-110 saturate-110' : 'opacity-90'}`} 
            />
          ) : (
            <div className={`absolute inset-0 flex items-center justify-center ${tile.isCompleted ? 'bg-green-500' : 'bg-primary/20'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
