/**
 * @jest-environment node
 */
import { and, eq } from "drizzle-orm"

import * as battleshipActions from "@/app/actions/battleship"
import {
  saveTeamShipPlacements,
  updateBingoShipRules,
} from "@/app/actions/battleship"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  battleshipShips,
  battleshipShipTiles,
  bingoShipRules,
  eventParticipants,
  tiles,
} from "@/server/db/schema"
import { getBingoShipRules, isUniqueViolation } from "@/server/battleship"
import {
  createBattleshipFixture,
  DAY_MS,
  setClock,
  validFleet,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

async function shipsOf(teamId: string) {
  return db.query.battleshipShips.findMany({
    where: eq(battleshipShips.teamId, teamId),
    with: { tiles: true },
  })
}

async function shipTileCount(teamId: string) {
  return (
    await db
      .select()
      .from(battleshipShipTiles)
      .where(eq(battleshipShipTiles.teamId, teamId))
  ).length
}

let fx: BattleshipFixture

beforeEach(async () => {
  jest.clearAllMocks()
  fx = await createBattleshipFixture()
  signInAs(fx.leaderAId)
})

afterEach(async () => {
  jest.useRealTimers()
  await fx.cleanup()
})

describe("battleship actions surface", () => {
  it("only exports the two mutations and nothing that returns game state", () => {
    expect(Object.keys(battleshipActions).sort()).toEqual([
      "saveTeamShipPlacements",
      "updateBingoShipRules",
    ])
  })
})

describe("saveTeamShipPlacements authorization", () => {
  it("rejects unauthenticated callers", async () => {
    signInAs(null)
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result).toMatchObject({
      success: false,
      error: "Unauthorized",
      code: "UNAUTHENTICATED",
    })
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
  })

  it.each([
    ["a plain team member", () => fx.memberAId],
    ["the leader of the other team", () => fx.leaderBId],
    ["a participant without a team", () => fx.outsiderId],
  ])("rejects %s", async (_label, userId) => {
    signInAs(userId())
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Forbidden/)
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
  })

  it("checks authorization before the event-start check", async () => {
    setClock(new Date(fx.startDate.getTime() + 1000))
    signInAs(fx.memberAId)
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result.error).toMatch(/Forbidden/)
  })

  it("allows the team leader", async () => {
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result).toEqual({ success: true })
    const ships = await shipsOf(fx.teamAId)
    expect(ships.map((s) => s.shipLength).sort()).toEqual([2, 3])
    expect(await shipTileCount(fx.teamAId)).toBe(5)
  })

  it("allows the event creator", async () => {
    signInAs(fx.managerId)
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamBId,
      validFleet(fx.tileIds, 1)
    )
    expect(result).toEqual({ success: true })
    expect(await shipsOf(fx.teamBId)).toHaveLength(2)
  })

  it("allows a management participant", async () => {
    await db
      .update(eventParticipants)
      .set({ role: "management" })
      .where(eq(eventParticipants.userId, fx.outsiderId))
    signInAs(fx.outsiderId)
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamBId,
      validFleet(fx.tileIds, 1)
    )
    expect(result).toEqual({ success: true })
  })

  it("derives the event from the database: a team of another event is rejected", async () => {
    const other = await createBattleshipFixture()
    try {
      signInAs(other.leaderAId)
      const result = await saveTeamShipPlacements(
        fx.bingoId,
        other.teamAId,
        validFleet(fx.tileIds)
      )
      expect(result).toEqual({
        success: false,
        error: "Board not found for this team",
      })
      expect(await shipsOf(other.teamAId)).toHaveLength(0)
    } finally {
      await other.cleanup()
    }
  })
})

