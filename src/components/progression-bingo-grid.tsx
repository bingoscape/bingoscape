"use client"

import React, { useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, ArrowDown, Check, Clock, AlertTriangle, Edit2, Plus, Trash2, GripVertical, Save, X, Zap, EyeOff, CheckCircle2 } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"
import Markdown from "react-markdown"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  addTile,
  deleteTile,
  updateTile,
  updateTileTier,
  setTierXpRequirement,
  createNewTier,
  deleteTier,
} from "@/app/actions/bingo"

interface ProgressionBingoGridProps {
  tiles: Tile[]
  currentTeamId?: string
  onTileClick: (tile: Tile) => void
  tierProgress?: Array<{
    tier: number
    isUnlocked: boolean
    unlockedAt: Date | null
  }>
  tierXpRequirements: Array<{
    tier: number
    xpRequired: number
  }>
  userRole: "participant" | "management" | "admin"
  bingoId: string
  onTilesUpdated?: () => void
  isEditMode?: boolean
}

interface TierData {
  tier: number
  tiles: Tile[]
  isUnlocked: boolean
  unlockedAt: Date | null
}

interface SortableTileProps {
  tile: Tile
  isEditing: boolean
  isLocked: boolean
  onTileClick: (tile: Tile) => void
  onUpdateTile: (tileId: string, updates: Partial<Tile>) => void
  onDeleteTile: (tileId: string) => void
  getTileStatus: (tile: Tile) => string
  currentTeamId?: string
}

