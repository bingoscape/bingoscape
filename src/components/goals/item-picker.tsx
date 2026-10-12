"use client"

import { useRef, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useOsrsItemSearch } from "@/hooks/use-osrs-item-search"
import { cn } from "@/lib/utils"
import type { OsrsItem } from "@/types/osrs-items"
import { getItemDisplayName, ItemOption } from "@/components/osrs-item-option"
import { ItemSearchStatus } from "./item-search-status"
import { SelectedItemRow } from "./selected-item-row"
import type { SelectedItem } from "./types"
import { itemKey, resolveItemId } from "./utils"

interface ItemPickerProps {
  /** The items picked so far, each with the raw text of its quantity. */
  value: SelectedItem[]
  onChange: (value: SelectedItem[]) => void
  /** Focus the search field on mount. */
  autoFocus?: boolean
}

/**
 * Inline item search with a list of the picked items below it. Picking a
 * result adds it with a quantity of 1 (picking it again removes it) and puts
 * focus back in the search field, so several items can be added in a row
 * with the keyboard: type, arrow keys, Enter.
 */
export function ItemPicker({
  value,
  onChange,
  autoFocus = false,
}: ItemPickerProps) {
  const [query, setQuery] = useState("")
  // Read out by screen readers when the selection changes.
  const [announcement, setAnnouncement] = useState("")
  // The result Enter would pick. Controlled, because new results leave the
  // old highlight pointing at an item that is gone and Enter would do nothing.
  const [highlighted, setHighlighted] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const { ready, loading, items, failed } = useOsrsItemSearch(query)

  const resultKeys = items.map((item) => itemKey(item))
  const activeKey = resultKeys.includes(highlighted)
    ? highlighted
    : (resultKeys[0] ?? "")

  const selectedIds = new Set(value.map((entry) => resolveItemId(entry.item)))

  const focusSearch = () => {
    searchRef.current?.focus()
    // Selecting the text lets the next keystrokes replace the old query.
    searchRef.current?.select()
  }

  const announce = (item: OsrsItem, added: boolean, count: number) => {
    setAnnouncement(
      `${getItemDisplayName(item)} ${added ? "added" : "removed"}. ${count} ${count === 1 ? "item" : "items"} selected.`
    )
  }

  const toggleItem = (item: OsrsItem) => {
    const id = resolveItemId(item)
    if (selectedIds.has(id)) {
      onChange(value.filter((entry) => resolveItemId(entry.item) !== id))
      announce(item, false, value.length - 1)
    } else {
      onChange([...value, { item, quantity: "1" }])
      announce(item, true, value.length + 1)
    }
    focusSearch()
  }

  const removeItem = (item: OsrsItem) => {
    const id = resolveItemId(item)
    onChange(value.filter((entry) => resolveItemId(entry.item) !== id))
    announce(item, false, value.length - 1)
    focusSearch()
  }

  const setQuantity = (item: OsrsItem, quantity: string) => {
    const id = resolveItemId(item)
    onChange(
      value.map((entry) =>
        resolveItemId(entry.item) === id ? { ...entry, quantity } : entry
      )
    )
  }

  const clearAll = () => {
    onChange([])
    setAnnouncement("All items removed.")
    focusSearch()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Items</p>
        <Command
          shouldFilter={false}
          loop
          label="Search items"
          value={activeKey}
          onValueChange={setHighlighted}
          className="bg-field ring-offset-background focus-within:ring-ring border focus-within:ring-2 focus-within:ring-offset-1"
        >
          <CommandInput
            ref={searchRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search items, e.g. abyssal whip"
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="done"
            // The drawer reads this to let Escape clear the text instead of closing.
            data-escape-clears=""
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") setQuery("")
            }}
          />
          <ItemSearchStatus
            search={{ ready, loading, failed, count: items.length }}
          />
          {ready && items.length > 0 && (
            // Bounded so the on-screen keyboard leaves room; it scrolls on its
            // own and hands over to the drawer once it reaches its end.
            <CommandList
              aria-busy={loading}
              className={cn(
                "max-h-[min(16rem,40dvh)]",
                loading && "opacity-60 transition-opacity motion-reduce:transition-none"
              )}
            >
              <CommandGroup className="p-1">
                {items.map((item) => {
                  const selected = selectedIds.has(resolveItemId(item))
                  return (
                    <CommandItem
                      key={itemKey(item)}
                      value={itemKey(item)}
                      onSelect={() => {
                        // Results of an older query are still shown while a
                        // new search runs; don't pick one of those by mistake.
                        if (!loading) toggleItem(item)
                      }}
                      className={cn(
                        "cursor-pointer gap-3",
                        selected && "bg-primary/10"
                      )}
                    >
                      <ItemOption item={item} />
                      {selected ? (
                        <>
                          <Check
                            aria-hidden="true"
                            className="text-success"
                          />
                          <span className="sr-only">Added</span>
                        </>
                      ) : (
                        <Plus
                          aria-hidden="true"
                          className="text-muted-foreground"
                        />
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          )}
        </Command>
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {value.length > 0 && (
        <section aria-labelledby="selected-items-heading" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="selected-items-heading"
              className="text-foreground text-sm font-semibold"
            >
              {`Selected (${value.length})`}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 px-2 text-xs"
            >
              <X aria-hidden="true" />
              Clear all
            </Button>
          </div>
          <ul className="space-y-2">
            {value.map((entry) => (
              <SelectedItemRow
                key={resolveItemId(entry.item)}
                entry={entry}
                onQuantityChange={(quantity) =>
                  setQuantity(entry.item, quantity)
                }
                onRemove={() => removeItem(entry.item)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
