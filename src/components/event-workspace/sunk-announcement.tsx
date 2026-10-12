"use client"

import { useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { newlySunkTileIds } from "@/lib/battleship-marks"

interface SunkAnnouncementProps {
  /** The viewer's Team's sunk Tiles, from the latest server render. */
  sunkTileIds: readonly string[]
}

const DESCRIPTION = "Your team destroyed an enemy ship."

/**
 * Announces "Ship sunk!" when a refresh of the page props brings Tiles that
 * were not sunk before. It only diffs the previous and next props (no
 * fetching) and says nothing on the first render, so opening the Board never
 * replays old news. Mount it with a `key` per Board: another Board's ships are
 * not "new".
 *
 * The announcement is a toast (default variant, not an error) plus a polite
 * live region for screen readers. Ships are identified by their Tiles only, so
 * several ships sunk by one refresh are announced once.
 */
export function SunkAnnouncement({ sunkTileIds }: SunkAnnouncementProps) {
  // The previous props live in state and are compared while rendering (the
  // documented way to react to a prop change without an effect that sets
  // state); `count` is how many times something new sank.
  const [previous, setPrevious] = useState({ ids: sunkTileIds, count: 0 })
  if (previous.ids !== sunkTileIds) {
    const added = newlySunkTileIds(new Set(previous.ids), sunkTileIds)
    setPrevious({
      ids: sunkTileIds,
      count: previous.count + (added.length > 0 ? 1 : 0),
    })
  }

  const { count } = previous
  useEffect(() => {
    if (count > 0) toast({ title: "Ship sunk!", description: DESCRIPTION })
  }, [count])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {count > 0 && <p key={count}>{`Ship sunk! ${DESCRIPTION}`}</p>}
    </div>
  )
}