function SortableTile({
  tile,
  isEditing,
  isLocked,
  onTileClick,
  onUpdateTile,
  onDeleteTile,
  getTileStatus,
  currentTeamId,
}: SortableTileProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState<string>("")

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tile.id,
    data: {
      type: "tile",
      tile,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const tileStatus = getTileStatus(tile)
  const isClickable = (!isLocked || isEditing) && (!tile.isHidden || isEditing)

  const handleSave = (field: string) => {
    if (field === "weight") {
      const weight = Number.parseInt(tempValue)
      if (weight > 0) {
        onUpdateTile(tile.id, { weight })
      }
    } else if (field === "title") {
      onUpdateTile(tile.id, { title: tempValue })
    }
    setEditingField(null)
    setTempValue("")
  }

  const handleCancel = () => {
    setEditingField(null)
    setTempValue("")
  }

  const handleFieldEdit = (field: string, currentValue: string | number) => {
    setEditingField(field)
    setTempValue(String(currentValue))
  }

  // Get current team's submission for this tile
  const currentTeamSubmission = currentTeamId ? tile.teamTileSubmissions?.find(tts => tts.teamId === currentTeamId) : undefined

  // Render status icon function (similar to BingoTile)
  const renderStatusIcon = (status: "approved" | "needs_review" | "pending" | undefined) => {
    const iconMap = {
      approved: <div className="bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-green-200 dark:ring-green-800 transition-all duration-300">
        <span className="text-sm font-bold">✓</span>
      </div>,
      needs_review: <div className="bg-yellow-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-yellow-200 dark:ring-yellow-800 transition-all duration-300">
        <span className="text-sm font-bold">!</span>
      </div>,
      pending: <div className="bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-blue-200 dark:ring-blue-800 transition-all duration-300">
        <span className="text-sm font-bold">⏳</span>
      </div>,
    }
    return status ? iconMap[status] : null
  }

  // Only show hover card if tile is not hidden or if user has management rights
  const shouldShowHoverCard = !tile.isHidden || isEditing

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Card
          ref={setNodeRef}
          style={style}
          className={cn(
            "relative overflow-hidden transition-all duration-200",
            // Fixed size for all tiles with proper spacing
            "w-44 h-auto min-h-[180px] max-w-44",
            isClickable ? "cursor-pointer hover:shadow-lg hover:scale-105" : "cursor-not-allowed",
            tileStatus === "completed" && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20",
            tileStatus === "pending" && "ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
            tileStatus === "review" && "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/20",
            isLocked && !isEditing && "bg-muted/50 text-muted-foreground",
            isEditing && "border-primary/50",
            isEditing && isLocked && "border-orange-300 bg-orange-50/30 dark:bg-orange-950/10",
            isDragging && "shadow-lg ring-2 ring-primary/20",
          )}
          onClick={() => isClickable && onTileClick(tile)}
        >
      {/* Drag Handle */}
      {isEditing && (
        <div
          className="absolute top-2 left-2 cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity z-10"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Delete Button */}
      {isEditing && (
        <Button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm("Are you sure you want to delete this tile?")) {
              onDeleteTile(tile.id)
            }
          }}
          size="sm"
          variant="destructive"
          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity z-10"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}

      {/* Tile Header Image with fixed aspect ratio */}
      {tile.headerImage && (
        <div className="w-full h-28 overflow-hidden">
          <Image
            src={tile.headerImage || "/placeholder.svg"}
            alt={tile.title}
            width={176}
            height={112}
            className={cn("w-full h-full object-contain", isLocked && !isEditing && "grayscale")}
          />
        </div>
      )}

      <div className={cn("p-3 space-y-2", isEditing && "pt-8")}>
        {/* Tile Title */}
        <div className="space-y-1">
          {editingField === "title" ? (
            <div className="flex items-center gap-1">
              <Input
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave("title")
                  if (e.key === "Escape") handleCancel()
                }}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave("title")
                }}
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h4
                className={cn(
                  "font-semibold text-sm line-clamp-2 flex-1",
                  isLocked && !isEditing && "text-muted-foreground",
                )}
              >
                {tile.isHidden ? "Hidden Tile" : tile.title}
              </h4>
              {isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 ml-2 opacity-0 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFieldEdit("title", tile.title)
                  }}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tile Status and Weight */}
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
            {tileStatus === "available" && !isLocked && (
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
          {editingField === "weight" ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                max="100"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave("weight")
                  if (e.key === "Escape") handleCancel()
                }}
                className="h-6 w-16 text-xs"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-muted-foreground">XP</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave("weight")
                }}
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className={cn("text-xs", isEditing && "cursor-pointer hover:bg-muted")}
                onClick={(e) => {
                  if (isEditing) {
                    e.stopPropagation()
                    handleFieldEdit("weight", tile.weight)
                  }
                }}
              >
                {tile.weight} XP
              </Badge>
              {isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 opacity-50 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFieldEdit("weight", tile.weight)
                  }}
                >
                  <Edit2 className="h-2 w-2" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
    </HoverCardTrigger>
    {shouldShowHoverCard && (
      <HoverCardContent side="right" align="start" className="w-80 max-w-[90vw] p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-base flex-1 leading-tight break-words">{tile.isHidden ? "Hidden Tile" : tile.title}</h4>
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium">{tile.weight} XP</span>
            </div>
          </div>

          {currentTeamSubmission && (
            <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
              {renderStatusIcon(currentTeamSubmission.status)}
              <span className="text-sm font-medium capitalize">{currentTeamSubmission.status?.replace("_", " ")}</span>
            </div>
          )}

          {tile.description && !tile.isHidden && (
            <div className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert">
              <Markdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed break-words">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                  li: ({ children }) => <li className="text-sm break-words">{children}</li>,
                  h1: ({ children }) => <h1 className="text-base font-semibold mb-1 text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-semibold mb-1 text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-foreground">{children}</h3>,
                  a: ({ children, href }) => (
                    <a href={href} className="text-primary hover:text-primary/80 underline break-all" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {tile.description.length > 200 ? `${tile.description.substring(0, 200)}...` : tile.description}
              </Markdown>
            </div>
          )}

          {tile.goals && tile.goals.length > 0 && !tile.isHidden && (
            <div className="pt-1">
              <h5 className="text-xs font-semibold mb-2">Goals:</h5>
              <div className="text-xs space-y-2">
                {tile.goals.map((goal, idx) => {
                  // Calculate progress for current team if available
                  const teamSubmissions = currentTeamSubmission?.submissions.filter(sub => sub.goalId === goal.id) ?? []
                  const approvedProgress = teamSubmissions
                    .filter(sub => sub.status === "approved")
                    .reduce((sum, sub) => sum + (sub.submissionValue ?? 0), 0)
                  const totalProgress = teamSubmissions
                    .reduce((sum, sub) => sum + (sub.submissionValue ?? 0), 0)

                  const approvedPercentage = goal.targetValue > 0 ? Math.min(100, (approvedProgress / goal.targetValue) * 100) : 0
                  const isCompleted = approvedProgress >= goal.targetValue

                  return (
                    <div key={idx} className="p-2 bg-muted/30 rounded-lg space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-muted-foreground flex-1 line-clamp-2 break-words leading-tight">{goal.description}</span>
                        <span className="font-medium text-foreground text-right flex-shrink-0">
                          Target: {goal.targetValue}
                        </span>
                      </div>

                      {currentTeamSubmission && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 min-w-[60px]">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-[10px] text-muted-foreground">Progress</span>
                            </div>
                            <Progress
                              value={approvedPercentage}
                              className="h-2 flex-1 bg-muted"
                            />
                            <span className="text-[10px] font-medium min-w-[40px] text-right">
                              {approvedProgress}/{goal.targetValue}
                            </span>
                          </div>

                          {isCompleted && (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-[10px] text-green-600 font-medium">Completed!</span>
                            </div>
                          )}

                          {totalProgress > approvedProgress && (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 min-w-[60px]">
                                <Clock className="h-3 w-3 text-yellow-500" />
                                <span className="text-[10px] text-muted-foreground">Pending</span>
                              </div>
                              <Progress
                                value={goal.targetValue > 0 ? Math.min(100, (totalProgress / goal.targetValue) * 100) : 0}
                                className="h-2 flex-1 bg-muted"
                              />
                              <span className="text-[10px] font-medium min-w-[40px] text-right">
                                {totalProgress}/{goal.targetValue}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tile.isHidden && (
            <div className="mt-2 text-xs bg-secondary p-1.5 rounded flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5" />
              <span className="font-medium">Hidden tile</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    )}
  </HoverCard>
  )
}

function DroppableTierHeader({
  tier,
  isEditing,
  children,
}: {
  tier: number
  isEditing: boolean
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `tier-${tier}`,
    data: {
      type: "tier",
      tier: tier,
    },
    disabled: !isEditing,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn("transition-all duration-200 relative", isEditing && isOver && "transform scale-[1.02]")}
    >
      {/* Drop indicator */}
      {isEditing && isOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg z-10 flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm font-medium">
            Drop tile here to move to Tier {tier + 1}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

export function ProgressionBingoGrid({
  tiles,
  currentTeamId,
  onTileClick,
  tierProgress = [],
  tierXpRequirements,
  userRole,
  bingoId,
  onTilesUpdated,
  isEditMode = false,
}: ProgressionBingoGridProps) {
  const [isEditing, setIsEditing] = useState(isEditMode)
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles)
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null)
  const [localTierXpRequirements, setLocalTierXpRequirements] = useState<Record<number, number>>({})

  // Sync isEditing with parent's edit mode
  React.useEffect(() => {
    setIsEditing(isEditMode)
  }, [isEditMode])

  const isManagement = userRole === "admin" || userRole === "management"

  // Update local state when props change
  React.useEffect(() => {
    setLocalTiles(tiles)
  }, [tiles])

  // Convert tier requirements to object
  React.useEffect(() => {
    const reqObj: Record<number, number> = {}
    tierXpRequirements.forEach((req) => {
      reqObj[req.tier] = req.xpRequired
    })
    setLocalTierXpRequirements(reqObj)
  }, [tierXpRequirements])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Group tiles by tier using local tiles for immediate updates
  const tierData: TierData[] = React.useMemo(() => {
    const tilesByTier = localTiles.reduce(
      (acc, tile) => {
        const tierKey = tile.tier ?? 0
        if (!acc[tierKey]) {
          acc[tierKey] = []
        }
        acc[tierKey].push(tile)
        return acc
      },
      {} as Record<number, Tile[]>,
    )

    // Find the maximum tier number to ensure all tiers are represented
    const maxTierFromTiles = Math.max(...localTiles.map((tile) => tile.tier ?? 0), -1)
    const maxTierFromProgress = Math.max(...tierProgress.map((p) => p.tier), -1)
    const maxTierFromXpReqs = Math.max(...tierXpRequirements.map((req) => req.tier), -1)
    const maxTier = Math.max(maxTierFromTiles, maxTierFromProgress, maxTierFromXpReqs, 0)

    // Create tier data for all tiers from 0 to maxTier, even if they're empty
    const result: TierData[] = []
    for (let tier = 0; tier <= maxTier; tier++) {
      const tierTiles = tilesByTier[tier] ?? []
      const progress = tierProgress.find((p) => p.tier === tier)
      result.push({
        tier,
        tiles: tierTiles.sort((a, b) => a.index - b.index),
        isUnlocked: progress?.isUnlocked ?? tier === 0,
        unlockedAt: progress?.unlockedAt ?? null,
      })
    }

    return result
  }, [localTiles, tierProgress, tierXpRequirements])

  const getTileStatus = (tile: Tile) => {
    if (!currentTeamId) return "locked"

    const submission = tile.teamTileSubmissions?.find((tts) => tts.teamId === currentTeamId)

    if (submission?.status === "approved") return "completed"
    if (submission?.status === "pending") return "pending"
    if (submission?.status === "needs_review") return "review"
    return "available"
  }

  const getTierCompletionStatus = (tierTiles: Tile[]) => {
    if (!currentTeamId) return { completedXP: 0, totalXP: tierTiles.reduce((sum, tile) => sum + tile.weight, 0) }

    const completedXP = tierTiles
      .filter((tile) => {
        const submission = tile.teamTileSubmissions?.find((tts) => tts.teamId === currentTeamId)
        return submission?.status === "approved"
      })
      .reduce((sum, tile) => sum + tile.weight, 0)

    const totalXP = tierTiles.reduce((sum, tile) => sum + tile.weight, 0)

    return { completedXP, totalXP }
  }

  // Calculate total XP for validation
  const getTotalPrecedingXP = (targetTier: number) => {
    return tierData
      .filter((td) => td.tier < targetTier)
      .reduce((total, tierInfo) => {
        return total + tierInfo.tiles.reduce((tierTotal, tile) => tierTotal + tile.weight, 0)
      }, 0)
  }

  // Event handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const tile = localTiles.find((t) => t.id === String(active.id))
    setDraggedTile(tile ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedTile(null)

    if (!over || !isEditing) return

    const activeTile = localTiles.find((t) => t.id === active.id)
    const overTile = localTiles.find((t) => t.id === over.id)

    if (!activeTile) return

    // If dropping on another tile, reorder within the same tier
    if (overTile && activeTile.tier === overTile.tier) {
      const tierTiles = localTiles.filter((t) => t.tier === activeTile.tier)
      const oldIndex = tierTiles.findIndex((t) => t.id === activeTile.id)
      const newIndex = tierTiles.findIndex((t) => t.id === overTile.id)

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(tierTiles, oldIndex, newIndex)

        // Update local state immediately
        const otherTiles = localTiles.filter((t) => t.tier !== activeTile.tier)
        setLocalTiles([...otherTiles, ...newOrder])

        // TODO: Call reorder API
        toast({
          title: "Tiles reordered",
          description: "Tile order has been updated",
        })
      }
    }
    // If dropping on a tier header or different tier, move to that tier
    else if (over.data?.current?.type === "tier" || (overTile && activeTile.tier !== overTile.tier)) {
      const targetTier = (over.data?.current?.tier as number) ?? overTile?.tier

      if (targetTier !== undefined && targetTier !== activeTile.tier) {
        try {
          await updateTileTier(activeTile.id, targetTier)

          // Update local state
          setLocalTiles((prev) => prev.map((t) => (t.id === activeTile.id ? { ...t, tier: targetTier } : t)))

          onTilesUpdated?.()
          toast({
            title: "Tile moved",
            description: `Tile moved to Tier ${targetTier}`,
          })
        } catch (error) {
          console.error("Error moving tile:", error)
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to move tile",
            variant: "destructive",
          })
        }
      }
    }
  }

  const handleUpdateTile = async (tileId: string, updates: Partial<Tile>) => {
    try {
      await updateTile(tileId, updates)

      // Update local state
      setLocalTiles((prev) => prev.map((tile) => (tile.id === tileId ? { ...tile, ...updates } : tile)))

      onTilesUpdated?.()
      toast({
        title: "Tile updated",
        description: "Tile has been updated successfully",
      })
    } catch (error) {
      console.error("Error updating tile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tile",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTile = async (tileId: string) => {
    try {
      await deleteTile(tileId, bingoId)

      // Update local state
      setLocalTiles((prev) => prev.filter((tile) => tile.id !== tileId))

      onTilesUpdated?.()
      toast({
        title: "Tile deleted",
        description: "Tile has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting tile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete tile",
        variant: "destructive",
      })
    }
  }

  const handleAddTile = async (tier: number) => {
    try {
      const result = await addTile(bingoId)
      if (result.success) {
        let newTiles = result.tiles
        let lastTile = newTiles[newTiles.length - 1]

        if (lastTile && tier !== 0) {
          await updateTileTier(lastTile.id, tier)
          // Update the tile's tier in our local copy
          lastTile = { ...lastTile, tier }
          newTiles = newTiles.map((t) => (t.id === lastTile!.id ? lastTile! : t))
        }

        // Immediately update local state for instant UI feedback
        setLocalTiles(newTiles)

        onTilesUpdated?.()
        toast({
          title: "Tile added",
          description: `New tile added to Tier ${tier}`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding tile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add tile",
        variant: "destructive",
      })
    }
  }

  const handleUpdateXpRequirement = async (tier: number, xpRequired: number) => {
    const maxAllowedXP = getTotalPrecedingXP(tier + 1)

    if (xpRequired > maxAllowedXP) {
      toast({
        title: "Invalid XP requirement",
        description: `XP requirement cannot exceed ${maxAllowedXP} (total XP from all preceding tiers)`,
        variant: "destructive",
      })
      return
    }

    try {
      await setTierXpRequirement(bingoId, tier, xpRequired)

      // Update local state
      setLocalTierXpRequirements((prev) => ({
        ...prev,
        [tier]: xpRequired,
      }))

      toast({
        title: "XP requirement updated",
        description: `Tier ${tier} now requires ${xpRequired} XP to unlock the next tier`,
      })
    } catch (error) {
      console.error("Error updating XP requirement:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update XP requirement",
        variant: "destructive",
      })
    }
  }

  const handleCreateNewTier = async () => {
    try {
      const result = await createNewTier(bingoId)
      if (result.success && 'createdTile' in result && result.createdTile) {
        // Immediately update local state with the new tile
        setLocalTiles((prev) => [...prev, result.createdTile as Tile])

        onTilesUpdated?.()
        toast({
          title: "New tier created",
          description: `Tier ${result.newTier + 1} has been created`,
        })
      } else {
        throw new Error(String((result as {error?: string}).error) || 'Unknown error occurred')
      }
    } catch (error) {
      console.error("Error creating new tier:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create new tier",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTier = async (tierToDelete: number) => {
    if (
      !confirm(
        `Are you sure you want to delete Tier ${tierToDelete + 1}? This will permanently delete all tiles in this tier and renumber higher tiers.`,
      )
    ) {
      return
    }

    try {
      const result = await deleteTier(bingoId, tierToDelete)
      if (result.success && 'deletedTileIds' in result && 'updatedTiles' in result) {
        // Remove deleted tiles and update tier numbers for remaining tiles
        setLocalTiles((prev) => {
          // Remove deleted tiles
          let updatedTiles = prev.filter((tile) => !result.deletedTileIds?.includes(tile.id))

          // Update tier numbers for tiles that were shifted
          updatedTiles = updatedTiles.map((tile) => {
            const updatedTile = result.updatedTiles?.find((ut) => ut.id === tile.id)
            if (updatedTile) {
              return { ...tile, tier: updatedTile.tier }
            }
            return tile
          })

          return updatedTiles
        })

        // Update local tier XP requirements: remove deleted tier and shift higher tiers down
        setLocalTierXpRequirements((prev) => {
          const updated = { ...prev }
          // Remove the deleted tier's XP requirement
          delete updated[tierToDelete]
          
          // Shift higher tier XP requirements down by one tier
          const newReqs: Record<number, number> = {}
          Object.entries(updated).forEach(([tier, xpReq]) => {
            const tierNum = parseInt(tier)
            if (tierNum > tierToDelete) {
              newReqs[tierNum - 1] = xpReq
            } else {
              newReqs[tierNum] = xpReq
            }
          })
          
          return newReqs
        })

        onTilesUpdated?.()
        toast({
          title: "Tier deleted",
          description: `Tier ${tierToDelete + 1} has been deleted and higher tiers have been renumbered`,
        })
      } else {
        throw new Error(String((result as {error?: string}).error) || 'Failed to delete tier')
      }
    } catch (error) {
      console.error("Error deleting tier:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete tier",
        variant: "destructive",
      })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Edit Mode Toggle */}
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

        {tierData.map((tierInfo, tierIndex) => {
          const completionStatus = getTierCompletionStatus(tierInfo.tiles)
          const isLocked = !tierInfo.isUnlocked && !isEditing

          return (
            <div key={tierInfo.tier} className="space-y-4">
              {/* Tier Header - Drop Zone */}
              <DroppableTierHeader tier={tierInfo.tier} isEditing={isEditing}>
                <Card
                  className={cn(
                    "p-4 bg-muted/50 border-l-4 border-l-primary/50 transition-all duration-200",
                    isEditing &&
                    "border-l-primary border-2 border-dashed hover:bg-primary/5 hover:border-primary cursor-pointer",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg border-2",
                          tierInfo.isUnlocked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-muted-foreground/30",
                        )}
                      >
                        {tierInfo.isUnlocked ? tierInfo.tier + 1 : <Lock className="h-4 w-4" />}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold">
                          Tier {tierInfo.tier + 1}
                          {!tierInfo.isUnlocked && !isEditing && <span className="text-muted-foreground"> (Locked)</span>}
                          {!tierInfo.isUnlocked && isEditing && <span className="text-orange-600"> (Locked - Editing)</span>}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {completionStatus.completedXP}/{completionStatus.totalXP} XP completed
                          {(() => {
                            const xpReq =
                              localTierXpRequirements[tierInfo.tier] ??
                              tierXpRequirements.find((req) => req.tier === tierInfo.tier)?.xpRequired ??
                              5
                            return tierInfo.tier < Math.max(...tierData.map((td) => td.tier))
                              ? ` (${xpReq} XP required to unlock next tier)`
                              : ""
                          })()}
                          {tierInfo.unlockedAt && (
                            <span className="ml-2">
                              • Unlocked {new Date(tierInfo.unlockedAt).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Tier Controls */}
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <>
                          <Button
                            onClick={() => handleAddTile(tierInfo.tier)}
                            size="sm"
                            variant="outline"
                            className="gap-2"
                          >
                            <Plus className="h-3 w-3" />
                            Add Tile
                          </Button>
                          {/* Only allow deleting if it's not tier 1 and there are multiple tiers */}
                          {tierInfo.tier > 0 && tierData.length > 1 && (
                            <Button
                              onClick={() => handleDeleteTier(tierInfo.tier)}
                              size="sm"
                              variant="destructive"
                              className="gap-2"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete Tier
                            </Button>
                          )}
                        </>
                      )}

                      <Badge variant={tierInfo.isUnlocked ? "default" : "secondary"}>
                        {tierInfo.isUnlocked ? "Unlocked" : "Locked"}
                      </Badge>
                      {completionStatus.completedXP === completionStatus.totalXP && completionStatus.totalXP > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* XP Requirement Editor */}
                  {isEditing && tierInfo.tier < Math.max(...tierData.map((td) => td.tier)) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">XP to unlock Tier {tierInfo.tier + 2}:</span>
                        <Input
                          type="number"
                          min="1"
                          max={getTotalPrecedingXP(tierInfo.tier + 1)}
                          value={
                            localTierXpRequirements[tierInfo.tier] ??
                            tierXpRequirements.find((req) => req.tier === tierInfo.tier)?.xpRequired ??
                            5
                          }
                          onChange={(e) => {
                            const newValue = Number(e.target.value)
                            if (newValue > 0) {
                              void handleUpdateXpRequirement(tierInfo.tier, newValue)
                            }
                          }}
                          className="w-20 h-7"
                          title={`Maximum XP: ${getTotalPrecedingXP(tierInfo.tier + 1)} (total XP from preceding tiers)`}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </DroppableTierHeader>

              {/* Tier Tiles Grid - Show if unlocked, tier 0, or in edit mode */}
              {(tierInfo.isUnlocked || tierInfo.tier === 0 || isEditing) && (
                <SortableContext
                  items={tierInfo.tiles.filter((tile) => !tile.isHidden || isEditing).map((tile) => tile.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className={cn(
                      "flex flex-wrap justify-center transition-all duration-300",
                      // Add generous padding for breathing room
                      "p-6",
                      // Use negative margin approach for consistent spacing
                      "-m-3",
                      !tierInfo.isUnlocked && !isEditing && "opacity-50",
                    )}
                  >
                    {tierInfo.tiles
                      .filter((tile) => !tile.isHidden || isEditing)
                      .map((tile) => (
                        <div key={tile.id} className="m-3">
                          <SortableTile
                            tile={tile}
                            isEditing={isEditing}
                            isLocked={isLocked}
                            onTileClick={onTileClick}
                            onUpdateTile={handleUpdateTile}
                            onDeleteTile={handleDeleteTile}
                            getTileStatus={getTileStatus}
                            currentTeamId={currentTeamId}
                          />
                        </div>
                      ))}
                  </div>
                </SortableContext>
              )}

              {/* Locked tier placeholder - Only show if not in edit mode */}
              {!tierInfo.isUnlocked && tierInfo.tier !== 0 && !isEditing && (
                <div className="text-center py-12 text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Complete more tiles in Tier {tierInfo.tier} to unlock these tiles</p>
                </div>
              )}

              {/* Arrow to next tier */}
              {tierIndex < tierData.length - 1 && (
                <div className="flex justify-center py-4">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="w-px h-4 bg-border"></div>
                    <ArrowDown className="h-5 w-5" />
                    <div className="w-px h-4 bg-border"></div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Add New Tier Button - Only in edit mode */}
        {isManagement && isEditing && (
          <div className="flex justify-center py-6">
            <Button
              onClick={handleCreateNewTier}
              variant="outline"
              className="gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all bg-transparent"
            >
              <Plus className="h-4 w-4" />
              Add New Tier
            </Button>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedTile && (
          <Card className="opacity-75 transform rotate-3 shadow-xl">
            {draggedTile.headerImage && (
              <div className="aspect-square overflow-hidden">
                <Image
                  src={draggedTile.headerImage || "/placeholder.svg"}
                  alt={draggedTile.title}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-3">
              <h4 className="font-semibold text-sm line-clamp-2">
                {draggedTile.isHidden ? "Hidden Tile" : draggedTile.title}
              </h4>
              <Badge variant="outline" className="text-xs mt-2">
                {draggedTile.weight} XP
              </Badge>
            </div>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  )
}
