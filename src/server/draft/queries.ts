import "server-only"

import { and, asc, eq, gt, inArray, max, notInArray, sql } from "drizzle-orm"

import { emptyDraftState } from "@/lib/draft/reducer"
import type {
  DraftStatus,
  DraftEventType,
  DraftLogEvent,
  DraftPlayerInfo,
  DraftSnapshot,
  DraftState,
} from "@/lib/draft/types"
import { db } from "@/server/db"
import {
  draftEvents,
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  drafts,
  eventParticipants,
  playerMetadata,
  teamMembers,
  teams,
  users,
  type DraftRow,
} from "@/server/db/schema"

/**
 * Reads for the draft room, the state endpoint and the entry points. The tables
 * are the source of truth; the log only adds the order a draft started with and
 * drives `?since=` catch-up. No authorization here: every caller
 * (`draft/page.tsx`, the state route, the header) checks `draft:view` first.
 * Not a "use server" module.
 */

/** The Event's draft that is not cancelled, if any. */
export async function getActiveDraft(
  eventId: string
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(eq(drafts.eventId, eventId), sql`${drafts.status} <> 'cancelled'`)
    )
    .limit(1)
  return row ?? null
}

/** Enough to show an entry point: whether the Event has a draft, and its status. */
export async function getDraftSummary(
  eventId: string
): Promise<{ id: string; status: DraftStatus } | null> {
  const [row] = await db
    .select({ id: drafts.id, status: drafts.status })
    .from(drafts)
    .where(
      and(eq(drafts.eventId, eventId), sql`${drafts.status} <> 'cancelled'`)
    )
    .limit(1)
  return row ?? null
}

/**
 * What changed since the client last looked, as a tiny value: the state
 * endpoint derives its ETag from it, so an unchanged draft costs two cheap
 * queries and no snapshot.
 */
export interface DraftStamp {
  draftId: string
  status: DraftStatus
  version: number
  /** Highest `draft_event.seq` of the draft (0 when none). */
  seq: number
}

export async function getDraftStamp(
  eventId: string
): Promise<DraftStamp | null> {
  const draft = await getActiveDraft(eventId)
  if (!draft) return null
  const [row] = await db
    .select({ seq: max(draftEvents.seq) })
    .from(draftEvents)
    .where(eq(draftEvents.draftId, draft.id))
  return {
    draftId: draft.id,
    status: draft.status,
    version: draft.version,
    seq: row?.seq ?? 0,
  }
}

export type { DraftSnapshot }

/**
 * The whole draft as the room renders it, built from the tables. Ratings are
 * included for every viewer who may see the draft (epic #214, decision 5).
 */
