"use client"

import { useEffect, useRef, useState } from "react"

import type { DraftPickState } from "@/lib/draft/types"

const HIGHLIGHT_MS = 2500

/**
 * The pick numbers that appeared after the first render, for a short while:
 * the roster highlights them (and slides them in). Picks that were already
 * there when the room opened are not news.
 */
export function useFreshPicks(
  picks: readonly DraftPickState[]
): ReadonlySet<number> {
  const seen = useRef<Set<number> | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(picks.map((p) => p.pickNo))
      return
    }
    const known = seen.current
    const present = new Set(picks.map((p) => p.pickNo))
    // An undone pick that is picked again is news again.
    known.forEach((no) => {
      if (!present.has(no)) known.delete(no)
    })
    const arrived = [...present].filter((no) => !known.has(no))
    if (arrived.length === 0) return
    arrived.forEach((no) => known.add(no))
    setFresh((current) => new Set([...current, ...arrived]))
    // Not cleared on re-run: every batch must expire on its own.
    window.setTimeout(
      () =>
        setFresh((current) => {
          const next = new Set(current)
          arrived.forEach((no) => next.delete(no))
          return next
        }),
      HIGHLIGHT_MS
    )
  }, [picks])

  return fresh
}
