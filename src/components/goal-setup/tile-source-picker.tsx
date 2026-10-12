"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { matchesTileQuery, pluralize, tilePosition } from "@/lib/goal-setup"
import { cn } from "@/lib/utils"
import type { Tile } from "@/types/model"

interface TileSourcePickerProps {
  /** The Tiles that can be copied from (they have goals). */
  tiles: readonly Tile[]
  value: string | null
  onChange: (tileId: string) => void
}

/** Searchable list of Tiles: type part of a name or a position, pick with Enter or a tap. */
export function TileSourcePicker({
  tiles,
  value,
  onChange,
}: TileSourcePickerProps) {
  const [query, setQuery] = useState("")
  const matches = tiles.filter((tile) => matchesTileQuery(tile, query))

  return (
    <Command
      shouldFilter={false}
      loop
      label="Tiles to copy goals from"
      className="h-auto rounded-sm border"
    >
      <CommandInput
        data-autofocus=""
        value={query}
        onValueChange={setQuery}
        placeholder="Search by name or number..."
        autoComplete="off"
        className="h-9 pointer-coarse:h-11"
      />
      <CommandList className="max-h-[min(14rem,30dvh)]">
        <CommandEmpty>No tile with goals matches.</CommandEmpty>
        <CommandGroup>
          {matches.map((tile) => {
            const selected = tile.id === value
            return (
              <CommandItem
                key={tile.id}
                value={tile.id}
                onSelect={() => onChange(tile.id)}
                className="cursor-pointer gap-2 pointer-coarse:min-h-11"
              >
                <span className="text-muted-foreground w-6 shrink-0 text-right text-xs tabular-nums">
                  {tilePosition(tile)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    selected && "font-medium"
                  )}
                >
                  {tile.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {pluralize(tile.goals?.length ?? 0, "goal")}
                </span>
                {selected && (
                  <>
                    <Check
                      aria-hidden="true"
                      className="text-primary h-4 w-4"
                    />
                    <span className="sr-only">Selected</span>
                  </>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
