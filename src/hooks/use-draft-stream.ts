"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { initialLiveState, liveReducer } from "@/lib/draft/live"
import { clockOffsetMs as offsetBetween } from "@/lib/draft/timer"
import { DRAFT_STREAM_EVENTS, type DraftByeReason } from "@/lib/draft/sse"
import type {
  DraftLogEvent,
  DraftSnapshot,
  DraftStatus,
} from "@/lib/draft/types"

/**
 * `connecting`: the first connect. `live`: the stream is open. `reconnecting`:
 * it dropped and is being retried (polling covers the gap). `polling`: the
 * stream keeps failing or is unavailable; the page runs on polling alone and
 * keeps trying the stream in the background.
 */
export type DraftConnection = "connecting" | "live" | "reconnecting" | "polling"

export const POLL_INTERVAL_MS = 3000
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000
/** A stream that has not opened after this long is treated as failed (a proxy that holds the response back). */
const CONNECT_TIMEOUT_MS = 10_000
/** Failures in a row after which the indicator says "Polling". */
const POLLING_AFTER_FAILURES = 3

/** 1 s, 2 s, 4 s ... capped at 30 s, with up to 25% jitter. */
export function backoffDelay(failures: number, random = Math.random): number {
  const base = Math.min(
    BACKOFF_MAX_MS,
    BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1)
  )
  return Math.round(base * (1 + random() * 0.25))
}

interface UseDraftStreamOptions {
  eventId: string
  /** What the Server Component rendered; a newer one replaces the state. */
  snapshot: DraftSnapshot
}

interface StateBody {
  draft: DraftSnapshot | { id: string } | null
  events?: DraftLogEvent[]
  /** Database time of a `?since` answer. */
  serverNow?: string
}

/**
 * The live draft: the shared reducer fed by an `EventSource`, with ETag
 * polling of the state endpoint as the fallback and for resyncs (team draft
 * 2/4, #216). The transport stays behind this hook so it can be swapped. It
 * stops all traffic once the draft is cancelled or applied.
 *
 * - When the draft changes phase (it starts, completes, is applied or
 *   cancelled) it calls `router.refresh()`: the Server Component's parts
 *   (who may pick, the entry link, the empty state after a cancel) follow.
 * - The stream connects with `?since=<lastSeq>` of the rendered snapshot, so
 *   no event between render and subscribe is lost; the server replays what
 *   happened after it (or answers a snapshot when that is too much).
 * - Events go through `liveReducer`: duplicates and old events are dropped, a
 *   gap refetches the snapshot.
 * - The browser's own reconnects are not used: on any error the source is
 *   closed and reopened with exponential backoff and a fresh `since`. Polling
 *   runs whenever the stream is not live and the tab is visible.
 * - The pick countdown runs on `clockOffsetMs`: database time minus this
 *   browser's time, measured whenever the server tells its time (a snapshot,
 *   the stream's `clock` frames, a `?since` answer). The deadline itself is
 *   database time, so the local clock cannot move it.
 * - `sync()` fetches what happened after `lastSeq` right now (after an
 *   action, so the actor does not wait for the stream) and resolves with
 *   those events.
 */
