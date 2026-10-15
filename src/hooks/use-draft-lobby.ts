"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { POLL_INTERVAL_MS } from "@/hooks/use-draft-stream"

/**
 * The draft room's waiting state: the Event has no draft yet, so there is
 * nothing to stream (the stream is keyed by draft and answers 404). Polls the
 * state endpoint with its ETag, which for "no draft" is constant, so an idle
 * waiting room costs a 304 every few seconds, and calls `router.refresh()` as
 * soon as a draft exists. The Server Component then renders the room itself.
 *
 * Polls only while the tab is visible (and once when it becomes visible), and
 * stops for good when the viewer is no longer allowed to see the draft.
 */
export function useDraftLobby(eventId: string): void {
  const router = useRouter()
  // Kept in a ref so the polling effect does not restart with the router.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    let etag: string | null = null
    let inFlight = false
    let stopped = false

    const check = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return
      inFlight = true
      try {
        const response = await fetch(`/api/events/${eventId}/draft/state`, {
          headers: etag ? { "If-None-Match": etag } : {},
          cache: "no-store",
        })
        if (response.status === 304) return
        if ([401, 403, 404].includes(response.status)) {
          stopped = true
          return
        }
        if (!response.ok) return
        etag = response.headers.get("ETag")
        const body = (await response.json()) as { draft: unknown }
        if (body.draft !== null) routerRef.current.refresh()
      } catch {
        // Offline or a hiccup: the next tick tries again.
      } finally {
        inFlight = false
      }
    }

    // A draft may have been created between the render and now.
    void check()
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS)
    const onVisible = () => void check()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [eventId])
}
