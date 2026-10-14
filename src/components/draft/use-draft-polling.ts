"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const POLL_INTERVAL_MS = 3000

interface UseDraftPollingOptions {
  eventId: string
  /** `seq` of the last log event the page was rendered with. */
  lastSeq: number
  /** Stop polling once nothing can change any more (applied, cancelled). */
  enabled: boolean
}

/**
 * Keeps the draft room current without a live connection: every 3 s it asks
 * the state endpoint for the log events after `lastSeq`, sending the last ETag
 * so an idle draft answers an empty 304. New events (or a draft that
 * disappeared) call `router.refresh()`, which re-renders the Server Component
 * with fresh props and restarts the poll from the new `lastSeq`. Polls only
 * while the tab is visible and catches up when it becomes visible again.
 * Phase 2 replaces the interval with a stream behind this same hook.
 */
export function useDraftPolling({
  eventId,
  lastSeq,
  enabled,
}: UseDraftPollingOptions) {
  const router = useRouter()
  // One ETag per `since`: the response shape (and ETag) depends on it.
  const etag = useRef<{ since: number; value: string } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let inFlight = false

    const poll = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") {
        return
      }
      inFlight = true
      try {
        const known =
          etag.current?.since === lastSeq ? etag.current.value : undefined
        const response = await fetch(
          `/api/events/${eventId}/draft/state?since=${lastSeq}`,
          {
            headers: known ? { "If-None-Match": known } : {},
            cache: "no-store",
          }
        )
        if (cancelled || response.status === 304 || !response.ok) return
        const value = response.headers.get("ETag")
        if (value) etag.current = { since: lastSeq, value }
        const body = (await response.json()) as {
          draft: unknown
          events?: unknown[]
        }
        if (body.draft === null || (body.events?.length ?? 0) > 0) {
          router.refresh()
        }
      } catch {
        // Offline or a hiccup: the next tick tries again.
      } finally {
        inFlight = false
      }
    }

    const timer = window.setInterval(poll, POLL_INTERVAL_MS)
    const onVisible = () => void poll()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [eventId, lastSeq, enabled, router])
}
