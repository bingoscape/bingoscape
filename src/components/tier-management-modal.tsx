"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Settings, Move } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { addTile, deleteTile, updateTileTier, getTierXpRequirements, setTierXpRequirement, type TileData } from "@/app/actions/bingo"
import { getBingoById } from "@/app/actions/getBingoById"
import type { Bingo } from "@/app/actions/events"
import getRandomFrog from "@/lib/getRandomFrog"

interface TierManagementModalProps {
  bingo: Bingo
  onTilesUpdated: () => void
}

type TilesByTier = Record<number, TileData[]>

export function TierManagementModal({ bingo, onTilesUpdated }: TierManagementModalProps) {
  const [open, setOpen] = useState(false)
  const [tiles, setTiles] = useState<TileData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null)
  const [newTierValue, setNewTierValue] = useState<number>(0)
  const [tierXpRequirements, setTierXpRequirements] = useState<Record<number, number>>({})

  const loadTiles = async () => {
    try {
      setLoading(true)
      const [bingoData, xpRequirements] = await Promise.all([
        getBingoById(bingo.id),
        getTierXpRequirements(bingo.id)
      ])
      
      if (bingoData?.tiles) {
        setTiles(bingoData.tiles)
      }
      
      // Convert XP requirements array to record for easier access
      const xpReqRecord: Record<number, number> = {}
      xpRequirements.forEach(req => {
        xpReqRecord[req.tier] = req.xpRequired
      })
      setTierXpRequirements(xpReqRecord)
    } catch (error) {
      console.error("Error loading tiles:", error)
      toast({
        title: "Error",
        description: "Failed to load tiles",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void loadTiles()
    }
  }, [open, bingo.id])

  // Group tiles by tier
  const tilesByTier: TilesByTier = tiles.reduce((acc, tile) => {
    const tier = tile.tier ?? 0
    if (!acc[tier]) {
      acc[tier] = []
    }
    acc[tier].push(tile)
    return acc
  }, {} as TilesByTier)

  // Get all unique tiers, sorted
  const allTiers = Object.keys(tilesByTier)
    .map(Number)
    .sort((a, b) => a - b)

  const handleAddTile = async (tier: number) => {
    try {
      setLoading(true)
      const result = await addTile(bingo.id)
      if (result.success) {
        // Update the newly created tile to be in the correct tier
        const newTiles = result.tiles
        const lastTile = newTiles[newTiles.length - 1]
        
        if (lastTile && tier !== 0) {
          await updateTileTier(lastTile.id, tier)
        }
        
        await loadTiles()
        onTilesUpdated()
        toast({
          title: "Tile added",
          description: `New tile added to tier ${tier}`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding tile:", error)
      toast({
        title: "Error",
        description: "Failed to add tile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTile = async (tileId: string) => {
    if (!confirm("Are you sure you want to delete this tile? This action cannot be undone.")) {
      return
    }

    try {
      setLoading(true)
      const result = await deleteTile(tileId, bingo.id)
      if (result.success) {
        await loadTiles()
        onTilesUpdated()
        toast({
          title: "Tile deleted",
          description: "Tile has been successfully deleted",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting tile:", error)
      toast({
        title: "Error",
        description: "Failed to delete tile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMoveTile = async (tile: TileData, newTier: number) => {
    try {
      setLoading(true)
      const result = await updateTileTier(tile.id, newTier)
      if (result.success) {
        await loadTiles()
        onTilesUpdated()
        toast({
          title: "Tile moved",
          description: `Tile moved to tier ${newTier}`,
        })
        setSelectedTile(null)
        setNewTierValue(0)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error moving tile:", error)
      toast({
        title: "Error",
        description: "Failed to move tile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getTotalPrecedingXP = (targetTier: number) => {
    return allTiers
      .filter(tier => tier < targetTier)
      .reduce((total, tier) => {
        return total + (tilesByTier[tier] ?? []).reduce((tierTotal, tile) => tierTotal + tile.weight, 0)
      }, 0)
  }

  const handleUpdateXpRequirement = async (tier: number, xpRequired: number) => {
    const maxAllowedXP = getTotalPrecedingXP(tier + 1)
    
    if (xpRequired > maxAllowedXP) {
      toast({
        title: "Invalid XP requirement",
        description: `XP requirement cannot exceed ${maxAllowedXP} (total XP available from all preceding tiers)`,
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const result = await setTierXpRequirement(bingo.id, tier, xpRequired)
      if (result.success) {
        setTierXpRequirements(prev => ({
          ...prev,
          [tier]: xpRequired
        }))
        toast({
          title: "XP requirement updated",
          description: `Tier ${tier} now requires ${xpRequired} XP to unlock the next tier`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error updating XP requirement:", error)
      toast({
        title: "Error",
        description: "Failed to update XP requirement",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNewTier = async () => {
    const maxTier = Math.max(...allTiers, -1)
    const newTier = maxTier + 1
    await handleAddTile(newTier)
  }

  if (bingo.bingoType !== "progression") {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing if not currently loading
      if (!loading) {
        setOpen(newOpen)
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Manage Tiers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tier Management - {bingo.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tiers" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="tiers">Manage Tiers</TabsTrigger>
            <TabsTrigger value="move">Move Tiles</TabsTrigger>
          </TabsList>

          <TabsContent value="tiers" className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4"
              style={{ maxHeight: 'calc(80vh - 120px)' }}>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Progression Tiers</h3>
                  <Button onClick={handleAddNewTier} disabled={loading} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Tier
                  </Button>
                </div>

                {allTiers.map((tier) => (
                  <Card key={tier} className="border border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-lg">
                            Tier {tier}
                            <Badge variant="outline" className="ml-2">
                              {tilesByTier[tier]?.length ?? 0} tiles
                            </Badge>
                          </CardTitle>
                          {tier < Math.max(...allTiers) && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`xp-req-${tier}`} className="text-sm">
                                XP to unlock Tier {tier + 1}:
                              </Label>
                              <Input
                                id={`xp-req-${tier}`}
                                type="number"
                                min="1"
                                max={getTotalPrecedingXP(tier + 1)}
                                value={tierXpRequirements[tier] ?? 5}
                                onChange={(e) => {
                                  const newValue = Number(e.target.value)
                                  if (newValue > 0) {
                                    void handleUpdateXpRequirement(tier, newValue)
                                  }
                                }}
                                className="w-20"
                                disabled={loading}
                                title={`Maximum XP: ${getTotalPrecedingXP(tier + 1)} (total XP from preceding tiers)`}
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => handleAddTile(tier)}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                          className="gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          Add Tile
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(tilesByTier[tier] ?? []).map((tile) => (
                          <Card key={tile.id} className="relative group">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                {tile.headerImage && (
                                  <img
                                    src={tile.headerImage}
                                    alt={tile.title}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">
                                    {tile.isHidden ? "Hidden Tile" : tile.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {tile.weight} XP • Index {tile.index}
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleDeleteTile(tile.id)}
                                disabled={loading}
                                size="sm"
                                variant="destructive"
                                className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {allTiers.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <p className="text-muted-foreground mb-4">No tiles found</p>
                      <Button onClick={() => handleAddTile(0)} disabled={loading}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Tile
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="move" className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4"
              style={{ maxHeight: 'calc(80vh - 120px)' }}>
              <div className="space-y-4">
              <h3 className="text-lg font-semibold">Move Tiles Between Tiers</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Tile to Move</Label>
                  <Select
                    value={selectedTile?.id ?? ""}
                    onValueChange={(tileId) => {
                      const tile = tiles.find(t => t.id === tileId)
                      setSelectedTile(tile ?? null)
                      setNewTierValue(tile?.tier ?? 0)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a tile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiles.map((tile) => (
                        <SelectItem key={tile.id} value={tile.id}>
                          <div className="flex items-center gap-2">
                            <span>Tier {tile.tier ?? 0}:</span>
                            <span className="font-medium">
                              {tile.isHidden ? "Hidden Tile" : tile.title}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>New Tier</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={newTierValue}
                    onChange={(e) => setNewTierValue(Number(e.target.value))}
                    placeholder="Enter tier number..."
                  />
                </div>
              </div>

              {selectedTile && (
                <Card className="border border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedTile.headerImage && (
                          <img
                            src={selectedTile.headerImage || getRandomFrog()}
                            alt={selectedTile.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div>
                          <h4 className="font-medium">
                            {selectedTile.isHidden ? "Hidden Tile" : selectedTile.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Currently in Tier {selectedTile.tier} • {selectedTile.weight} XP
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleMoveTile(selectedTile, newTierValue)}
                        disabled={loading || newTierValue === selectedTile.tier}
                        className="gap-2"
                      >
                        <Move className="h-4 w-4" />
                        Move to Tier {newTierValue}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
