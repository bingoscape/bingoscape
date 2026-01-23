"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Search, Loader2, CheckSquare, Square, X } from "lucide-react"
import {
  Command,
  CommandEmpty,
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
import { searchOsrsItems } from "@/app/actions/osrs-items"
import type { OsrsItem } from "@/types/osrs-items"
import { cn } from "@/lib/utils"

interface OsrsItemSearchProps {
  onItemSelect: (item: OsrsItem | OsrsItem[]) => void
  selectedItem?: OsrsItem | null
  selectedItems?: OsrsItem[]
  placeholder?: string
  className?: string
  disabled?: boolean
  multiSelect?: boolean
}

export function OsrsItemSearch({
  onItemSelect,
  selectedItem,
  selectedItems = [],
  placeholder = "Search for an item...",
  className,
  disabled = false,
  multiSelect = false,
}: OsrsItemSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<OsrsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [internalSelectedItems, setInternalSelectedItems] =
    useState<OsrsItem[]>(selectedItems)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        void searchItems(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const searchItems = async (searchQuery: string) => {
    setLoading(true)
    try {
      const result = await searchOsrsItems(searchQuery, 20)
      if (result.success && result.items) {
        setResults(result.items)
      } else {
        setResults([])
      }
    } catch (error) {
      console.error("Error searching items:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (item: OsrsItem) => {
    if (multiSelect) {
      // Toggle item in multi-select mode
      const itemId = Array.isArray(item.id) ? item.id[0] : item.id
      const isSelected = internalSelectedItems.some((selectedItem) => {
        const selectedId = Array.isArray(selectedItem.id)
          ? selectedItem.id[0]
          : selectedItem.id
        return selectedId === itemId
      })

      const newSelection = isSelected
        ? internalSelectedItems.filter((selectedItem) => {
            const selectedId = Array.isArray(selectedItem.id)
              ? selectedItem.id[0]
              : selectedItem.id
            return selectedId !== itemId
          })
        : [...internalSelectedItems, item]

      setInternalSelectedItems(newSelection)
      onItemSelect(newSelection)
    } else {
      // Single select mode
      onItemSelect(item)
      setOpen(false)
      setQuery("")
      setResults([])
    }
  }

  const isItemSelected = (item: OsrsItem): boolean => {
    if (!multiSelect) return false
    const itemId = Array.isArray(item.id) ? item.id[0] : item.id
    return internalSelectedItems.some((selectedItem) => {
      const selectedId = Array.isArray(selectedItem.id)
        ? selectedItem.id[0]
        : selectedItem.id
      return selectedId === itemId
    })
  }

  const handleClearAll = () => {
    setInternalSelectedItems([])
    onItemSelect([])
  }

  const handleDone = () => {
    setOpen(false)
    setQuery("")
    setResults([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {multiSelect && internalSelectedItems.length > 0 ? (
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-500" />
              <span className="truncate">
                {internalSelectedItems.length} item
                {internalSelectedItems.length !== 1 ? "s" : ""} selected
              </span>
            </div>
          ) : selectedItem && !multiSelect ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.name}
                className="h-6 w-6 object-contain"
              />
              <span className="truncate">{selectedItem.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command
          shouldFilter={false}
          className="[&_input]:focus:ring-0 [&_input]:focus-visible:ring-0"
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
            {!loading && query.length > 0 && query.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No items found</CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup heading="Items">
                {results.map((item) => {
                  // Handle items with multiple IDs (use first ID as unique key)
                  const itemId = Array.isArray(item.id) ? item.id[0] : item.id
                  const uniqueKey = `${itemId}-${item.name}`
                  const selected = isItemSelected(item)

                  return (
                    <CommandItem
                      key={uniqueKey}
                      value={item.name}
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <div className="flex w-full items-center gap-3">
                        {multiSelect &&
                          (selected ? (
                            <CheckSquare className="h-5 w-5 flex-shrink-0 text-blue-500" />
                          ) : (
                            <Square className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                          ))}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-8 w-8 flex-shrink-0 object-contain"
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">
                            {item.name}
                          </span>
                          {item.variant && (
                            <span className="text-xs text-muted-foreground">
                              {item.baseName} ({item.variant})
                            </span>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-muted-foreground">
                          ID: {itemId}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
          {multiSelect && internalSelectedItems.length > 0 && (
            <div className="flex items-center gap-2 border-t bg-muted/30 p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-8 flex-1 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                Clear All
              </Button>
              <Button
                size="sm"
                onClick={handleDone}
                className="h-8 flex-1 text-xs"
              >
                Done
              </Button>
            </div>
          )}
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
            if (!Array.isArray(item)) {
              onItemSelect(item)
              setShowSearch(false)
            }
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
            if (!Array.isArray(item)) {
              onItemSelect(item)
              setShowSearch(false)
            }
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={selectedItem.imageUrl}
        alt={selectedItem.name}
        className="h-8 w-8 object-contain"
      />
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
