import { and, count, eq, inArray, ne } from "drizzle-orm"

import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { assertTeamLeaderOrManager, AuthzError } from "@/server/authz"
import {
  battleshipShips,
  battleshipShipTiles,
  bingoShipRules,
  bingos,
  events,
  teamMembers,
  teams,
  teamTileSubmissions,
  tiles,
  type ShipRule,
} from "@/server/db/schema"
import { getSunkShipTileIds } from "@/lib/battleship-sunk"
import { hasEventStarted } from "@/lib/event-status"
import { mergeShipRulesByLength } from "@/lib/ship-rules"

/**
 * Battleship board helpers shared by server actions and Server Components.
 *
 * This file is intentionally not a "use server" module: nothing here is
 * callable from the client. In particular there is no way to ask for the game
 * state of an arbitrary team; `getBattleshipBoardState` always answers for the
 * signed-in viewer's own team.
 */

export type BattleshipDbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** A fleet of ships a team placed on the board. */
export type ShipPlacement = {
  length: number
  tileIds: string[]
}

/** Exactly two teams play a battleship board. */
export const BATTLESHIP_TEAM_COUNT = 2

export const defaultShipRules: ShipRule[] = [
  { length: 3, count: 2 },
  { length: 2, count: 1 },
]

/** A violated battleship game rule whose message is safe to show to users. */
export class BattleshipRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BattleshipRuleError"
  }
}

/** Returns the rule message, or the fallback for any other error. */
export function battleshipErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof BattleshipRuleError ? error.message : fallback
}

/** True for a Postgres unique violation, also when wrapped by the driver. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 3 && current; depth++) {
    if ((current as { code?: unknown }).code === "23505") return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function getBingoShipRules(bingoId: string): Promise<ShipRule[]> {
  const rules = await db.query.bingoShipRules.findFirst({
    where: eq(bingoShipRules.bingoId, bingoId),
  })
  return mergeShipRulesByLength(rules?.rulesJson ?? [])
}

/** Creates the rules row of a new board. Callers validate that it fits. */
export async function insertBingoShipRules(
  tx: BattleshipDbTx,
  bingoId: string,
  rules: ShipRule[]
): Promise<void> {
  await tx
    .insert(bingoShipRules)
    .values({ bingoId, rulesJson: mergeShipRulesByLength(rules) })
}

/** Creates or replaces the rules row of a board. */
export async function upsertBingoShipRules(
  tx: BattleshipDbTx,
  bingoId: string,
  rules: ShipRule[]
): Promise<void> {
  const rulesJson = mergeShipRulesByLength(rules)
  await tx
    .insert(bingoShipRules)
    .values({ bingoId, rulesJson })
    .onConflictDoUpdate({
      target: bingoShipRules.bingoId,
      set: { rulesJson, updatedAt: new Date() },
    })
}

/** Parses the optional `shipRules` JSON field of the create board form. */
export function parseShipRulesJson(
  raw: FormDataEntryValue | null
): ShipRule[] | null | undefined {
  if (raw === null || raw === "") return undefined
  if (typeof raw !== "string") return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isShipRuleList(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isShipRuleList(value: unknown): value is ShipRule[] {
  return (
    Array.isArray(value) &&
    value.every(
      (rule) =>
        typeof rule === "object" &&
        rule !== null &&
        Number.isInteger((rule as ShipRule).length) &&
        (rule as ShipRule).length > 0 &&
        Number.isInteger((rule as ShipRule).count) &&
        (rule as ShipRule).count > 0
    )
  )
}

// ---------------------------------------------------------------------------
// Reading placements and game state
// ---------------------------------------------------------------------------

/**
 * The ships the given team placed. Only the team's leader or an event manager
 * may read them; plain members and other teams get an AuthzError.
 */
export async function getTeamShipPlacements(
  bingoId: string,
  teamId: string
): Promise<ShipPlacement[]> {
  const eventId = await assertTeamLeaderOrManager(teamId)

  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    columns: { eventId: true, bingoType: true },
  })
  if (!bingo || bingo.eventId !== eventId) {
    throw new AuthzError("Board not found for this team")
  }
  if (bingo.bingoType !== "battleship") {
    throw new AuthzError("Not a battleship board")
  }

  const ships = await db.query.battleshipShips.findMany({
    where: and(
      eq(battleshipShips.bingoId, bingoId),
      eq(battleshipShips.teamId, teamId)
    ),
    with: { tiles: true },
  })

  return ships.map((ship) => ({
    length: ship.shipLength,
    tileIds: ship.tiles.map((t) => t.tileId),
  }))
}

