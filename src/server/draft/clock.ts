import "server-only"

import { sql } from "drizzle-orm"

import { db } from "@/server/db"

/**
 * The database clock, as the draft timer uses it (`turn_deadline` is set and
 * compared with it). The clients count down against the offset between this
 * clock and their own, so they must be told database time, not the time of
 * the app server. The offset between the two is measured once in a while and
 * cached: asking the database on every heartbeat of every stream is not
 * needed.
 */

const REFRESH_MS = 30_000

let measured: { offsetMs: number; at: number } | null = null

/** Database time now, in epoch milliseconds. */
export async function databaseNowMs(): Promise<number> {
  const local = Date.now()
  if (!measured || local - measured.at > REFRESH_MS) {
    const before = Date.now()
    const rows = await db.execute<{ ms: number }>(
      sql`select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms`
    )
    const after = Date.now()
    // The reading was taken somewhere in the middle of the round trip.
    measured = {
      offsetMs: Number(rows[0]?.ms ?? after) - (before + after) / 2,
      at: after,
    }
  }
  return Date.now() + measured.offsetMs
}

/** Database time now as an ISO string. */
export async function databaseNowIso(): Promise<string> {
  return new Date(await databaseNowMs()).toISOString()
}

/** Forgets the measurement (tests). */
export function resetDatabaseClock(): void {
  measured = null
}
