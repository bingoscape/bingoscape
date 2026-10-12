"use client"

import { useEffect, useRef, useState } from "react"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import type { OsrsItem } from "@/types/osrs-items"

/** Shortest query the item search accepts (the server action enforces it too). */
export const MIN_ITEM_QUERY_LENGTH = 2

/** How many results the item pickers show. */
export const ITEM_SEARCH_LIMIT = 30

const SEARCH_DEBOUNCE_MS = 300

interface CompletedSearch {
  query: string
  items: OsrsItem[]
  failed: boolean
}

export interface OsrsItemSearchState {
  /** Whether the query is long enough to search. */
  ready: boolean
  /** A search for the current query is pending or running. */
  loading: boolean
  /**
   * Results for the current query. While a newer query is loading these are
   * the previous results, so the list does not flash empty between keystrokes.
   */
  items: OsrsItem[]
  /** The search for the current query failed. */
  failed: boolean
}

/**
 * Debounced search-as-you-type over the OSRS item index. Responses to
 * superseded queries are dropped so a slow earlier request can't overwrite
 * newer results.
 */
export function useOsrsItemSearch(
  query: string,
  limit = ITEM_SEARCH_LIMIT,
  /**
   * Called with the trimmed query and its items when a search for the current
   * query finished successfully (not for superseded ones). Lets a caller act
   * on arriving results, e.g. add the top match.
   */
  onResults?: (query: string, items: OsrsItem[]) => void
): OsrsItemSearchState {
  const trimmed = query.trim()
  const ready = trimmed.length >= MIN_ITEM_QUERY_LENGTH
  const [completed, setCompleted] = useState<CompletedSearch | null>(null)
  const onResultsRef = useRef(onResults)
  useEffect(() => {
    onResultsRef.current = onResults
  })

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const result = await searchOsrsItems(trimmed, limit)
        if (cancelled) return
        const found = result.success && result.items ? result.items : []
        setCompleted({ query: trimmed, items: found, failed: !result.success })
        if (result.success) onResultsRef.current?.(trimmed, found)
      } catch (error) {
        if (cancelled) return
        console.error("Error searching items:", error)
        setCompleted({ query: trimmed, items: [], failed: true })
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, ready, limit])

  if (!ready) {
    // Forget the last results, so typing again after clearing the field does
    // not flash the results of the old query.
    if (completed) setCompleted(null)
    return { ready, loading: false, items: [], failed: false }
  }

  const settled = completed?.query === trimmed
  return {
    ready,
    loading: !settled,
    items: completed?.items ?? [],
    failed: settled && completed.failed,
  }
}
