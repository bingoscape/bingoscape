"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ITEM_SEARCH_LIMIT,
  MIN_ITEM_QUERY_LENGTH,
  type OsrsItemSearchState,
} from "@/hooks/use-osrs-item-search"

interface ItemSearchStatusProps {
  search: Pick<OsrsItemSearchState, "ready" | "loading" | "failed"> & {
    /** How many results are listed. */
    count: number
    /** Enter was pressed while searching: the top match is added when it arrives. */
    queued?: boolean
  }
  className?: string
}

/**
 * One line telling what the item search is doing: how to start, that it is
 * running, that it failed, or how many items matched. A polite live region.
 */
export function ItemSearchStatus({ search, className }: ItemSearchStatusProps) {
  const { ready, loading, failed, count, queued = false } = search
  return (
    <p
      role="status"
      className={cn(
        "text-muted-foreground flex min-h-9 items-center gap-2 border-b px-3 py-1.5 text-xs",
        className
      )}
    >
      {!ready ? (
        `Type at least ${MIN_ITEM_QUERY_LENGTH} characters, like “whip” or “dragon boots”.`
      ) : loading ? (
        <>
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
          />
          {queued ? "Searching, then adding the top match..." : "Searching..."}
        </>
      ) : failed ? (
        "The search failed. Try again."
      ) : count === 0 ? (
        "No items found. Check the spelling or try a shorter name."
      ) : count >= ITEM_SEARCH_LIMIT ? (
        `Showing the first ${ITEM_SEARCH_LIMIT} matches. Type more to narrow them down.`
      ) : (
        `${count} ${count === 1 ? "match" : "matches"}`
      )}
    </p>
  )
}
