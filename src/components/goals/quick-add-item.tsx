"use client"

import { useId, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ItemOption } from "@/components/osrs-item-option"
import { useOsrsItemSearch } from "@/hooks/use-osrs-item-search"
import { parseTargetInput, validateNumberInput } from "@/lib/number-input"
import { cn } from "@/lib/utils"
import type { OsrsItem } from "@/types/osrs-items"
import { buildItemGoalInput, formatAddedGoal } from "./goal-inputs"
import { ItemSearchStatus } from "./item-search-status"
import {
  InlineError,
  QuickAddButton,
  type QuickAddFormProps,
} from "./quick-add-shared"
import { itemKey } from "./utils"

/**
 * Item search with a quantity. Enter adds the highlighted result (the top
 * one until the arrow keys move the highlight) with the quantity, empties the
 * search and keeps focus in it, so several items can be added back to back.
 * Pressing Enter while the search is still running adds the top match as soon
 * as it arrives.
 */
export function QuickAddItem({ onAdd, announce }: QuickAddFormProps) {
  const ids = useId()
  const quantityId = `${ids}-quantity`
  const quantityErrorId = `${ids}-quantity-error`

  const [query, setQuery] = useState("")
  const [quantity, setQuantity] = useState("1")
  // Set by a rejected add, so the quantity error shows before the field is left.
  const [attempted, setAttempted] = useState(false)
  // The result Enter adds. Controlled, because new results leave the old
  // highlight pointing at an item that is gone and Enter would do nothing.
  const [highlighted, setHighlighted] = useState("")
  // Shows the hint under the field after Add was pressed with too little typed.
  const [hinting, setHinting] = useState(false)
  // The query Enter was pressed for while it was still being searched. The ref
  // is what the search consumes; the state is what the status line shows.
  const queuedRef = useRef<string | null>(null)
  const [queuedQuery, setQueuedQuery] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)

  const quantityError = validateNumberInput(quantity)
  const showQuantityError = attempted && quantityError !== null

  const addItem = (item: OsrsItem) => {
    const targetValue = parseTargetInput(quantity)
    if (targetValue === null) {
      setAttempted(true)
      quantityRef.current?.focus()
      quantityRef.current?.select()
      return
    }

    const input = buildItemGoalInput(item, targetValue)
    const previous = { query, quantity }
    queuedRef.current = null
    setQueuedQuery(null)
    setAttempted(false)
    setHinting(false)
    setQuery("")
    setQuantity("1")
    searchRef.current?.focus()

    void onAdd(input).then((result) => {
      if (result.success) {
        announce(`Added ${formatAddedGoal(input)}`)
        return
      }
      // Put back what was typed, unless the user already started the next one.
      setQuery((current) => (current === "" ? previous.query : current))
      setQuantity((current) => (current === "1" ? previous.quantity : current))
    })
  }

  const { ready, loading, items, failed } = useOsrsItemSearch(
    query,
    undefined,
    // Enter was pressed while this search ran: add its top match now.
    (searchedQuery, found) => {
      if (queuedRef.current !== searchedQuery) return
      queuedRef.current = null
      const top = found[0]
      if (top) addItem(top)
    }
  )
  const trimmed = query.trim()
  const resultKeys = items.map(itemKey)
  const activeKey = resultKeys.includes(highlighted)
    ? highlighted
    : (resultKeys[0] ?? "")
  const activeItem = items.find((item) => itemKey(item) === activeKey)

  const queueTopMatch = () => {
    queuedRef.current = trimmed
    setQueuedQuery(trimmed)
  }

  /** Add button and Enter in the quantity field. */
  const submit = () => {
    if (!ready) {
      setHinting(true)
      searchRef.current?.focus()
    } else if (loading) {
      queueTopMatch()
    } else if (activeItem) {
      addItem(activeItem)
    } else {
      searchRef.current?.focus()
    }
  }

  const showStatus = trimmed !== "" || hinting

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        // Keep the submit from reaching a form further up the React tree.
        event.stopPropagation()
        submit()
      }}
    >
      <Command
        shouldFilter={false}
        loop
        label="Search items"
        value={activeKey}
        onValueChange={setHighlighted}
        onKeyDown={(event) => {
          // Enter during a running search must not pick a result of the
          // previous query; wait for the new ones instead.
          if (
            event.key === "Enter" &&
            !event.nativeEvent.isComposing &&
            ready &&
            loading
          ) {
            event.preventDefault()
            queueTopMatch()
          }
        }}
        className="h-auto overflow-visible bg-transparent"
      >
        <div className="flex items-start gap-2">
          <div
            data-quick-add-primary=""
            className="bg-field ring-offset-background focus-within:ring-ring min-w-0 flex-1 rounded-sm border focus-within:ring-2 focus-within:ring-offset-1 **:[[cmdk-input-wrapper]]:border-b-0"
          >
            <CommandInput
              ref={searchRef}
              value={query}
              onValueChange={(value) => {
                setQuery(value)
                queuedRef.current = null
                setQueuedQuery(null)
                setHinting(false)
              }}
              placeholder="Search items..."
              autoComplete="off"
              enterKeyHint="done"
              className="h-9 pointer-coarse:h-11"
              onKeyDown={(event) => {
                if (event.key === "Escape" && query !== "") setQuery("")
              }}
            />
          </div>
          {/* Keys here belong to the quantity field and button, not to the result list. */}
          <div
            className="flex shrink-0 items-start gap-1.5"
            onKeyDown={(event) => event.stopPropagation()}
          >
            <span
              aria-hidden="true"
              className="text-muted-foreground flex h-9 items-center text-sm pointer-coarse:h-11"
            >
              ×
            </span>
            <Input
              ref={quantityRef}
              id={quantityId}
              aria-label="Quantity"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={showQuantityError}
              aria-describedby={showQuantityError ? quantityErrorId : undefined}
              className={cn(
                "h-9 w-16 px-2 text-center tabular-nums pointer-coarse:h-11",
                showQuantityError && "border-danger focus-visible:ring-danger"
              )}
            />
            <QuickAddButton label="Add item" />
          </div>
        </div>

        {showQuantityError && (
          <div className="mt-1.5">
            <InlineError
              id={quantityErrorId}
            >{`Quantity: ${quantityError}`}</InlineError>
          </div>
        )}

        {showStatus && (
          <ItemSearchStatus
            search={{
              ready,
              loading,
              failed,
              count: items.length,
              queued: loading && queuedQuery === trimmed,
            }}
            className="mt-1 min-h-0 border-0 px-0.5 py-0.5"
          />
        )}

        {ready && items.length > 0 && (
          // Bounded so the on-screen keyboard leaves room for the field above.
          <CommandList
            aria-busy={loading}
            className={cn(
              "bg-popover mt-1 max-h-[min(14rem,35dvh)] rounded-sm border",
              loading &&
                "opacity-60 transition-opacity motion-reduce:transition-none"
            )}
          >
            <CommandGroup className="p-1">
              {items.map((item) => (
                <CommandItem
                  key={itemKey(item)}
                  value={itemKey(item)}
                  onSelect={() => addItem(item)}
                  className="cursor-pointer gap-3"
                >
                  <ItemOption item={item} />
                  <Plus aria-hidden="true" className="text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
    </form>
  )
}
