"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/server/db"
import {
  assertTeamLeaderOrManager,
  authzErrorMessage,
  AuthzError,
  requireBingoAdmin,
} from "@/server/authz"
import {
  battleshipShips,
  battleshipShipTiles,
  bingoShipRules,
  bingos,
  events,
  teams,
  tiles,
  type ShipRule,
} from "@/server/db/schema"
import {
  applyShipRulesUpdate,
  BattleshipRuleError,
  isShipRuleList,
  isUniqueViolation,
} from "@/server/battleship"
import { hasEventStarted } from "@/lib/event-status"
import { logger } from "@/lib/logger"
import { indexToCoord } from "@/lib/ship-placement"
import { mergeShipRulesByLength } from "@/lib/ship-rules"
import { validateShipPlacements } from "@/lib/validate-ship-placements"

/**
 * Battleship mutations. Reading hits, misses and ship positions is
 * deliberately NOT exposed as a server action: the game state is only ever
 * computed on the server for the signed-in viewer's own team (see
 * `getBattleshipBoardState` in `@/server/battleship`).
 */

type ActionResult = { success: boolean; error?: string }

const NOT_BATTLESHIP = "Not a battleship board"
const LOCKED = "Ship setup is only allowed before the event starts"

function isPlacementList(
  value: unknown
): value is Array<{ length: number; tileIds: string[] }> {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        Number.isInteger((p as { length: unknown }).length) &&
        Array.isArray((p as { tileIds: unknown }).tileIds) &&
        (p as { tileIds: unknown[] }).tileIds.every(
          (id) => typeof id === "string"
        )
    )
  )
}

/**
 * Replaces the fleet of one team. Only the team's leader or an event manager
 * may do this, only on battleship boards and only before the event starts.
 * An empty list clears the fleet.
 */
export async function saveTeamShipPlacements(
  bingoId: string,
  teamId: string,
  placements: Array<{ length: number; tileIds: string[] }>
): Promise<ActionResult> {
  try {
    // Authentication and authorization come first; the event is derived from
    // the team row, never from the client.
    const teamEventId = await assertTeamLeaderOrManager(teamId)

    if (!isPlacementList(placements)) {
      return { success: false, error: "Invalid ship placements" }
    }

    const result = await db.transaction(
      async (tx): Promise<ActionResult & { eventId?: string }> => {
        // Share lock on the board: serialises against rule updates and
        // structural edits, which take the same row for update.
        const [bingo] = await tx
          .select({
            eventId: bingos.eventId,
            bingoType: bingos.bingoType,
            columns: bingos.columns,
          })
          .from(bingos)
          .where(eq(bingos.id, bingoId))
          .for("share")
        if (!bingo || bingo.eventId !== teamEventId) {
          return { success: false, error: "Board not found for this team" }
        }
        if (bingo.bingoType !== "battleship") {
          return { success: false, error: NOT_BATTLESHIP }
        }

        // Lock the team row so concurrent saves for one team serialise.
        // "no key update" serialises just as well as "update" but does not
        // block unrelated inserts that reference the team.
        const [team] = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.id, teamId), eq(teams.eventId, bingo.eventId)))
          .for("no key update")
        if (!team) {
          return { success: false, error: "Team not found in this event" }
        }

        const event = await tx.query.events.findFirst({
          where: eq(events.id, bingo.eventId),
          columns: { startDate: true },
        })
        if (!event) return { success: false, error: "Event not found" }
        if (hasEventStarted(event.startDate)) {
          return { success: false, error: LOCKED }
        }

        if (placements.length > 0) {
          const boardTiles = await tx.query.tiles.findMany({
            where: eq(tiles.bingoId, bingoId),
            columns: { id: true, index: true, isHidden: true },
          })
          const rulesRow = await tx.query.bingoShipRules.findFirst({
            where: eq(bingoShipRules.bingoId, bingoId),
          })
          const rules = mergeShipRulesByLength(rulesRow?.rulesJson ?? [])
          if (rules.length === 0) {
            return {
              success: false,
              error: "No ship rules configured for this board",
            }
          }

          const validationError = validateShipPlacements(
            rules,
            placements,
            boardTiles.map((t) => ({
              id: t.id,
              ...indexToCoord(t.index, bingo.columns),
            })),
            {
              hiddenTileIds: new Set(
                boardTiles.filter((t) => t.isHidden).map((t) => t.id)
              ),
            }
          )
          if (validationError) {
            return { success: false, error: validationError }
          }
        }

        // Cascades to the ship tiles.
        await tx
          .delete(battleshipShips)
          .where(
            and(
              eq(battleshipShips.bingoId, bingoId),
              eq(battleshipShips.teamId, teamId)
            )
          )

        if (placements.length > 0) {
          const ships = await tx
            .insert(battleshipShips)
            .values(
              placements.map((p) => ({
                bingoId,
                teamId,
                shipLength: p.length,
              }))
            )
            .returning({ id: battleshipShips.id })

          await tx.insert(battleshipShipTiles).values(
            placements.flatMap((p, i) =>
              p.tileIds.map((tileId) => ({
                shipId: ships[i]!.id,
                teamId,
                tileId,
              }))
            )
          )
        }

        return { success: true, eventId: bingo.eventId }
      }
    )

    if (!result.success) return { success: false, error: result.error }

    revalidatePath(`/events/${result.eventId}`, "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof AuthzError) {
      return { success: false, error: error.message }
    }
    if (isUniqueViolation(error)) {
      return {
        success: false,
        error:
          "These ships overlap with ships already placed by this team. Reload and try again",
      }
    }
    logger.error({ error, bingoId, teamId }, "Error saving team ships")
    return { success: false, error: "Failed to save ships" }
  }
}

/**
 * Replaces the fleet rules of a board. Event managers only, battleship boards
 * only, before the event starts. Every team's placements were made against the
 * old fleet, so they are all cleared in the same transaction.
 *
 * The board edit dialog goes through `updateBingo`, which runs the same
 * `applyShipRulesUpdate` in the transaction of the other board settings.
 */
export async function updateBingoShipRules(
  bingoId: string,
  rules: ShipRule[]
): Promise<ActionResult & { clearedTeams?: number }> {
  try {
    const eventId = await requireBingoAdmin(bingoId)

    if (!isShipRuleList(rules)) {
      return { success: false, error: "Invalid ship rules" }
    }

    const { clearedTeams } = await db.transaction((tx) =>
      applyShipRulesUpdate(tx, bingoId, rules)
    )

    revalidatePath(`/events/${eventId}`, "layout")
    return { success: true, clearedTeams }
  } catch (error) {
    if (error instanceof AuthzError) {
      return { success: false, error: authzErrorMessage(error, "Forbidden") }
    }
    if (error instanceof BattleshipRuleError) {
      return { success: false, error: error.message }
    }
    logger.error({ error, bingoId }, "Error updating ship rules")
    return { success: false, error: "Failed to update ship rules" }
  }
}
