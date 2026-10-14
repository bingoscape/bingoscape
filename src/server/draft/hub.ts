import "server-only"

import postgres from "postgres"

import { env } from "@/env"
import { logger } from "@/lib/logger"
import {
  DRAFT_NOTIFY_CHANNEL,
  type DraftByeReason,
  type DraftNotifyPayload,
} from "@/lib/draft/sse"

/**
 * Fan-out of draft log events to the open SSE streams of this process (team
 * draft 2/4, #216).
 *
 * One dedicated `LISTEN` connection per process (postgres-js `sql.listen()`,
 * which reconnects by itself) and an in-memory map from draft to subscribers.
 * The NOTIFY payload carries only `{ draftId, seq }` (the limit is 8 KB);
 * subscribers read the rows from `draft_event` themselves, so a notification
 * is only a hint to look at the log. That makes the transport forgiving: a
 * lost or duplicated notification costs nothing, and after a reconnect of the
 * LISTEN connection every subscriber is woken once because it may have missed
 * notifications while the connection was down.
 *
 * `appendDraftEvent` (src/server/draft/core.ts) issues the `pg_notify` in the
 * same transaction as the log row. Postgres delivers a NOTIFY only when its
 * transaction commits, so there are no phantom events for rolled-back work.
 *
 * LISTEN needs a session: it does not work through PgBouncer in transaction
 * mode (docs/PRODUCTION-SETUP.md). Needs a long-lived Node process.
 */

/** Concurrent streams one user may hold open (a few tabs and a phone). */
export const MAX_STREAMS_PER_USER = 3

/** One open stream, as the hub sees it. */
export interface DraftStreamHandle {
  draftId: string
  userId: string
  /** Something may have been appended to the draft's log: read it. */
  wake: () => void
  /** End the stream, telling the client why. */
  close: (reason: DraftByeReason) => void
}

interface HubState {
  sql: postgres.Sql | null
  listening: Promise<void> | null
  listeners: Map<string, Set<DraftStreamHandle>>
  perUser: Map<string, number>
  sigtermInstalled: boolean
}

// Kept on globalThis so a dev server's module reloads do not leak connections.
const globalForHub = globalThis as unknown as { draftHub?: HubState }
const hub: HubState = (globalForHub.draftHub ??= {
  sql: null,
  listening: null,
  listeners: new Map(),
  perUser: new Map(),
  sigtermInstalled: false,
})

function parsePayload(raw: string): DraftNotifyPayload | null {
  try {
    const value = JSON.parse(raw) as Partial<DraftNotifyPayload>
    if (typeof value.draftId === "string" && typeof value.seq === "number") {
      return { draftId: value.draftId, seq: value.seq }
    }
  } catch {
    // Not ours; ignore.
  }
  return null
}

function wakeAll(): void {
  for (const set of hub.listeners.values()) {
    for (const handle of [...set]) handle.wake()
  }
}

function onNotify(raw: string): void {
  const payload = parsePayload(raw)
  if (!payload) return
  for (const handle of [...(hub.listeners.get(payload.draftId) ?? [])]) {
    handle.wake()
  }
}

/** Starts the LISTEN connection once; resolves when LISTEN is active. */
function ensureListening(): Promise<void> {
  if (hub.listening) return hub.listening
  const sql = (hub.sql ??= postgres(env.DATABASE_URL, {
    max: 1,
    onnotice: () => undefined,
  }))
  let connected = false
  const listening = sql
    .listen(DRAFT_NOTIFY_CHANNEL, onNotify, () => {
      // Called on the first LISTEN and again after every reconnect.
      if (connected) {
        logger.warn("Draft LISTEN connection restored; waking all streams")
        wakeAll()
      }
      connected = true
    })
    .then(() => undefined)
  hub.listening = listening
  listening.catch((error) => {
    logger.error({ error }, "Draft LISTEN connection failed")
    // Try again on the next subscriber.
    if (hub.listening === listening) hub.listening = null
  })
  return listening
}

function installSigterm(): void {
  if (hub.sigtermInstalled) return
  hub.sigtermInstalled = true
  // Streams are long-lived: end them with a `bye` so clients reconnect (and
  // resume from `Last-Event-ID`) against the new process after a deploy.
  process.once("SIGTERM", onSigterm)
}

function onSigterm(): void {
  hub.sigtermInstalled = false
  closeAllDraftStreams("shutdown")
}

export interface DraftSubscription {
  unsubscribe: () => void
}

/**
 * Registers a stream. Resolves once LISTEN is active, so anything committed
 * from then on wakes the stream and anything before is found by its first
 * read of the log. Resolves null when the user already holds
 * `MAX_STREAMS_PER_USER` streams. Rejects when the database cannot be
 * listened to.
 */
export async function subscribeToDraft(
  handle: DraftStreamHandle
): Promise<DraftSubscription | null> {
  if ((hub.perUser.get(handle.userId) ?? 0) >= MAX_STREAMS_PER_USER) {
    return null
  }
  // Reserve the slot before awaiting so concurrent opens cannot all pass.
  hub.perUser.set(handle.userId, (hub.perUser.get(handle.userId) ?? 0) + 1)
  const set = hub.listeners.get(handle.draftId) ?? new Set()
  set.add(handle)
  hub.listeners.set(handle.draftId, set)

  let released = false
  const unsubscribe = () => {
    if (released) return
    released = true
    set.delete(handle)
    if (set.size === 0 && hub.listeners.get(handle.draftId) === set) {
      hub.listeners.delete(handle.draftId)
    }
    const left = (hub.perUser.get(handle.userId) ?? 1) - 1
    if (left <= 0) hub.perUser.delete(handle.userId)
    else hub.perUser.set(handle.userId, left)
  }

  try {
    await ensureListening()
  } catch (error) {
    unsubscribe()
    throw error
  }
  installSigterm()
  return { unsubscribe }
}

/** Ends every open stream (SIGTERM, tests). */
export function closeAllDraftStreams(reason: DraftByeReason): void {
  for (const set of hub.listeners.values()) {
    for (const handle of [...set]) handle.close(reason)
  }
}

/** Open streams of this process (tests, diagnostics). */
export function openDraftStreamCount(): number {
  let total = 0
  for (const set of hub.listeners.values()) total += set.size
  return total
}

/** Closes all streams and the LISTEN connection (tests). */
export async function stopDraftHub(): Promise<void> {
  closeAllDraftStreams("shutdown")
  if (hub.sigtermInstalled) {
    process.off("SIGTERM", onSigterm)
    hub.sigtermInstalled = false
  }
  const sql = hub.sql
  hub.sql = null
  hub.listening = null
  hub.listeners.clear()
  hub.perUser.clear()
  if (sql) await sql.end({ timeout: 1 })
}
