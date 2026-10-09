import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/server/db"
import {
  bingos,
  images,
  submissions,
  teamMembers,
  teams,
  teamTileSubmissions,
  tiles,
  users,
} from "@/server/db/schema"

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 100
export const POLL_INTERVAL_MS = 5000
export const LAG = sql`interval '2 seconds'`
const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

export interface DropCursor {
  /** ISO timestamp with microsecond precision, produced by Postgres */
  t: string
  id: string
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function encodeCursor(c: DropCursor): string {
  return Buffer.from(JSON.stringify({ t: c.t, id: c.id })).toString("base64url")
}

export function decodeCursor(raw: string): DropCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    )
    if (!parsed || typeof parsed !== "object") return null
    const { t, id } = parsed as { t?: unknown; id?: unknown }
    if (typeof t !== "string" || typeof id !== "string") return null
    if (!TS_RE.test(t) || !UUID_RE.test(id)) return null
    return { t, id }
  } catch {
    return null
  }
}

export function clampLimit(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, n))
}

export const TS_FORMAT = sql.raw(`'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`)

/** Cursor positioned at "now minus lag": only drops created after this are returned later. */
export async function getHeadCursor(): Promise<string> {
  const rows = await db.execute<{ t: string }>(
    sql`select to_char(now() - ${LAG}, ${TS_FORMAT}) as t`
  )
  return encodeCursor({ t: rows[0]!.t, id: MAX_UUID })
}

/** True when the cursor timestamp is older than 24 hours. */
export async function isCursorStale(c: DropCursor): Promise<boolean> {
  const rows = await db.execute<{ stale: boolean }>(
    sql`select (${c.t}::timestamp < (now() - interval '24 hours')::timestamp) as stale`
  )
  return rows[0]!.stale
}

/** Team ids come only from the caller's own memberships; eventId merely narrows them. */
export async function getCallerTeamIds(
  userId: string,
  eventId?: string | null
): Promise<string[]> {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eventId ? eq(teams.eventId, eventId) : undefined
      )
    )
  return rows.map((r) => r.teamId)
}

export interface TeamDrop {
  id: string
  createdAt: string
  status: "pending" | "approved" | "rejected"
  eventId: string
  bingoId: string
  teamId: string
  teamName: string
  tileId: string
  tileTitle: string
  player: { runescapeName: string | null }
  item: { itemId: number | null; quantity: number; value: number }
  source: { name: string | null; type: string | null; npcId: number | null }
  imageUrl: string | null
}

export async function fetchTeamDrops(params: {
  userId: string
  teamIds: string[]
  after: DropCursor
  limit: number
}): Promise<{ drops: TeamDrop[]; hasMore: boolean }> {
  const { userId, teamIds, after, limit } = params
  if (teamIds.length === 0) return { drops: [], hasMore: false }

  const rows = await db
    .select({
      id: submissions.id,
      createdAt: sql<string>`to_char(${submissions.createdAt}, ${TS_FORMAT})`,
      status: submissions.status,
      eventId: bingos.eventId,
      bingoId: bingos.id,
      teamId: teams.id,
      teamName: teams.name,
      tileId: tiles.id,
      tileTitle: tiles.title,
      runescapeName: users.runescapeName,
      itemId: submissions.sourceItemId,
      value: submissions.submissionValue,
      sourceName: submissions.sourceName,
      sourceType: submissions.sourceType,
      npcId: submissions.sourceNpcId,
      imagePath: images.path,
    })
    .from(submissions)
    .innerJoin(
      teamTileSubmissions,
      eq(teamTileSubmissions.id, submissions.teamTileSubmissionId)
    )
    .innerJoin(teams, eq(teams.id, teamTileSubmissions.teamId))
    .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
    .innerJoin(bingos, eq(bingos.id, tiles.bingoId))
    .innerJoin(users, eq(users.id, submissions.submittedBy))
    .innerJoin(images, eq(images.id, submissions.imageId))
    .where(
      and(
        inArray(teamTileSubmissions.teamId, teamIds),
        sql`${submissions.submittedBy} <> ${userId}`,
        eq(bingos.visible, true),
        sql`${submissions.createdAt} < now() - ${LAG}`,
        sql`(${submissions.createdAt}, ${submissions.id}) > (${after.t}::timestamp, ${after.id}::uuid)`
      )
    )
    .orderBy(submissions.createdAt, submissions.id)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const drops: TeamDrop[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    // DB enum has no "rejected"; needs_review is surfaced as rejected
    status:
      r.status === "approved"
        ? "approved"
        : r.status === "pending"
          ? "pending"
          : "rejected",
    eventId: r.eventId,
    bingoId: r.bingoId,
    teamId: r.teamId,
    teamName: r.teamName,
    tileId: r.tileId,
    tileTitle: r.tileTitle,
    player: { runescapeName: r.runescapeName },
    item: { itemId: r.itemId, quantity: 1, value: r.value },
    source: { name: r.sourceName, type: r.sourceType, npcId: r.npcId },
    imageUrl: r.imagePath,
  }))
  return { drops, hasMore }
}
