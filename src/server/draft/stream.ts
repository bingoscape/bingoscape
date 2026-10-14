import "server-only"

import { logger } from "@/lib/logger"
import {
  DRAFT_STREAM_EVENTS,
  SSE_HEARTBEAT,
  formatSseFrame,
  type DraftByeReason,
} from "@/lib/draft/sse"
import { subscribeToDraft } from "@/server/draft/hub"
import { loadDraftEventsSince, loadDraftSnapshot } from "@/server/draft/queries"

/**
 * The body of `GET /api/events/[id]/draft/stream` (team draft 2/4, #216).
 *
 * Order of events, so nothing is lost between "read" and "live":
 * 1. subscribe to the hub (LISTEN is active when this resolves),
 * 2. read the log after `since` and send it (or a `reset` snapshot when the
 *    client is too far behind, ahead of the log, or gave no position),
 * 3. from then on every notification triggers another read of the log after
 *    the last `seq` sent. Reads are serialised, and a notification that
 *    arrives during a read just schedules one more read.
 *
 * Authorization happens once, in the route. The stream ends itself after
 * `maxLifetimeMs` (plus jitter) with `bye(cap)`, so the client reconnects and
 * is authorized again.
 */

/** Tunable for tests; the defaults are what production runs with. */
export const draftStreamConfig = {
  /** Cap on one stream's lifetime: the client then reconnects. */
  maxLifetimeMs: 5 * 60_000,
  /** Random extra lifetime so a deploy's clients do not reconnect together. */
  lifetimeJitterMs: 30_000,
  heartbeatMs: 15_000,
  /** More missed events than this are answered with a snapshot instead. */
  maxReplay: 200,
  /** `retry:` hint for the browser's own reconnects. */
  retryMs: 2_000,
  /** A client this many chunks behind is dropped. */
  maxQueuedChunks: 100,
}

const TERMINAL_EVENTS = new Set(["cancelled", "applied"])

export interface OpenDraftStreamInput {
  eventId: string
  draftId: string
  userId: string
  /** Position of the client; null: it has none and gets a snapshot. */
  since: number | null
  /** Highest `seq` of the draft right now. */
  currentSeq: number
  signal: AbortSignal
}

/** The event stream, or "limit" when the user holds too many streams. */
export async function openDraftStream(
  input: OpenDraftStreamInput
): Promise<ReadableStream<Uint8Array> | "limit"> {
  const config = draftStreamConfig
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let closed = false
  let started = false
  let draining = false
  let again = false
  let lastSent = input.since ?? 0
  let needsReset = input.since === null || input.since > input.currentSeq
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let lifetime: ReturnType<typeof setTimeout> | undefined
  // Set once subscribed; `close` may run before that.
  const subscribed: { unsubscribe?: () => void } = {}

  const write = (text: string) => {
    if (closed || !controller) return
    try {
      controller.enqueue(encoder.encode(text))
      if ((controller.desiredSize ?? 0) < -config.maxQueuedChunks) {
        // The client does not read: do not queue for it forever.
        close("error")
      }
    } catch {
      close()
    }
  }

  const onAbort = () => close()

  function close(reason?: DraftByeReason) {
    if (closed) return
    if (reason) {
      write(
        formatSseFrame({ event: DRAFT_STREAM_EVENTS.bye, data: { reason } })
      )
    }
    closed = true
    clearInterval(heartbeat)
    clearTimeout(lifetime)
    subscribed.unsubscribe?.()
    input.signal.removeEventListener("abort", onAbort)
    try {
      controller?.close()
    } catch {
      // Already closed or cancelled by the client.
    }
  }

  const sendReset = async () => {
    const snapshot = await loadDraftSnapshot(input.eventId)
    if (!snapshot) {
      write(
        formatSseFrame({
          event: DRAFT_STREAM_EVENTS.reset,
          data: { draft: null },
        })
      )
      close("done")
      return
    }
    write(
      formatSseFrame({
        id: snapshot.state.lastSeq,
        event: DRAFT_STREAM_EVENTS.reset,
        data: { draft: snapshot },
      })
    )
    lastSent = snapshot.state.lastSeq
    // The Event moved on to another draft: this stream follows the old one.
    if (snapshot.draftId !== input.draftId) close("done")
  }

  const step = async () => {
    if (needsReset) {
      needsReset = false
      await sendReset()
      return
    }
    const events = await loadDraftEventsSince(
      input.draftId,
      lastSent,
      config.maxReplay + 1
    )
    if (events.length > config.maxReplay) {
      await sendReset()
      return
    }
    for (const event of events) {
      write(
        formatSseFrame({
          id: event.seq,
          event: DRAFT_STREAM_EVENTS.draft,
          data: event,
        })
      )
      lastSent = event.seq
      if (TERMINAL_EVENTS.has(event.type)) {
        close("done")
        return
      }
    }
  }

  const drain = async () => {
    if (closed) return
    if (draining) {
      again = true
      return
    }
    draining = true
    try {
      do {
        again = false
        await step()
      } while (again && !closed)
    } catch (error) {
      logger.error(
        { error, draftId: input.draftId },
        "Error reading the draft log for a stream"
      )
      close("error")
    } finally {
      draining = false
    }
  }

  const subscription = await subscribeToDraft({
    draftId: input.draftId,
    userId: input.userId,
    wake: () => {
      if (started) void drain()
    },
    close,
  })
  if (!subscription) return "limit"
  subscribed.unsubscribe = subscription.unsubscribe

  return new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
      started = true
      if (closed || input.signal.aborted) {
        close()
        try {
          c.close()
        } catch {
          // Closed by close() above.
        }
        return
      }
      input.signal.addEventListener("abort", onAbort, { once: true })
      write(formatSseFrame({ retry: config.retryMs }))
      heartbeat = setInterval(() => write(SSE_HEARTBEAT), config.heartbeatMs)
      lifetime = setTimeout(
        () => close("cap"),
        config.maxLifetimeMs + Math.random() * config.lifetimeJitterMs
      )
      void drain()
    },
    cancel() {
      close()
    },
  })
}
