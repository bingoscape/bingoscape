import { lte, ne, sql, type SQL } from "drizzle-orm"

import { hasEventStarted } from "@/lib/event-status"
import { bingos, events, type BingoType } from "@/server/db/schema"

/**
 * Blind boards: until the Event starts, a battleship Board hides the content of
 * every Tile from everybody except the Event's managers, so Teams place their
 * ships without knowing which Tiles are easy. From the start on (and forever
 * after, including once the Event ended) nothing is hidden.
 *
 * "Blind" is not the same as `tiles.isHidden`: a hidden Tile cannot hold a
 * ship, a blind Tile must stay placeable. A blind Tile therefore keeps its id,
 * index (grid position) and tier, and carries `isBlind: true` so the UI can
 * render it as an unknown cell.
 *
 * The idea (a battleship board that hides its tiles before the start) comes
 * from PR #55 by Daniel Martin (@ohfr), whose `canSeeBattleshipTileDetails`
 * only hid the content in a client component. Everything here runs on the
 * server, before data reaches the client.
 *
 * This file is intentionally not a "use server" module: nothing here is
 * callable from the client. It is pure (no session, no queries) so routes and
 * libraries can use it freely; the helpers that resolve the signed-in viewer
 * from the database live in `blind-board-viewer.ts`.
 */

/** What decides whether a Board is blind for a viewer. */
export interface BlindBoardContext {
  bingoType: BingoType
  /** The Event's start date. */
  startDate: Date | string | number
  /** Whether the viewer is the Event creator, admin or management. */
  isManager: boolean
}

/**
 * Whether the Board hides its Tiles from this viewer right now. Only battleship
 * Boards are ever blind, only before the Event started, never for managers.
 * `now` is injectable so callers and tests control the clock.
 */
export function isBlindBoard(
  context: BlindBoardContext,
  now: Date = new Date()
): boolean {
  if (context.bingoType !== "battleship") return false
  if (context.isManager) return false
  return !hasEventStarted(context.startDate, now)
}

/** The neutral title of a blind Tile: its 1-based position on the grid. */
export function blindTileTitle(index: number): string {
  return `Tile ${index + 1}`
}

/**
 * The fields the redaction knows about. Everything is optional except the
 * grid position, so the helper fits the full Tile with its relations as well
 * as the narrow projections some queries select. Only fields that are present
 * are redacted; other fields (id, bingoId, index, tier, isHidden, ...) pass
 * through untouched.
 */
export interface BlindRedactableTile {
  index: number
  title?: string
  description?: string
  headerImage?: string | null
  weight?: number
  goals?: unknown[]
  goalGroups?: unknown[]
  teamTileSubmissions?: unknown[]
}

/** A Tile as handed to a client, with the explicit blind marker. */
export type WithBlindMarker<T> = T & { isBlind: boolean }

/**
 * Redacts one Tile: placeholder title ("Tile N"), no description, no image,
 * weight 0 (the XP would hint at the difficulty), no Goals, goal groups,
 * item/metric goals, goal values or team progress (those live under `goals`)
 * and no team submissions (images, users, status). Identity and geometry stay.
 */
export function redactBlindTile<T extends BlindRedactableTile>(
  tile: T
): T & { isBlind: true } {
  return {
    ...tile,
    isBlind: true as const,
    ...(tile.title !== undefined ? { title: blindTileTitle(tile.index) } : {}),
    ...(tile.description !== undefined ? { description: "" } : {}),
    ...(tile.headerImage !== undefined ? { headerImage: null } : {}),
    ...(tile.weight !== undefined ? { weight: 0 } : {}),
    ...(tile.goals !== undefined ? { goals: [] } : {}),
    ...(tile.goalGroups !== undefined ? { goalGroups: [] } : {}),
    ...(tile.teamTileSubmissions !== undefined
      ? { teamTileSubmissions: [] }
      : {}),
  }
}

/**
 * Stamps every Tile of a Board with `isBlind` and, when the Board is blind for
 * the viewer, redacts it. Use this at every point where a Board's Tiles leave
 * the server.
 */
export function applyBlindBoard<T extends BlindRedactableTile>(
  boardTiles: T[],
  blind: boolean
): Array<WithBlindMarker<T>> {
  return boardTiles.map((tile) =>
    blind ? redactBlindTile(tile) : { ...tile, isBlind: false }
  )
}

/**
 * SQL condition for queries that join `bingos` and `events`: true unless the
 * row belongs to a battleship Board whose Event has not started. For feeds and
 * matchers that serve players and must not carry Tile content (titles, goal
 * hits) of a blind Board, whoever asks.
 */
export function boardContentUnlockedSql(now: Date = new Date()): SQL {
  return sql`(${ne(bingos.bingoType, "battleship")} or ${lte(events.startDate, now)})`
}
