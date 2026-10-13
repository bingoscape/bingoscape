import "server-only"

import { eq } from "drizzle-orm"
import { cache } from "react"

import {
  READ_DECISIONS,
  READ_POLICY_ENV_VAR,
  boardReadable,
  eventReadLevel,
  levelAllows,
  parseReadPolicyMode,
  redactBoardSecrets,
  teamReadable,
  tileContentReadable,
  type EventReadLevel,
  type EventReadScope,
  type ReadPolicyMode,
  type TeamReadScope,
} from "@/lib/authz/read-policy"
import type { EventActor } from "@/lib/authz/policy"
import type { EventRole } from "@/lib/authz/roles"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import { isBlindBoard } from "@/server/blind-board"
import { bingos, events, goals, teams, tiles } from "@/server/db/schema"
import type { BingoType } from "@/server/db/schema"
import { getEventActor } from "./actor"

/**
 * Server-side read policy: `canReadEvent`, `canReadBoard`, `canReadTile`,
 * `canReadTeam` (and `canReadGoal`). They resolve the viewer's standing with
 * the actor loader, apply the pure rules of `@/lib/authz/read-policy` and the
 * existing blind-Board / hidden-Tile rules, and never throw: a database error
 * is logged and reads as "not readable" (fail closed).
 *
 * The mode (`RBAC_READ_POLICY`) is read on every request, so it can be changed
 * without a redeploy. Not a "use server" module: nothing here is callable from
 * the client.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids reach the database as uuid; anything else cannot match a row. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

const warnedModes = new Set<string>()

/** The active mode: `RBAC_READ_POLICY`, read now; unknown values mean enforce. */
export function getReadPolicyMode(): ReadPolicyMode {
  const raw = process.env[READ_POLICY_ENV_VAR]
  const mode = parseReadPolicyMode(raw)
  const trimmed = raw?.trim().toLowerCase()
  if (trimmed && trimmed !== mode && !warnedModes.has(trimmed)) {
    warnedModes.add(trimmed)
    logger.warn(
      { value: raw },
      `Unknown ${READ_POLICY_ENV_VAR} value, using "${mode}"`
    )
  }
  return mode
}

/** What the viewer is allowed to read of one Event. */
export interface EventReadAccess {
  eventId: string
  /** Effective level (the mode is applied: relaxed lifts non-members). */
  level: EventReadLevel
  /** The level `enforce` would give. Secrets are decided on this one. */
  strictLevel: EventReadLevel
  /** Effective Event role (the creator counts as admin); null for non-members. */
  role: EventRole | null
  /** Admin or management (hidden / Blind Tiles, drafts and secrets). */
  isManager: boolean
  signedIn: boolean
  actor: EventActor | null
  eventPublic: boolean
  startDate: Date
  mode: ReadPolicyMode
}

const loadEventFacts = cache(async (eventId: string) =>
  db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, public: true, startDate: true },
  })
)

/**
 * The viewer's read standing in the Event, or null when the Event does not
 * exist. Throws on a database error; the `canRead*` helpers turn that into
 * "not readable".
 */
export const getEventReadAccess = cache(
  async (eventId: string): Promise<EventReadAccess | null> => {
    if (!isUuid(eventId)) return null
    const event = await loadEventFacts(eventId)
    if (!event) return null

    const lookup = await getEventActor(eventId)
    const actor = lookup.status === "ok" ? lookup.actor : null
    const facts = {
      actor,
      signedIn: lookup.status !== "unauthenticated",
      eventPublic: event.public,
    }
    const mode = getReadPolicyMode()
    const level = eventReadLevel(facts, { mode })
    return {
      eventId,
      level,
      strictLevel:
        mode === "enforce" ? level : eventReadLevel(facts, { mode: "enforce" }),
      role: actor?.role ?? null,
      isManager: level === "manager",
      signedIn: facts.signedIn,
      actor,
      eventPublic: event.public,
      startDate: event.startDate,
      mode,
    }
  }
)

/** Runs a policy lookup; any failure reads as "not readable". */
async function failClosed<T>(
  what: string,
  lookup: () => Promise<T | null>
): Promise<T | null> {
  try {
    return await lookup()
  } catch (error) {
    logger.error({ error }, `Read policy lookup failed: ${what}`)
    return null
  }
}

/**
 * Event access for a scope; null when the Event does not exist or the viewer
 * may not read it at that scope.
 */
export async function getEventReadAccessFor(
  eventId: string,
  scope: EventReadScope = "content"
): Promise<EventReadAccess | null> {
  return failClosed("event", async () => {
    const access = await getEventReadAccess(eventId)
    return access && levelAllows(access.level, scope) ? access : null
  })
}

/**
 * May the viewer read the Event? `summary`: the join card; `content`: visible
 * Boards, Tiles and the leaderboard (also for public Events); `member-data`:
 * per player and per Submission data (participants and managers).
 */
export async function canReadEvent(
  eventId: string,
  scope: EventReadScope = "content"
): Promise<boolean> {
  return (await getEventReadAccessFor(eventId, scope)) !== null
}