export function useDraftStream({ eventId, snapshot }: UseDraftStreamOptions) {
  const router = useRouter()
  // Kept in a ref so the transport effects do not restart with the router.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  }, [router])
  const [live, dispatch] = useReducer(liveReducer, snapshot, initialLiveState)
  const [connection, setConnection] = useState<DraftConnection>("connecting")
  // Starts from the rendered snapshot's database time; the stream's `clock`
  // frames, the snapshots and the `?since` answers keep it current.
  const [clockOffsetMs, setClockOffsetMs] = useState(
    () => offsetBetween(snapshot.serverNow, Date.now()) ?? 0
  )
  const noteServerTime = useCallback((serverNow: string | undefined) => {
    const offset = offsetBetween(serverNow, Date.now())
    if (offset !== null) setClockOffsetMs(offset)
  }, [])
  // Nothing can change any more once the draft is cancelled or applied: stop
  // all traffic.
  const { status, applied } = live.state
  const enabled = status !== "cancelled" && !(status === "complete" && applied)

  // The server rendered parts of the page depend on the phase of the draft
  // (the viewer's `canPick` once the captains lead Teams, the header's badge,
  // the room itself once it is cancelled): when it changes, refresh them.
  const seenPhase = useRef({ status, applied })
  useEffect(() => {
    const previous = seenPhase.current
    seenPhase.current = { status, applied }
    const preStart = (s: DraftStatus) => s === "setup" || s === "open"
    const changed =
      (preStart(previous.status) && !preStart(status)) ||
      (status === "cancelled" && previous.status !== "cancelled") ||
      (status === "complete" && previous.status !== "complete") ||
      (applied && !previous.applied)
    if (changed) routerRef.current.refresh()
  }, [status, applied])

  // A newer snapshot from the server (after router.refresh()) replaces the state.
  const [seenSnapshot, setSeenSnapshot] = useState(snapshot)
  if (snapshot !== seenSnapshot) {
    setSeenSnapshot(snapshot)
    dispatch({ type: "snapshot", snapshot })
  }

  const lastSeqRef = useRef(live.state.lastSeq)
  const draftIdRef = useRef(live.draftId)
  const etagRef = useRef<{ since: number; value: string } | null>(null)
  const resyncing = useRef(false)
  useEffect(() => {
    lastSeqRef.current = live.state.lastSeq
    draftIdRef.current = live.draftId
  }, [live.state.lastSeq, live.draftId])

  const resync = useCallback(
    async function run(): Promise<void> {
      if (resyncing.current) return
      resyncing.current = true
      try {
        const response = await fetch(`/api/events/${eventId}/draft/state`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error(`state ${response.status}`)
        const body = (await response.json()) as StateBody
        if (body.draft === null) routerRef.current.refresh()
        else {
          const fresh = body.draft as DraftSnapshot
          dispatch({ type: "snapshot", snapshot: fresh })
          noteServerTime(fresh.serverNow)
        }
      } catch {
        // Offline or a hiccup: try again shortly.
        window.setTimeout(() => {
          resyncing.current = false
          void run()
        }, 2000)
        return
      }
      resyncing.current = false
    },
    [eventId, noteServerTime]
  )

  const needsResync = live.needsResync
  useEffect(() => {
    if (enabled && needsResync) void resync()
  }, [enabled, needsResync, resync])

  const fetchDelta = useCallback(
    async (useEtag: boolean): Promise<DraftLogEvent[]> => {
      const since = lastSeqRef.current
      const known =
        useEtag && etagRef.current?.since === since
          ? etagRef.current.value
          : undefined
      const response = await fetch(
        `/api/events/${eventId}/draft/state?since=${since}`,
        {
          headers: known ? { "If-None-Match": known } : {},
          cache: "no-store",
        }
      )
      if (response.status === 304 || !response.ok) return []
      const value = response.headers.get("ETag")
      if (value) etagRef.current = { since, value }
      const body = (await response.json()) as StateBody
      noteServerTime(body.serverNow)
      if (body.draft === null) {
        routerRef.current.refresh()
        return []
      }
      if ((body.draft as { id: string }).id !== draftIdRef.current) {
        void resync()
        return []
      }
      const events = body.events ?? []
      if (events.length > 0) dispatch({ type: "events", events })
      return events
    },
    [eventId, resync, noteServerTime]
  )

  const sync = useCallback(async (): Promise<DraftLogEvent[]> => {
    try {
      return await fetchDelta(false)
    } catch {
      return []
    }
  }, [fetchDelta])

  // The stream.
  useEffect(() => {
    if (!enabled) return
    if (typeof EventSource === "undefined") {
      setConnection("polling")
      return
    }
    let disposed = false
    let source: EventSource | null = null
    let timer: number | undefined
    let openTimer: number | undefined
    let failures = 0

    const retryLater = () => {
      if (disposed) return
      failures += 1
      setConnection(
        failures >= POLLING_AFTER_FAILURES ? "polling" : "reconnecting"
      )
      timer = window.setTimeout(connect, backoffDelay(failures))
    }

    function connect() {
      if (disposed) return
      const next = new EventSource(
        `/api/events/${eventId}/draft/stream?since=${lastSeqRef.current}`
      )
      source = next
      openTimer = window.setTimeout(() => {
        next.close()
        if (source === next) source = null
        retryLater()
      }, CONNECT_TIMEOUT_MS)
      next.onopen = () => {
        window.clearTimeout(openTimer)
        failures = 0
        setConnection("live")
      }
      next.addEventListener(DRAFT_STREAM_EVENTS.draft, (message) => {
        const event = JSON.parse((message as MessageEvent<string>).data)
        dispatch({ type: "events", events: [event as DraftLogEvent] })
      })
      next.addEventListener(DRAFT_STREAM_EVENTS.reset, (message) => {
        const body = JSON.parse((message as MessageEvent<string>).data) as {
          draft: DraftSnapshot | null
        }
        if (body.draft) {
          dispatch({ type: "snapshot", snapshot: body.draft })
          noteServerTime(body.draft.serverNow)
        } else routerRef.current.refresh()
      })
      next.addEventListener(DRAFT_STREAM_EVENTS.clock, (message) => {
        const { serverNow } = JSON.parse(
          (message as MessageEvent<string>).data
        ) as { serverNow: string }
        noteServerTime(serverNow)
      })
      next.addEventListener(DRAFT_STREAM_EVENTS.bye, (message) => {
        const { reason } = JSON.parse(
          (message as MessageEvent<string>).data
        ) as { reason: DraftByeReason }
        next.close()
        source = null
        window.clearTimeout(openTimer)
        if (reason === "cap") {
          // Routine: the server re-authorizes by closing; reconnect at once.
          connect()
        } else {
          retryLater()
        }
      })
      next.onerror = () => {
        // Close so the browser does not retry with a stale `since` (or, for a
        // 4xx/5xx, never): the backoff above owns reconnecting.
        window.clearTimeout(openTimer)
        next.close()
        if (source === next) source = null
        retryLater()
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(timer)
      window.clearTimeout(openTimer)
      source?.close()
    }
  }, [eventId, enabled, noteServerTime])

  // Polling: whenever the stream is not live.
  const polling =
    enabled && connection !== "live" && connection !== "connecting"
  useEffect(() => {
    if (!polling) return
    let inFlight = false
    const poll = async () => {
      if (inFlight || document.visibilityState !== "visible") return
      inFlight = true
      try {
        await fetchDelta(true)
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
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [polling, fetchDelta])

  return { live, connection, sync, active: enabled, clockOffsetMs }
}
