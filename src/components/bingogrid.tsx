'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "next-auth/react"
import Sortable from 'sortablejs'
import { toast } from '@/hooks/use-toast'

interface Tile {
  id: string
  headerImage: string | null
  description: string
  weight: number
  index: number
}

interface BingoGridProps {
  rows: number
  columns: number
  tiles: Tile[]
  isEventAdmin: boolean
  onTileUpdate: (tileId: string, updatedTile: Partial<Tile>) => Promise<{ success: boolean; error?: string }>
  onTilesReorder: (reorderedTiles: Array<{ id: string; index: number }>) => Promise<{ success: boolean; error?: string }>
}

export default function BingoGrid({ rows, columns, tiles, isEventAdmin, onTileUpdate, onTilesReorder }: BingoGridProps) {
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editedTile, setEditedTile] = useState<Partial<Tile>>({})
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (gridRef.current && isEventAdmin) {
      const sortable = new Sortable(gridRef.current, {
        animation: 150,
        ghostClass: 'bg-blue-100',
        onEnd: async (evt) => {
          const updatedTiles = tiles.map((tile, index) => ({
            id: tile.id,
            index: index
          }))
          const result = await onTilesReorder(updatedTiles)
          if (result.success) {
            toast({
              title: "Tiles reordered",
              description: "The tiles have been successfully reordered.",
            })
          } else {
            toast({
              title: "Error",
              description: result.error || "Failed to reorder tiles",
              variant: "destructive",
            })
          }
        },
      })

      return () => {
        sortable.destroy()
      }
    }
  }, [tiles, isEventAdmin, onTilesReorder])

  const handleTileClick = (tile: Tile) => {
    setSelectedTile(tile)
    setEditedTile(tile)
    setIsDialogOpen(true)
  }

  const handleTileUpdate = async () => {
    if (selectedTile && editedTile) {
      const result = await onTileUpdate(selectedTile.id, editedTile)
      if (result.success) {
        setIsDialogOpen(false)
        toast({
          title: "Tile updated",
          description: "The tile has been successfully updated.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update tile",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <>
      <div
        ref={gridRef}
        className="grid gap-1 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          aspectRatio: `${columns} / ${rows}`
        }}
      >
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className="relative rounded-sm overflow-hidden cursor-pointer"
            onClick={() => handleTileClick(tile)}
          >
            {tile.headerImage ? (
              <Image
                src={tile.headerImage}
                alt={tile.description}
                layout="fill"
                objectFit="cover"
              />
            ) : (
              <div className="w-full h-full bg-primary" />
            )}
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTile?.description}</DialogTitle>
            <DialogDescription>Weight: {selectedTile?.weight}</DialogDescription>
          </DialogHeader>
          {isEventAdmin && (
            <div className="space-y-4">
              <Input
                placeholder="Description"
                value={editedTile.description || ''}
                onChange={(e) => setEditedTile({ ...editedTile, description: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Weight"
                value={editedTile.weight || ''}
                onChange={(e) => setEditedTile({ ...editedTile, weight: parseInt(e.target.value) })}
              />
              <Textarea
                placeholder="Header Image URL"
                value={editedTile.headerImage || ''}
                onChange={(e) => setEditedTile({ ...editedTile, headerImage: e.target.value })}
              />
              <Button onClick={handleTileUpdate}>Update Tile</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
