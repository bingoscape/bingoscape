/**
 * Server-Sent Events framing for the draft stream (team draft 2/4, #216).
 * Pure, so the stream handler and its tests share one encoder.
 *
 * Event names on the draft stream:
 * - `draft`: one log event (`DraftLogEvent` as JSON); `id` is its `seq`.
 * - `reset`: a full snapshot (`{ draft: DraftSnapshot | null }`); `id` is the
 *   snapshot's `lastSeq`. Sent instead of a replay when the client is too far
 *   behind (or ahead of) the log.
 * - `bye`: the server is about to close the stream (`{ reason }`).
 */

/** The Postgres NOTIFY channel `appendDraftEvent` signals on. */
export const DRAFT_NOTIFY_CHANNEL = "draft_events"

/** What a notification carries: the log row itself is read from the table. */
export interface DraftNotifyPayload {
  draftId: string
  seq: number
}

export const DRAFT_STREAM_EVENTS = {
  draft: "draft",
  reset: "reset",
  bye: "bye",
} as const

export type DraftByeReason = "cap" | "shutdown" | "done" | "error"

export interface SseFrame {
  id?: number
  event?: string
  data?: unknown
  /** Reconnection delay the browser should use, in milliseconds. */
  retry?: number
}

/** Encodes one SSE message. `data` is serialised as one JSON line. */
export function formatSseFrame(frame: SseFrame): string {
  let out = ""
  if (frame.retry !== undefined) out += `retry: ${Math.round(frame.retry)}\n`
  if (frame.id !== undefined) out += `id: ${frame.id}\n`
  if (frame.event) out += `event: ${frame.event}\n`
  if (frame.data !== undefined) out += `data: ${JSON.stringify(frame.data)}\n`
  return `${out}\n`
}

/** A comment line: keeps proxies from timing the connection out. */
export const SSE_HEARTBEAT = ": heartbeat\n\n"
