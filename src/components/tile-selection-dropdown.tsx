"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, AlertTriangle } from "lucide-react";
import type { Tile } from "@/app/actions/events";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TileSelectionDropdownProps {
  tiles: Tile[];
  currentTeamId: string;
  targetTeamId?: string; // NEW: Team to show status for when submitting on behalf
  onTileSelect: (tile: Tile) => void;
  unlockedTiers?: Set<number>;
}

export function TileSelectionDropdown({
  tiles,
  currentTeamId,
  targetTeamId,
  onTileSelect,
  unlockedTiers,
}: TileSelectionDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Get tile status for current team or target team
  const getTileStatus = useCallback(
    (tile: Tile): "approved" | "pending" | "needs_review" | "not_started" => {
      // Use target team ID if provided, otherwise current team
      const teamIdForStatus = targetTeamId ?? currentTeamId;

      const teamSubmission = tile.teamTileSubmissions?.find(
        (sub) => sub.teamId === teamIdForStatus,
      );

      if (!teamSubmission) return "not_started";
      return teamSubmission.status;
    },
    [currentTeamId, targetTeamId],
  );

  // Check if tile is locked (for progression boards)
  const isTileLocked = useCallback(
    (tile: Tile): boolean => {
      if (!unlockedTiers) return false;
      return tile.tier > 0 && !unlockedTiers.has(tile.tier);
    },
    [unlockedTiers],
  );

  // Smart filtering: hide approved tiles and locked tiers by default
  const filteredTiles = useMemo(() => {
    return tiles.filter((tile) => {
      // Hide approved tiles
      const status = getTileStatus(tile);
      if (status === "approved") return false;

      // Hide locked tier tiles
      if (isTileLocked(tile)) return false;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = tile.title?.toLowerCase().includes(query);
        const descMatch = tile.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      }

      return true;
    });
  }, [tiles, searchQuery, getTileStatus, isTileLocked]);

  // Get status badge component
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-green-200 bg-green-100 text-xs text-green-800"
          >
            <Check className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "needs_review":
        return (
          <Badge
            variant="outline"
            className="border-yellow-200 bg-yellow-100 text-xs text-yellow-800"
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Needs Review
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-100 text-xs text-blue-800"
          >
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-100 text-xs text-gray-800"
          >
            Not Started
          </Badge>
        );
    }
  };

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
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery
                  ? "Try a different search term"
                  : "All tiles are either approved or locked"}
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading={`Available Tiles (${filteredTiles.length})`}>
            {filteredTiles.map((tile) => {
              const status = getTileStatus(tile);

              return (
                <CommandItem
                  key={tile.id}
                  onSelect={() => onTileSelect(tile)}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50 aria-selected:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {tile.title}
                      </p>
                      {tile.tier > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Tier {tile.tier}
                        </Badge>
                      )}
                    </div>
                    {tile.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {tile.description}
                      </p>
                    )}
                    <div className="mt-2">{getStatusBadge(status)}</div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </ScrollArea>
      </Command>

      {filteredTiles.length === 0 && !searchQuery && (
        <div className="mt-4 rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            All available tiles have been completed!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Great job! Check back later for new tiles or boards.
          </p>
        </div>
      )}
    </div>
  );
}