describe("saveTeamShipPlacements game rules", () => {
  it("rejects non-battleship boards", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.leaderAId)
      const result = await saveTeamShipPlacements(
        standard.bingoId,
        standard.teamAId,
        validFleet(standard.tileIds)
      )
      expect(result).toEqual({
        success: false,
        error: "Not a battleship board",
      })
    } finally {
      await standard.cleanup()
    }
  })

  it("is locked from the start date on, for the leader and for managers", async () => {
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, validFleet(fx.tileIds))

    setClock(new Date(fx.startDate.getTime()))
    for (const userId of [fx.leaderAId, fx.managerId]) {
      signInAs(userId)
      const result = await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        validFleet(fx.tileIds, 1)
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/before the event starts/)
    }
    // Still locked long after the event ended.
    setClock(new Date(fx.startDate.getTime() + 30 * DAY_MS))
    expect(
      (await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [])).success
    ).toBe(false)

    // The original fleet is untouched.
    const ships = await shipsOf(fx.teamAId)
    expect(ships.flatMap((s) => s.tiles.map((t) => t.tileId)).sort()).toEqual(
      validFleet(fx.tileIds)
        .flatMap((s) => s.tileIds)
        .sort()
    )
  })

  it("works right before the start date", async () => {
    setClock(new Date(fx.startDate.getTime() - 1))
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result).toEqual({ success: true })
  })

  it("rejects an incomplete fleet, bad shapes and unknown tiles", async () => {
    const fleet = validFleet(fx.tileIds)
    const cases: Array<[string, Array<{ length: number; tileIds: string[] }>]> =
      [
        ["missing ship", [fleet[0]!]],
        [
          "crooked ship",
          [
            {
              length: 3,
              tileIds: [fx.tileIds[0]!, fx.tileIds[1]!, fx.tileIds[4]!],
            },
            fleet[1]!,
          ],
        ],
        [
          "unknown tile",
          [
            fleet[0]!,
            {
              length: 2,
              tileIds: [fx.tileIds[4]!, "00000000-0000-4000-8000-000000000000"],
            },
          ],
        ],
        [
          "wrong length",
          [{ length: 2, tileIds: fleet[0]!.tileIds }, fleet[1]!],
        ],
      ]
    for (const [label, placements] of cases) {
      const result = await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        placements
      )
      expect([label, result.success]).toEqual([label, false])
    }
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
  })

  it("rejects malformed payloads", async () => {
    const result = await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [
      { length: 2, tileIds: [1, 2] },
    ] as unknown as Array<{
      length: number
      tileIds: string[]
    }>)
    expect(result).toEqual({ success: false, error: "Invalid ship placements" })
  })

  it("rejects overlapping ships and writes nothing", async () => {
    const result = await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [
      { length: 3, tileIds: [fx.tileIds[0]!, fx.tileIds[3]!, fx.tileIds[6]!] },
      { length: 2, tileIds: [fx.tileIds[6]!, fx.tileIds[7]!] },
    ])
    expect(result).toEqual({ success: false, error: "Overlapping ship tiles" })
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
  })

  it("rejects ships on hidden tiles", async () => {
    await db
      .update(tiles)
      .set({ isHidden: true })
      .where(eq(tiles.id, fx.tileIds[4]!))
    const result = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(result).toEqual({
      success: false,
      error: "Cannot place ships on hidden tiles",
    })
  })

  it("lets both teams place ships on the same tiles", async () => {
    expect(
      await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamAId,
        validFleet(fx.tileIds)
      )
    ).toEqual({ success: true })
    signInAs(fx.leaderBId)
    expect(
      await saveTeamShipPlacements(
        fx.bingoId,
        fx.teamBId,
        validFleet(fx.tileIds)
      )
    ).toEqual({ success: true })
    expect(await shipTileCount(fx.teamAId)).toBe(5)
    expect(await shipTileCount(fx.teamBId)).toBe(5)
  })

  it("replaces the old fleet and an empty list clears it", async () => {
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, validFleet(fx.tileIds))
    await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds, 1)
    )
    const ships = await shipsOf(fx.teamAId)
    expect(ships.flatMap((s) => s.tiles.map((t) => t.tileId)).sort()).toEqual(
      validFleet(fx.tileIds, 1)
        .flatMap((s) => s.tileIds)
        .sort()
    )

    expect(await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [])).toEqual({
      success: true,
    })
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
  })

  it("the database refuses a team's ships overlapping, and the error is recognised", async () => {
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, validFleet(fx.tileIds))
    const [other] = await db
      .insert(battleshipShips)
      .values({ bingoId: fx.bingoId, teamId: fx.teamAId, shipLength: 1 })
      .returning({ id: battleshipShips.id })

    let caught: unknown
    try {
      await db.insert(battleshipShipTiles).values({
        shipId: other!.id,
        teamId: fx.teamAId,
        tileId: fx.tileIds[0]!,
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeDefined()
    expect(isUniqueViolation(caught)).toBe(true)
    expect(isUniqueViolation(new Error("boom"))).toBe(false)
  })

  it("serialises concurrent saves for the same team into exactly one fleet", async () => {
    const fleets = [validFleet(fx.tileIds, 0), validFleet(fx.tileIds, 1)]
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        saveTeamShipPlacements(fx.bingoId, fx.teamAId, fleets[i % 2]!)
      )
    )
    expect(results).toEqual(Array(6).fill({ success: true }))

    const ships = await shipsOf(fx.teamAId)
    expect(ships).toHaveLength(2)
    expect(await shipTileCount(fx.teamAId)).toBe(5)
    const remaining = ships.flatMap((s) => s.tiles.map((t) => t.tileId)).sort()
    const matchesOne = fleets.some(
      (f) =>
        JSON.stringify(f.flatMap((s) => s.tileIds).sort()) ===
        JSON.stringify(remaining)
    )
    expect(matchesOne).toBe(true)
  })
})

