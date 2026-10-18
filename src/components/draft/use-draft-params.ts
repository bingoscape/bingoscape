"use client"

import { useCallback } from "react"
import { useSearchParams } from "next/navigation"

import {
  isDraftTab,
  isPoolSort,
  type DraftTab,
  type PoolSort,
} from "@/lib/draft/view"

/**
 * The shareable state of the draft room lives in the URL: `?tab=` (the mobile
 * tab), `?q=` (player search), `?sort=` and `?skill=`. Written with the
 * History API (Next syncs `useSearchParams` with it), so changing a filter
 * does not ask the server for a new page.
 */
export function useDraftParams() {
  const searchParams = useSearchParams()

  const tabParam = searchParams.get("tab")
  const sortParam = searchParams.get("sort")
  const tab: DraftTab = isDraftTab(tabParam) ? tabParam : "pool"
  const sort: PoolSort = isPoolSort(sortParam) ? sortParam : "rating"
  const q = searchParams.get("q") ?? ""
  const skill = searchParams.get("skill") ?? ""

  const setParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    )
  }, [])

  return { tab, sort, q, skill, setParam }
}
