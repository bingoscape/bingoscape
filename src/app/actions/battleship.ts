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
  type ShipRule,
} from "@/server/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { indexToCoord } from "@/lib/ship-placement"
import type { ShipPlacementInput } from "@/lib/ship-placement"
import { validateShipPlacements } from "@/lib/validate-ship-placements"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

export type ShipPlacement = {
  length: number
  tileIds: string[]
}

async function assertTeamMemberOrManagement(
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
      error: "Only team leaders or board creator can manage ship placement",
    }
  }

  return { ok: true }
}

export async function getBingoShipRules(bingoId: string) {
  const rules = await db.query.bingoShipRules.findFirst({
    where: eq(bingoShipRules.bingoId, bingoId),
  })
  return rules?.rulesJson ?? []
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

    const auth = await assertTeamMemberOrManagement(bingo.eventId, teamId)
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

    const auth = await assertTeamMemberOrManagement(bingo.eventId, teamId)
    if (!auth.ok) return { success: false, error: auth.error }

    const rules: ShipRule[] = bingo.shipRules?.rulesJson ?? []
    if (rules.length === 0) {
      return { success: false, error: "No ship rules configured for this board" }
    }

    const tileCoords = bingo.tiles.map((t) => {
      const { col, row } = indexToCoord(t.index, bingo.columns)
      return { id: t.id, col, row }
    })

    const validationError = validateShipPlacements(
      rules,
      placements as ShipPlacementInput[],
      tileCoords
    )
    if (validationError) {
      return { success: false, error: validationError }
    }

    await db.transaction(async (tx) => {
      const existingShips = await tx.query.battleshipShips.findMany({
        where: and(
          eq(battleshipShips.bingoId, bingoId),
          eq(battleshipShips.teamId, teamId)
        ),
      })

      for (const ship of existingShips) {
        await tx
          .delete(battleshipShipTiles)
          .where(eq(battleshipShipTiles.shipId, ship.id))
      }
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

export async function recordBattleshipHitOnApproval(
  bingoId: string,
  tileId: string,
  attackerTeamId: string,
  teamTileSubmissionId: string
): Promise<{ hit: boolean; defenderTeamId?: string }> {
  const opponentShipTile = await db
    .select({
      defenderTeamId: battleshipShips.teamId,
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
    return { hit: true, defenderTeamId: defender.defenderTeamId }
  } catch {
    // Unique constraint — hit already recorded for this team/tile
    return { hit: true, defenderTeamId: defender.defenderTeamId }
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
  return rules
}

export async function insertBingoShipRules(
  bingoId: string,
  rules: ShipRule[]
) {
  if (rules.length === 0) return
  await db.insert(bingoShipRules).values({
    bingoId,
    rulesJson: rules,
  })
}