/** What the viewer is allowed to read of one Board. */
export interface BoardReadAccess {
  access: EventReadAccess
  board: { id: string; eventId: string; visible: boolean; bingoType: BingoType }
  /** The Board hides its Tiles from this viewer (battleship before the start). */
  blind: boolean
  isManager: boolean
}

export async function getBoardReadAccess(
  bingoId: string,
  scope: EventReadScope = "content"
): Promise<BoardReadAccess | null> {
  return failClosed("board", async () => {
    if (!isUuid(bingoId)) return null
    const board = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      columns: { id: true, eventId: true, visible: true, bingoType: true },
    })
    if (!board) return null

    const access = await getEventReadAccess(board.eventId)
    if (!access || !boardReadable(access.level, scope, board)) return null

    return {
      access,
      board,
      isManager: access.isManager,
      blind: isBlindBoard({
        bingoType: board.bingoType,
        startDate: access.startDate,
        isManager: access.isManager,
      }),
    }
  })
}

/**
 * May the viewer read the Board? Managers always; everybody else only a
 * `visible` Board of an Event they may read at that scope.
 */
export async function canReadBoard(
  bingoId: string,
  scope: EventReadScope = "content"
): Promise<boolean> {
  return (await getBoardReadAccess(bingoId, scope)) !== null
}

/** The Board a readable Tile belongs to. */
export async function getTileReadAccess(
  tileId: string
): Promise<BoardReadAccess | null> {
  return failClosed("tile", async () => {
    if (!isUuid(tileId)) return null
    const tile = await db.query.tiles.findFirst({
      where: eq(tiles.id, tileId),
      columns: { bingoId: true, isHidden: true },
    })
    if (!tile) return null

    const board = await getBoardReadAccess(tile.bingoId, "content")
    if (!board) return null
    return tileContentReadable(
      board.access.level,
      board.board,
      tile,
      board.blind
    )
      ? board
      : null
  })
}

/**
 * May the viewer read the *content* of the Tile (title, Goals, progress)? The
 * Tile must be on a Board they may read, and a hidden Tile or a Tile of a
 * Blind Board is for managers only. Unknown Tiles are not readable.
 */
export async function canReadTile(tileId: string): Promise<boolean> {
  return (await getTileReadAccess(tileId)) !== null
}

/** Like `canReadTile`, starting from a Goal. */
export async function canReadGoal(goalId: string): Promise<boolean> {
  const tileId = await failClosed("goal", async () => {
    if (!isUuid(goalId)) return null
    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
      columns: { tileId: true },
    })
    return goal?.tileId ?? null
  })
  return tileId !== null && canReadTile(tileId)
}

/**
 * May the viewer read the Team? `summary`: name and leaderboard place, for
 * everybody who may read the Event content. `records`: its progress and
 * Submissions: managers, the Team's own members, and other participants except
 * on a battleship Board (pass `bingoId` to name the Board; without it any
 * battleship Board in the Event counts).
 */
export async function canReadTeam(
  teamId: string,
  scope: TeamReadScope = "summary",
  options: { bingoId?: string } = {}
): Promise<boolean> {
  const allowed = await failClosed("team", async () => {
    if (!isUuid(teamId)) return null
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      columns: { id: true, eventId: true },
    })
    if (!team) return null

    const access = await getEventReadAccess(team.eventId)
    if (!access) return null

    let isBattleship = false
    if (scope === "records") {
      const eventBoards = await db.query.bingos.findMany({
        where: eq(bingos.eventId, team.eventId),
        columns: { id: true, bingoType: true },
      })
      if (options.bingoId !== undefined) {
        const board = eventBoards.find((b) => b.id === options.bingoId)
        if (!board) return null
        isBattleship = board.bingoType === "battleship"
      } else {
        isBattleship = eventBoards.some((b) => b.bingoType === "battleship")
      }
    }
    return teamReadable(
      access.actor,
      access.level,
      scope,
      { teamId: team.id },
      { isBattleship }
    )
  })
  return allowed === true
}

/**
 * On a battleship Board a Team must never learn what the opponent completed
 * (see `battleship-privacy.ts`): for everybody but managers, rows of per Team
 * progress keep only the viewer's own Teams. Other Boards are unchanged.
 */
export function keepViewerTeamProgress<T extends { teamId: string }>(
  rows: T[],
  board: Pick<BoardReadAccess, "access" | "board" | "isManager">
): T[] {
  if (board.board.bingoType !== "battleship" || board.isManager) return rows
  const own = new Set(board.access.actor?.teams.map((t) => t.teamId) ?? [])
  return rows.filter((row) => own.has(row.teamId))
}

/**
 * Removes the secrets the viewer must not see from a Board row (tracker
 * verification code: managers; codephrase: decision 5). Uses the strict level,
 * so the relaxed mode never leaks them.
 */
export function redactBoardForViewer<
  T extends {
    codephrase: string
    womCompetitionId: number | null
    womVerificationCode: string | null
  },
>(board: T, access: Pick<EventReadAccess, "strictLevel">): T {
  return redactBoardSecrets(board, access.strictLevel, READ_DECISIONS)
}