export type BattleshipBoardState = {
  /** Tiles the viewer's team completed that carry an opponent ship. */
  hitTileIds: string[]
  /** Tiles the viewer's team completed that carry no opponent ship. */
  missTileIds: string[]
  /** Hit tiles belonging to opponent ships that are completely hit. */
  sunkTileIds: string[]
}

/**
 * Hits, misses and sunk ships for the SIGNED-IN viewer's own team.
 *
 * State is derived from the team's completed tiles, so it works for every
 * completion path and disappears again when a tile is un-completed. Anonymous
 * users, non-members (including event managers who are on no team) and
 * non-battleship boards get an empty state. Opponent ship tiles are never
 * returned unless the viewer completed them, so nothing here is derived from
 * the opponent's perspective.
 */
export async function getBattleshipBoardState(
  bingoId: string
): Promise<BattleshipBoardState> {
  const session = await getServerAuthSession()
  if (!session?.user) return emptyState()

  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    columns: { eventId: true, bingoType: true },
  })
  if (!bingo || bingo.bingoType !== "battleship") return emptyState()

  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, session.user.id),
        eq(teams.eventId, bingo.eventId)
      )
    )
    .limit(1)
  if (!membership) return emptyState()
  const viewerTeamId = membership.teamId

  const [completedRows, opponentShipRows] = await Promise.all([
    db
      .select({ tileId: teamTileSubmissions.tileId })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(
        and(
          eq(teamTileSubmissions.teamId, viewerTeamId),
          eq(teamTileSubmissions.status, "completed"),
          eq(tiles.bingoId, bingoId)
        )
      ),
    db
      .select({
        shipId: battleshipShipTiles.shipId,
        teamId: battleshipShips.teamId,
        tileId: battleshipShipTiles.tileId,
      })
      .from(battleshipShipTiles)
      .innerJoin(
        battleshipShips,
        eq(battleshipShips.id, battleshipShipTiles.shipId)
      )
      .where(
        and(
          eq(battleshipShips.bingoId, bingoId),
          ne(battleshipShips.teamId, viewerTeamId)
        )
      ),
  ])

  const completed = new Set(completedRows.map((r) => r.tileId))
  const shipsById = new Map<
    string,
    { shipId: string; teamId: string; tileIds: string[] }
  >()
  for (const row of opponentShipRows) {
    const ship = shipsById.get(row.shipId) ?? {
      shipId: row.shipId,
      teamId: row.teamId,
      tileIds: [],
    }
    ship.tileIds.push(row.tileId)
    shipsById.set(row.shipId, ship)
  }
  const opponentShipTileIds = new Set(opponentShipRows.map((r) => r.tileId))

  const hitTileIds = [...completed].filter((id) => opponentShipTileIds.has(id))
  const missTileIds = [...completed].filter(
    (id) => !opponentShipTileIds.has(id)
  )
  const sunk = getSunkShipTileIds(
    [...shipsById.values()],
    hitTileIds.map((tileId) => ({ tileId, attackerTeamId: viewerTeamId })),
    viewerTeamId
  )

  return { hitTileIds, missTileIds, sunkTileIds: [...sunk] }
}

function emptyState(): BattleshipBoardState {
  return { hitTileIds: [], missTileIds: [], sunkTileIds: [] }
}

// ---------------------------------------------------------------------------
// Two-team rule
// ---------------------------------------------------------------------------

/**
 * Serialises team creation and battleship board creation per event so the
 * two-team limit cannot be raced past.
 */
async function lockEvent(tx: BattleshipDbTx, eventId: string): Promise<void> {
  await tx
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .for("no key update")
}

