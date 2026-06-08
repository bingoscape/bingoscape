"use server"

import { db } from "@/server/db"
import {
  battleshipHits,
  battleshipShips,
  battleshipShipTiles,
  bingoShipRules,
  bingos,
  events,
  teamMembers,
  teams,
  type ShipRule,
} from "@/server/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { getUserRole } from "./events"
import { indexToCoord } from "@/lib/ship-placement"
import type { ShipPlacementInput } from "@/lib/ship-placement"
import { getSunkShipTileIds } from "@/lib/battleship-sunk"
import {
  mergeShipRulesByLength,
  validateShipRulesFitBoard,
} from "@/lib/ship-rules"
import { validateShipPlacements } from "@/lib/validate-ship-placements"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

export type ShipPlacement = {
  length: number
  tileIds: string[]
}

async function assertShipPlacementAccess(
  eventId: string,
  teamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    return { ok: false, error: "Not authenticated" }
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: {
      creatorId: true,
    },
  })
  if (!event) {
    return { ok: false, error: "Event not found" }
  }

  if (event.creatorId === session.user.id) {
    return { ok: true }
  }

  const role = await getUserRole(eventId)
  if (role === "admin" || role === "management") {
    return { ok: true }
  }

  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, session.user.id)
    ),
    columns: {
      isLeader: true,
    },
  })

  if (!membership) {
    return { ok: false, error: "Not a member of this team" }
  }

  if (!membership.isLeader) {
    return {
      ok: false,
      error:
        "Only team leaders, event admins, or board creator can manage ship placement",
    }
  }

  return { ok: true }
}

async function assertTeamBelongsToEvent(
  eventId: string,
  teamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
    columns: { id: true },
  })

  if (!team) {
    return { ok: false, error: "Team not found in this event" }
  }

  return { ok: true }
}

export async function getBingoShipRules(bingoId: string) {
  const rules = await db.query.bingoShipRules.findFirst({
    where: eq(bingoShipRules.bingoId, bingoId),
  })
  return mergeShipRulesByLength(rules?.rulesJson ?? [])
}

export async function getTeamShipPlacements(
  bingoId: string,
  teamId: string
): Promise<{ success: boolean; ships?: ShipPlacement[]; error?: string }> {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })
    if (!bingo || bingo.bingoType !== "battleship") {
      return { success: false, error: "Not a battleship board" }
    }

    const teamCheck = await assertTeamBelongsToEvent(bingo.eventId, teamId)
    if (!teamCheck.ok) return { success: false, error: teamCheck.error }

    const auth = await assertShipPlacementAccess(bingo.eventId, teamId)
    if (!auth.ok) return { success: false, error: auth.error }

    const ships = await db.query.battleshipShips.findMany({
      where: and(
        eq(battleshipShips.bingoId, bingoId),
        eq(battleshipShips.teamId, teamId)
      ),
      with: { tiles: true },
    })

    return {
      success: true,
      ships: ships.map((s) => ({
        length: s.shipLength,
        tileIds: s.tiles.map((t) => t.tileId),
      })),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching team ships")
    return { success: false, error: "Failed to fetch ships" }
  }
}

export async function saveTeamShipPlacements(
  bingoId: string,
  teamId: string,
  placements: ShipPlacement[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      with: { tiles: true, shipRules: true },
    })

    if (!bingo || bingo.bingoType !== "battleship") {
      return { success: false, error: "Not a battleship board" }
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, bingo.eventId),
      columns: { startDate: true, endDate: true },
    })
    if (!event) {
      return { success: false, error: "Event not found" }
    }

    const now = new Date()
    const eventIsActive =
      now >= new Date(event.startDate) && now <= new Date(event.endDate)
    const eventIsCompleted = now > new Date(event.endDate)
    if (eventIsActive || eventIsCompleted) {
      return {
        success: false,
        error: "Ship placement is only allowed before the event starts",
      }
    }

    const teamCheck = await assertTeamBelongsToEvent(bingo.eventId, teamId)
    if (!teamCheck.ok) return { success: false, error: teamCheck.error }

    const auth = await assertShipPlacementAccess(bingo.eventId, teamId)
    if (!auth.ok) return { success: false, error: auth.error }

    const rules = mergeShipRulesByLength(bingo.shipRules?.rulesJson ?? [])
    if (rules.length === 0) {
      return { success: false, error: "No ship rules configured for this board" }
    }

    const hiddenTileIds = new Set(
      bingo.tiles.filter((t) => t.isHidden).map((t) => t.id)
    )
    const tileCoords = bingo.tiles.map((t) => {
      const { col, row } = indexToCoord(t.index, bingo.columns)
      return { id: t.id, col, row }
    })

    if (placements.length > 0) {
      const validationError = validateShipPlacements(
        rules,
        placements as ShipPlacementInput[],
        tileCoords,
        { hiddenTileIds }
      )
      if (validationError) {
        return { success: false, error: validationError }
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(battleshipShips)
        .where(
          and(
            eq(battleshipShips.bingoId, bingoId),
            eq(battleshipShips.teamId, teamId)
          )
        )

      for (const placement of placements) {
        const [ship] = await tx
          .insert(battleshipShips)
          .values({
            bingoId,
            teamId,
            shipLength: placement.length,
          })
          .returning()

        if (!ship) continue

        await tx.insert(battleshipShipTiles).values(
          placement.tileIds.map((tileId) => ({
            shipId: ship.id,
            tileId,
          }))
        )
      }
    })

    revalidatePath(`/events/${bingo.eventId}/bingos/${bingoId}`)
    revalidatePath(`/events/${bingo.eventId}/bingos/${bingoId}/ships`)

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error saving team ships")
    return { success: false, error: "Failed to save ships" }
  }
}

