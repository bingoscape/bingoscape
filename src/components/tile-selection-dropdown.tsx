"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Check, Clock, AlertTriangle } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TileSelectionDropdownProps {
  tiles: Tile[]
  currentTeamId: string
  onTileSelect: (tile: Tile) => void
  unlockedTiers?: Set<number>
}

export function TileSelectionDropdown({
  tiles,
  currentTeamId,
  onTileSelect,
  unlockedTiers,
}: TileSelectionDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Get tile status for current team
  const getTileStatus = useCallback((tile: Tile): "approved" | "pending" | "needs_review" | "not_started" => {
    const teamSubmission = tile.teamTileSubmissions?.find(
      (sub) => sub.teamId === currentTeamId
    )

    if (!teamSubmission) return "not_started"
    return teamSubmission.status
  }, [currentTeamId])

  // Check if tile is locked (for progression boards)
  const isTileLocked = useCallback((tile: Tile): boolean => {
    if (!unlockedTiers) return false
    return tile.tier > 0 && !unlockedTiers.has(tile.tier)
  }, [unlockedTiers])

  // Smart filtering: hide approved tiles and locked tiers by default
  const filteredTiles = useMemo(() => {
    return tiles.filter((tile) => {
      // Hide approved tiles
      const status = getTileStatus(tile)
      if (status === "approved") return false

      // Hide locked tier tiles
      if (isTileLocked(tile)) return false

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const titleMatch = tile.title?.toLowerCase().includes(query)
        const descMatch = tile.description?.toLowerCase().includes(query)
        return titleMatch || descMatch
      }

      return true
    })
  }, [tiles, searchQuery, getTileStatus, isTileLocked])

  // Get status badge component
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "needs_review":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 text-xs">
            Not Started
          </Badge>
        )
    }
  }

  return (
    <div className="w-full">
      <Command className="rounded-lg border">
        <CommandInput
          placeholder="Search tiles..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <ScrollArea className="h-[300px]">
          <CommandEmpty>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No tiles found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : "All tiles are either approved or locked"}
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading={`Available Tiles (${filteredTiles.length})`}>
            {filteredTiles.map((tile) => {
              const status = getTileStatus(tile)

              return (
                <CommandItem
                  key={tile.id}
                  onSelect={() => onTileSelect(tile)}
                  className="flex items-start gap-3 py-3 px-4 cursor-pointer hover:bg-muted/50 aria-selected:bg-muted"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{tile.title}</p>
                      {tile.tier > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Tier {tile.tier}
                        </Badge>
                      )}
                    </div>
                    {tile.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tile.description}
                      </p>
                    )}
                    <div className="mt-2">
                      {getStatusBadge(status)}
                    </div>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </ScrollArea>
      </Command>

      {filteredTiles.length === 0 && !searchQuery && (
        <div className="mt-4 p-4 rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            All available tiles have been completed!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Great job! Check back later for new tiles or boards.
          </p>
        </div>
      )}
    </div>
  )
}
