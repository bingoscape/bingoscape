"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Search, Loader2 } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import type { OsrsItem } from "@/types/osrs-items"
import { cn } from "@/lib/utils"

interface OsrsItemSearchProps {
  onItemSelect: (item: OsrsItem) => void
  selectedItem?: OsrsItem | null
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function OsrsItemSearch({
  onItemSelect,
  selectedItem,
  placeholder = "Search for an item...",
  className,
  disabled = false,
}: OsrsItemSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<OsrsItem[]>([])
  const [loading, setLoading] = useState(false)

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
    onItemSelect(item)
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
          {selectedItem ? (
            <div className="flex items-center gap-2">
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
        <Command shouldFilter={false} className="[&_input]:focus:ring-0 [&_input]:focus-visible:ring-0">
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
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
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

                  return (
                    <CommandItem
                      key={uniqueKey}
                      value={item.name}
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-8 w-8 object-contain flex-shrink-0"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium truncate">{item.name}</span>
                          {item.variant && (
                            <span className="text-xs text-muted-foreground">
                              {item.baseName} ({item.variant})
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ID: {itemId}
                        </span>
                      </div>
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
    <div className={cn("flex items-center gap-2 p-2 border rounded-md", className)}>
      <img
        src={selectedItem.imageUrl}
        alt={selectedItem.name}
        className="h-8 w-8 object-contain"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{selectedItem.name}</div>
        {selectedItem.variant && (
          <div className="text-xs text-muted-foreground">
            {selectedItem.baseName} ({selectedItem.variant})
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(true)}
        >
          Change
        </Button>
        {onClear && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
