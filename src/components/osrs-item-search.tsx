"use client"

import Image from "next/image"

import { useId, useState } from "react"
import { Loader2, Search } from "lucide-react"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { getItemDisplayName, ItemOption } from "@/components/osrs-item-option"
import { MIN_ITEM_QUERY_LENGTH, useOsrsItemSearch } from "@/hooks/use-osrs-item-search"
import type { OsrsItem } from "@/types/osrs-items"
import { cn, getOptimizedImageUrl } from "@/lib/utils"

interface OsrsItemSearchProps {
  onItemSelect: (item: OsrsItem) => void
  selectedItem?: OsrsItem | null
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Focus the trigger button on mount. */
  autoFocus?: boolean
}

/**
 * Popover item picker that selects a single item, for places that change one
 * item (e.g. editing an item goal). Adding several items to a goal uses the
 * inline `ItemPicker` instead.
 */
export function OsrsItemSearch({
  onItemSelect,
  selectedItem,
  placeholder = "Search for an item...",
  className,
  disabled = false,
  autoFocus = false,
}: OsrsItemSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const listId = useId()
  const { ready, loading, items, failed } = useOsrsItemSearch(query)

  const handleSelect = (item: OsrsItem) => {
    onItemSelect(item)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          autoFocus={autoFocus}
        >
          {selectedItem ? (
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 shrink-0">
                <Image
                  fill
                  src={getOptimizedImageUrl(selectedItem.imageUrl)}
                  alt={selectedItem.name}
                  className="object-contain"
                />
              </div>
              <span className="truncate">{getItemDisplayName(selectedItem)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        className="w-[400px] max-w-[calc(100vw-1rem)] p-0"
        align="start"
        collisionPadding={8}
      >
        <Command
          shouldFilter={false}
          className="focus:[&_input]:ring-0 focus-visible:[&_input]:ring-0"
        >
          <CommandInput
            placeholder="Search OSRS items..."
            value={query}
            onValueChange={setQuery}
            className="focus:ring-0 focus-visible:ring-0"
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}
            {!loading && query.trim().length > 0 && !ready && (
              <div className="py-6 text-center text-sm">
                Type at least {MIN_ITEM_QUERY_LENGTH} characters to search
              </div>
            )}
            {!loading && ready && failed && (
              <div className="py-6 text-center text-sm">
                The search failed. Try again.
              </div>
            )}
            {!loading && ready && !failed && items.length === 0 && (
              <div className="py-6 text-center text-sm">No items found</div>
            )}
            {!loading && items.length > 0 && (
              <CommandGroup heading="Items">
                {items.map((item) => {
                  // Items with several ids use the first as their key.
                  const itemId = Array.isArray(item.id) ? item.id[0] : item.id
                  const key = `${itemId}-${item.name}`

                  return (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer gap-3"
                    >
                      <ItemOption item={item} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Compact version for inline use (just shows selected item with change button)
 */
export function OsrsItemSearchCompact({
  onItemSelect,
  selectedItem,
  onClear,
  className,
}: {
  onItemSelect: (item: OsrsItem) => void
  selectedItem: OsrsItem | null
  onClear?: () => void
  className?: string
}) {
  const [showSearch, setShowSearch] = useState(false)

  if (!selectedItem) {
    return (
      <div className={className}>
        <OsrsItemSearch
          onItemSelect={(item) => {
            onItemSelect(item)
            setShowSearch(false)
          }}
          placeholder="Select an item..."
        />
      </div>
    )
  }

  if (showSearch) {
    return (
      <div className={className}>
        <OsrsItemSearch
          onItemSelect={(item) => {
            onItemSelect(item)
            setShowSearch(false)
          }}
          selectedItem={selectedItem}
        />
      </div>
    )
  }

  return (
    <div
      className={cn("flex items-center gap-2 rounded-md border p-2", className)}
    >
      <div className="relative h-8 w-8 shrink-0">
        <Image
          fill
          src={getOptimizedImageUrl(selectedItem.imageUrl)}
          alt={selectedItem.name}
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{selectedItem.name}</div>
        {selectedItem.variant && (
          <div className="text-xs text-muted-foreground">
            {selectedItem.baseName} ({selectedItem.variant})
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => setShowSearch(true)}>
          Change
        </Button>
        {onClear && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