export async function getBattleshipHits(bingoId: string) {
  const hits = await db.query.battleshipHits.findMany({
    where: eq(battleshipHits.bingoId, bingoId),
  })
  return hits.map((h) => ({
    tileId: h.tileId,
    attackerTeamId: h.attackerTeamId,
    defenderTeamId: h.defenderTeamId,
  }))
}

export async function getBattleshipSunkShipTileIds(
  bingoId: string,
  attackerTeamId: string
): Promise<string[]> {
  const [ships, hits] = await Promise.all([
    db.query.battleshipShips.findMany({
      where: eq(battleshipShips.bingoId, bingoId),
      with: { tiles: true },
    }),
    getBattleshipHits(bingoId),
  ])

  return getSunkShipTileIds(
    ships.map((s) => ({
      shipId: s.id,
      teamId: s.teamId,
      tileIds: s.tiles.map((t) => t.tileId),
    })),
    hits,
    attackerTeamId
  )
}

async function isOpponentShipSunkByAttacker(
  bingoId: string,
  shipId: string,
  attackerTeamId: string
): Promise<boolean> {
  const ship = await db.query.battleshipShips.findFirst({
    where: and(eq(battleshipShips.id, shipId), eq(battleshipShips.bingoId, bingoId)),
    with: { tiles: true },
  })

  if (!ship || ship.teamId === attackerTeamId || ship.tiles.length === 0) {
    return false
  }

  const sunkTiles = await getBattleshipSunkShipTileIds(bingoId, attackerTeamId)
  return ship.tiles.every((t) => sunkTiles.includes(t.tileId))
}

export async function recordBattleshipHitOnApproval(
  bingoId: string,
  tileId: string,
  attackerTeamId: string,
  teamTileSubmissionId: string
): Promise<{
  hit: boolean
  defenderTeamId?: string
  shipSunk?: boolean
  shipLength?: number
}> {
  const opponentShipTile = await db
    .select({
      shipId: battleshipShips.id,
      defenderTeamId: battleshipShips.teamId,
      shipLength: battleshipShips.shipLength,
    })
    .from(battleshipShipTiles)
    .innerJoin(
      battleshipShips,
      eq(battleshipShipTiles.shipId, battleshipShips.id)
    )
    .where(
      and(
        eq(battleshipShips.bingoId, bingoId),
        ne(battleshipShips.teamId, attackerTeamId),
        eq(battleshipShipTiles.tileId, tileId)
      )
    )
    .limit(1)

  const defender = opponentShipTile[0]
  if (!defender) {
    return { hit: false }
  }

  try {
    await db.insert(battleshipHits).values({
      bingoId,
      tileId,
      attackerTeamId,
      defenderTeamId: defender.defenderTeamId,
      teamTileSubmissionId,
    })
  } catch {
    // Unique constraint — hit already recorded for this team/tile
  }

  const shipSunk = await isOpponentShipSunkByAttacker(
    bingoId,
    defender.shipId,
    attackerTeamId
  )

  return {
    hit: true,
    defenderTeamId: defender.defenderTeamId,
    shipSunk,
    shipLength: shipSunk ? defender.shipLength : undefined,
  }
}

export async function parseShipRulesFromFormData(
  formData: FormData
): Promise<ShipRule[]> {
  const rules: ShipRule[] = []
  let i = 0
  while (formData.has(`shipRuleLength-${i}`)) {
    const length = parseInt(
      (formData.get(`shipRuleLength-${i}`) as string) || "0"
    )
    const count = parseInt((formData.get(`shipRuleCount-${i}`) as string) || "0")
    if (length > 0 && count > 0) {
      rules.push({ length, count })
    }
    i++
  }
  return mergeShipRulesByLength(rules)
}

export async function insertBingoShipRules(
  bingoId: string,
  rules: ShipRule[],
  board?: { rows: number; columns: number }
) {
  const merged = mergeShipRulesByLength(rules)
  if (merged.length === 0) return

  if (board) {
    const fitError = validateShipRulesFitBoard(
      merged,
      board.rows,
      board.columns
    )
    if (fitError) {
      throw new Error(fitError)
    }
  }

  await db.insert(bingoShipRules).values({
    bingoId,
    rulesJson: merged,
  })
}

export async function updateBingoShipRules(
  bingoId: string,
  rules: ShipRule[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
      columns: { bingoType: true, rows: true, columns: true, eventId: true },
    })

    if (!bingo || bingo.bingoType !== "battleship") {
      return { success: false, error: "Not a battleship board" }
    }

    const merged = mergeShipRulesByLength(rules)
    if (merged.length === 0) {
      return { success: false, error: "At least one ship rule is required" }
    }

    const fitError = validateShipRulesFitBoard(
      merged,
      bingo.rows,
      bingo.columns
    )
    if (fitError) {
      return { success: false, error: fitError }
    }

    const existing = await db.query.bingoShipRules.findFirst({
      where: eq(bingoShipRules.bingoId, bingoId),
    })

    if (existing) {
      await db
        .update(bingoShipRules)
        .set({ rulesJson: merged, updatedAt: new Date() })
        .where(eq(bingoShipRules.bingoId, bingoId))
    } else {
      await db.insert(bingoShipRules).values({
        bingoId,
        rulesJson: merged,
      })
    }

    revalidatePath(`/events/${bingo.eventId}/bingos/${bingoId}`)
    revalidatePath(`/events/${bingo.eventId}/bingos/${bingoId}/ships`)

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating ship rules")
    return { success: false, error: "Failed to update ship rules" }
  }
}