describe("updateBingoShipRules", () => {
  const newRules = [
    { length: 2, count: 1 },
    { length: 2, count: 1 },
    { length: 3, count: 1 },
  ]

  it("rejects unauthenticated callers, leaders and members", async () => {
    for (const userId of [null, fx.leaderAId, fx.memberAId, fx.outsiderId]) {
      signInAs(userId)
      const result = await updateBingoShipRules(fx.bingoId, newRules)
      expect(result.success).toBe(false)
    }
    expect(await getBingoShipRules(fx.bingoId)).toEqual([
      { length: 2, count: 1 },
      { length: 3, count: 1 },
    ])
  })

  it("rejects non-battleship boards", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.managerId)
      expect(await updateBingoShipRules(standard.bingoId, newRules)).toEqual({
        success: false,
        error: "Not a battleship board",
      })
      const stored = await db.query.bingoShipRules.findFirst({
        where: eq(bingoShipRules.bingoId, standard.bingoId),
      })
      expect(stored).toBeUndefined()
    } finally {
      await standard.cleanup()
    }
  })

  it("is locked from the start date on", async () => {
    signInAs(fx.managerId)
    setClock(new Date(fx.startDate.getTime()))
    const result = await updateBingoShipRules(fx.bingoId, newRules)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/before the event starts/)
  })

  it("rejects malformed rules and fleets that do not fit the board", async () => {
    signInAs(fx.managerId)
    expect(
      (await updateBingoShipRules(fx.bingoId, [{ length: 0, count: 1 }])).error
    ).toBe("Invalid ship rules")
    expect(
      (await updateBingoShipRules(fx.bingoId, [{ length: 4, count: 1 }]))
        .success
    ).toBe(false)
    expect((await updateBingoShipRules(fx.bingoId, [])).success).toBe(false)
    expect(
      (await updateBingoShipRules(fx.bingoId, [{ length: 3, count: 4 }]))
        .success
    ).toBe(false)
  })

  it("merges duplicate lengths, stores the rules and clears every team's placements", async () => {
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, validFleet(fx.tileIds))
    signInAs(fx.leaderBId)
    await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamBId,
      validFleet(fx.tileIds, 1)
    )
    expect(await shipsOf(fx.teamAId)).toHaveLength(2)

    signInAs(fx.managerId)
    const result = await updateBingoShipRules(fx.bingoId, newRules)
    expect(result).toEqual({ success: true, clearedTeams: 2 })

    expect(await getBingoShipRules(fx.bingoId)).toEqual([
      { length: 2, count: 2 },
      { length: 3, count: 1 },
    ])
    expect(await shipsOf(fx.teamAId)).toHaveLength(0)
    expect(await shipsOf(fx.teamBId)).toHaveLength(0)
    const leftovers = await db
      .select()
      .from(battleshipShips)
      .where(and(eq(battleshipShips.bingoId, fx.bingoId)))
    expect(leftovers).toHaveLength(0)
  })

  it("reports zero cleared teams when nobody had placed ships", async () => {
    signInAs(fx.managerId)
    expect(await updateBingoShipRules(fx.bingoId, newRules)).toEqual({
      success: true,
      clearedTeams: 0,
    })
  })

  it("keeps old placements out once the fleet changed", async () => {
    await saveTeamShipPlacements(fx.bingoId, fx.teamAId, validFleet(fx.tileIds))
    signInAs(fx.managerId)
    await updateBingoShipRules(fx.bingoId, [{ length: 2, count: 1 }])
    signInAs(fx.leaderAId)
    // The old two-ship fleet no longer matches the rules.
    const stale = await saveTeamShipPlacements(
      fx.bingoId,
      fx.teamAId,
      validFleet(fx.tileIds)
    )
    expect(stale.success).toBe(false)
    const fresh = await saveTeamShipPlacements(fx.bingoId, fx.teamAId, [
      { length: 2, tileIds: [fx.tileIds[0]!, fx.tileIds[1]!] },
    ])
    expect(fresh).toEqual({ success: true })
  })
})