export async function loadDraftSnapshot(
  eventId: string
): Promise<DraftSnapshot | null> {
  const draft = await getActiveDraft(eventId)
  if (!draft) return null

  // One repeatable-read transaction: the rows and `lastSeq` describe the same
  // moment, so a client that subscribes with `?since=lastSeq` neither misses
  // nor repeats an event.
  const [slotRows, poolRows, pickRows, seqRow, startedRow] =
    await db.transaction(
      async (tx) => {
        const slots = await tx
          .select()
          .from(draftTeamSlots)
          .where(eq(draftTeamSlots.draftId, draft.id))
          .orderBy(asc(draftTeamSlots.position))
        const pool = await tx
          .select()
          .from(draftPoolEntries)
          .where(eq(draftPoolEntries.draftId, draft.id))
        const picks = await tx
          .select()
          .from(draftPicks)
          .where(eq(draftPicks.draftId, draft.id))
          .orderBy(asc(draftPicks.pickNo))
        const seq = await tx
          .select({ seq: max(draftEvents.seq) })
          .from(draftEvents)
          .where(eq(draftEvents.draftId, draft.id))
        const started = await tx
          .select({ payload: draftEvents.payload })
          .from(draftEvents)
          .where(
            and(
              eq(draftEvents.draftId, draft.id),
              eq(draftEvents.type, "started")
            )
          )
          .orderBy(asc(draftEvents.seq))
          .limit(1)
        return [slots, pool, picks, seq, started] as const
      },
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )

  const userIdOfEntry = new Map(poolRows.map((e) => [e.id, e.userId]))
  const permutation = (
    startedRow[0]?.payload as { permutation?: number[] } | undefined
  )?.permutation

  const state: DraftState = {
    ...emptyDraftState(),
    status: draft.status,
    orderType: draft.orderType,
    rounds: draft.rounds,
    pickTimerSeconds: draft.pickTimerSeconds,
    onTimeout: draft.onTimeout,
    autoPickRule: draft.autoPickRule,
    currentPickNo: draft.currentPickNo,
    seed: draft.seed,
    permutation: permutation ?? null,
    slots: slotRows.map((slot) => ({
      slotId: slot.id,
      position: slot.position,
      captainUserId: slot.captainUserId,
      teamName: slot.teamName,
      maxTeamSize: slot.maxTeamSize,
      teamId: slot.teamId,
    })),
    pool: poolRows.map((entry) => ({
      poolEntryId: entry.id,
      userId: entry.userId,
      status: entry.status,
      rating: entry.ratingSnapshot,
      ratingSource: entry.ratingSource,
    })),
    picks: pickRows.map((pick) => ({
      pickNo: pick.pickNo,
      round: pick.round,
      slotId: pick.slotId,
      poolEntryId: pick.poolEntryId,
      userId: userIdOfEntry.get(pick.poolEntryId) ?? null,
      pickedBy: pick.pickedBy,
      auto: pick.auto,
      forced: pick.reason === "forced",
      reason: pick.reason,
      at: pick.pickedAt.toISOString(),
    })),
    lastSeq: seqRow[0]?.seq ?? 0,
    applied: draft.appliedAt !== null,
  }

  const userIds = [
    ...new Set(
      [
        ...slotRows.map((s) => s.captainUserId),
        ...poolRows.map((e) => e.userId),
        ...pickRows.map((p) => p.pickedBy),
      ].filter((id): id is string => id !== null)
    ),
  ]
  const players = await loadPlayers(eventId, userIds)

  return {
    draftId: draft.id,
    eventId,
    version: draft.version,
    state,
    players,
  }
}

/** Names, avatars and skill levels (the Event's player metadata) of users. */
export async function loadPlayers(
  eventId: string,
  userIds: readonly string[]
): Promise<DraftPlayerInfo[]> {
  if (userIds.length === 0) return []
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      nameOverride: playerMetadata.runescapeNameOverride,
      image: users.image,
      skillLevel: playerMetadata.skillLevel,
    })
    .from(users)
    .leftJoin(
      playerMetadata,
      and(
        eq(playerMetadata.userId, users.id),
        eq(playerMetadata.eventId, eventId)
      )
    )
    .where(inArray(users.id, [...userIds]))
  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    runescapeName: row.nameOverride ?? row.runescapeName,
    image: row.image,
    skillLevel: row.skillLevel,
  }))
}

/**
 * Log events after `since`, oldest first, in the shape the reducer takes.
 * `limit` caps the page (the stream asks for one more than it will replay to
 * learn that a client is too far behind).
 */
export async function loadDraftEventsSince(
  draftId: string,
  since: number,
  limit?: number
): Promise<DraftLogEvent[]> {
  const query = db
    .select()
    .from(draftEvents)
    .where(and(eq(draftEvents.draftId, draftId), gt(draftEvents.seq, since)))
    .orderBy(asc(draftEvents.seq))
  const rows = await (limit === undefined ? query : query.limit(limit))
  return rows.map(
    (row) =>
      ({
        seq: row.seq,
        type: row.type as DraftEventType,
        actorUserId: row.actorUserId,
        at: row.createdAt.toISOString(),
        payload: row.payload,
      }) as DraftLogEvent
  )
}

export interface DraftCandidate extends DraftPlayerInfo {
  /** The Event participants without a Team: the pool, and who can captain. */
  userId: string
}

/** Participants without a Team of the Event (the pool a draft would freeze). */
export async function listDraftCandidates(
  eventId: string
): Promise<DraftCandidate[]> {
  const onATeam = db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.eventId, eventId))
  const rows = await db
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        notInArray(eventParticipants.userId, onATeam)
      )
    )
  const players = await loadPlayers(
    eventId,
    rows.map((r) => r.userId)
  )
  return players
    .map((p) => ({ ...p }))
    .sort((a, b) =>
      (a.runescapeName ?? a.name ?? "").localeCompare(
        b.runescapeName ?? b.name ?? "",
        undefined,
        { sensitivity: "base" }
      )
    )
}
