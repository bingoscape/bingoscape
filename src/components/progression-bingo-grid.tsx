"use client"

import React from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lock, ArrowRight, Check, Clock, AlertTriangle } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { cn } from "@/lib/utils"

interface ProgressionBingoGridProps {
  tiles: Tile[]
  currentTeamId?: string
  onTileClick: (tile: Tile) => void
  tierProgress?: Array<{
    tier: number
    isUnlocked: boolean
    unlockedAt: Date | null
  }>
}

interface TierData {
  tier: number
  tiles: Tile[]
  isUnlocked: boolean
  unlockedAt: Date | null
}

export function ProgressionBingoGrid({
  tiles,
  currentTeamId,
  onTileClick,
  tierProgress = []
}: ProgressionBingoGridProps) {
  // Group tiles by tier
  const tierData: TierData[] = React.useMemo(() => {
    const tilesByTier = tiles.reduce((acc, tile) => {
      const tierKey = tile.tier ?? 0
      if (!acc[tierKey]) {
        acc[tierKey] = []
      }
      acc[tierKey].push(tile)
      return acc
    }, {} as Record<number, Tile[]>)

    return Object.entries(tilesByTier)
      .map(([tierStr, tierTiles]) => {
        const tier = parseInt(tierStr)
        const progress = tierProgress.find(p => p.tier === tier)
        return {
          tier,
          tiles: tierTiles.sort((a, b) => a.index - b.index),
          isUnlocked: progress?.isUnlocked ?? tier === 0,
          unlockedAt: progress?.unlockedAt ?? null
        }
      })
      .sort((a, b) => a.tier - b.tier)
  }, [tiles, tierProgress])

  const getTileStatus = (tile: Tile) => {
    if (!currentTeamId) return "locked"
    
    const submission = tile.teamTileSubmissions?.find(
      tts => tts.teamId === currentTeamId
    )
    
    if (submission?.status === "approved") return "completed"
    if (submission?.status === "pending") return "pending"
    if (submission?.status === "needs_review") return "review"
    return "available"
  }

  const getTierCompletionStatus = (tierTiles: Tile[]) => {
    if (!currentTeamId) return { completed: 0, total: tierTiles.length }
    
    const completed = tierTiles.filter(tile => {
      const submission = tile.teamTileSubmissions?.find(
        tts => tts.teamId === currentTeamId
      )
      return submission?.status === "approved"
    }).length

    return { completed, total: tierTiles.length }
  }

  return (
    <div className="space-y-8">
      {tierData.map((tierInfo, tierIndex) => {
        const completionStatus = getTierCompletionStatus(tierInfo.tiles)
        const isLocked = !tierInfo.isUnlocked
        
        return (
          <div key={tierInfo.tier} className="space-y-4">
            {/* Tier Header */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg border-2",
                  tierInfo.isUnlocked 
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-muted-foreground/30"
                )}>
                  {tierInfo.isUnlocked ? tierInfo.tier + 1 : <Lock className="h-4 w-4" />}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">
                    Tier {tierInfo.tier + 1}
                    {isLocked && <span className="text-muted-foreground"> (Locked)</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {completionStatus.completed}/{completionStatus.total} completed
                    {tierInfo.unlockedAt && (
                      <span className="ml-2">
                        • Unlocked {new Date(tierInfo.unlockedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Tier Progress */}
              <div className="flex items-center gap-2">
                <Badge variant={tierInfo.isUnlocked ? "default" : "secondary"}>
                  {tierInfo.isUnlocked ? "Unlocked" : "Locked"}
                </Badge>
                {completionStatus.completed === completionStatus.total && completionStatus.total > 0 && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
            </div>

            {/* Tier Tiles Grid */}
            <div className={cn(
              "grid gap-4 transition-all duration-300",
              tierInfo.tiles.length <= 3 ? "grid-cols-1 md:grid-cols-3" :
              tierInfo.tiles.length <= 6 ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6" :
              "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
              isLocked && "opacity-50"
            )}>
              {tierInfo.tiles.map((tile) => {
                const tileStatus = getTileStatus(tile)
                const isClickable = tierInfo.isUnlocked && !tile.isHidden

                return (
                  <Card
                    key={tile.id}
                    className={cn(
                      "relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg",
                      isClickable ? "hover:scale-105" : "cursor-not-allowed",
                      tileStatus === "completed" && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20",
                      tileStatus === "pending" && "ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
                      tileStatus === "review" && "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/20",
                      isLocked && "bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => isClickable && onTileClick(tile)}
                  >
                    {/* Tile Header Image */}
                    {tile.headerImage && (
                      <div className="h-24 overflow-hidden">
                        <Image
                          src={tile.headerImage}
                          alt={tile.title}
                          width={96}
                          height={96}
                          className={cn(
                            "w-full h-full object-cover",
                            isLocked && "grayscale"
                          )}
                        />
                      </div>
                    )}

                    <div className="p-3 space-y-2">
                      {/* Tile Title */}
                      <h4 className={cn(
                        "font-semibold text-sm line-clamp-2",
                        isLocked && "text-muted-foreground"
                      )}>
                        {tile.isHidden ? "Hidden Tile" : tile.title}
                      </h4>

                      {/* Tile Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {tileStatus === "completed" && (
                            <>
                              <Check className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-600">Complete</span>
                            </>
                          )}
                          {tileStatus === "pending" && (
                            <>
                              <Clock className="h-3 w-3 text-yellow-600" />
                              <span className="text-xs text-yellow-600">Pending</span>
                            </>
                          )}
                          {tileStatus === "review" && (
                            <>
                              <AlertTriangle className="h-3 w-3 text-orange-600" />
                              <span className="text-xs text-orange-600">Review</span>
                            </>
                          )}
                          {tileStatus === "available" && tierInfo.isUnlocked && (
                            <span className="text-xs text-muted-foreground">Available</span>
                          )}
                          {isLocked && (
                            <>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Locked</span>
                            </>
                          )}
                        </div>

                        {/* Tile Weight */}
                        <Badge variant="outline" size="sm">
                          {tile.weight} XP
                        </Badge>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Arrow to next tier */}
            {tierIndex < tierData.length - 1 && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-px flex-1 bg-border"></div>
                  <ArrowRight className="h-5 w-5" />
                  <div className="h-px flex-1 bg-border"></div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}