async function countTeams(tx: BattleshipDbTx, eventId: string) {
  const [row] = await tx
    .select({ value: count() })
    .from(teams)
    .where(eq(teams.eventId, eventId))
  return row?.value ?? 0
}

/**
 * Throws when adding `added` teams would give an event with a battleship
 * board more than two teams. Call inside the transaction that inserts them.
 */
export async function assertTeamLimitForBattleship(
  tx: BattleshipDbTx,
  eventId: string,
  added = 1
): Promise<void> {
  await lockEvent(tx, eventId)
  const [battleshipBoard] = await tx
    .select({ id: bingos.id })
    .from(bingos)
    .where(and(eq(bingos.eventId, eventId), eq(bingos.bingoType, "battleship")))
    .limit(1)
  if (!battleshipBoard) return

  if ((await countTeams(tx, eventId)) + added > BATTLESHIP_TEAM_COUNT) {
    throw new BattleshipRuleError(
      `This event has a battleship board, which is played by exactly ${BATTLESHIP_TEAM_COUNT} teams`
    )
  }
}

/**
 * Throws when the event already has more than two teams and therefore cannot
 * get a battleship board. Call inside the transaction that creates the board.
 */
export async function assertEventFitsBattleship(
  tx: BattleshipDbTx,
  eventId: string
): Promise<void> {
  await lockEvent(tx, eventId)
  if ((await countTeams(tx, eventId)) > BATTLESHIP_TEAM_COUNT) {
    throw new BattleshipRuleError(
      `A battleship board is played by exactly ${BATTLESHIP_TEAM_COUNT} teams, but this event already has more`
    )
  }
}

// ---------------------------------------------------------------------------
// Structural edit guards
// ---------------------------------------------------------------------------

/**
 * Throws when the edit would invalidate ship placements: deleting tiles,
 * adding or deleting rows and columns, resizing or reordering tiles on a
 * battleship board. Allowed before the event starts only while no ship is
 * placed; never after the start. Call as the first statement of the
 * transaction that performs the edit: it locks the board row, which also
 * serialises against concurrent placement saves.
 */
export async function assertBattleshipLayoutEditable(
  tx: BattleshipDbTx,
  bingoId: string
): Promise<void> {
  const [bingo] = await tx
    .select({ bingoType: bingos.bingoType, eventId: bingos.eventId })
    .from(bingos)
    .where(eq(bingos.id, bingoId))
    .for("no key update")
  if (!bingo || bingo.bingoType !== "battleship") return

  const event = await tx.query.events.findFirst({
    where: eq(events.id, bingo.eventId),
    columns: { startDate: true },
  })
  if (event && hasEventStarted(event.startDate)) {
    throw new BattleshipRuleError(
      "The layout of a battleship board cannot be changed once the event has started"
    )
  }

  const [ship] = await tx
    .select({ id: battleshipShips.id })
    .from(battleshipShips)
    .where(eq(battleshipShips.bingoId, bingoId))
    .limit(1)
  if (ship) {
    throw new BattleshipRuleError(
      "Ships are already placed on this board. Clear the fleets (by updating the ship rules) before changing the layout"
    )
  }
}

/** Throws when any of the tiles carries a ship (e.g. before hiding it). */
export async function assertTilesCarryNoShip(
  tx: BattleshipDbTx,
  tileIds: string[]
): Promise<void> {
  if (tileIds.length === 0) return

  const [tile] = await tx
    .select({ bingoId: tiles.bingoId })
    .from(tiles)
    .where(inArray(tiles.id, tileIds))
    .limit(1)
  if (!tile) return

  // Same lock as the placement save, so a ship cannot land on a tile that is
  // being hidden at the same moment.
  await tx
    .select({ id: bingos.id })
    .from(bingos)
    .where(eq(bingos.id, tile.bingoId))
    .for("no key update")

  const [shipTile] = await tx
    .select({ tileId: battleshipShipTiles.tileId })
    .from(battleshipShipTiles)
    .where(inArray(battleshipShipTiles.tileId, tileIds))
    .limit(1)
  if (shipTile) {
    throw new BattleshipRuleError(
      "A ship is placed on this tile, so it cannot be hidden"
    )
  }
}
