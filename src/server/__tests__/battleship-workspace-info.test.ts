/**
 * @jest-environment node
 */
import { randomUUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  battleshipShips,
  battleshipShipTiles,
  teamTileSubmissions,
} from "@/server/db/schema"
import {
  getBattleshipWorkspaceInfo,
  getOwnShipLayout,
} from "@/server/battleship"
import {
  createBattleshipFixture,
  DAY_MS,
  setClock,
  validFleet,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

async function complete(teamId: string, tileId: string) {
  await db
    .insert(teamTileSubmissions)
    .values({ teamId, tileId, status: "completed" })
}

async function placeFleet(
  teamId: string,
  bingoId: string,
  fleet: Array<{ length: number; tileIds: string[] }>
) {
  for (const ship of fleet) {
    const [row] = await db
      .insert(battleshipShips)
      .values({ bingoId, teamId, shipLength: ship.length })
      .returning({ id: battleshipShips.id })
    await db
      .insert(battleshipShipTiles)
      .values(
        ship.tileIds.map((tileId) => ({ shipId: row!.id, teamId, tileId }))
      )
  }
}

let fx: BattleshipFixture
let t: string[]

const info = (userId: string) =>
  getBattleshipWorkspaceInfo({
    bingoId: fx.bingoId,
    eventId: fx.eventId,
    startDate: fx.startDate,
    userId,
  })

const flat = (ids: {
  hitTileIds: string[]
  missTileIds: string[]
  sunkTileIds: string[]
}) => [...ids.hitTileIds, ...ids.missTileIds, ...ids.sunkTileIds].sort()

beforeEach(async () => {
  jest.clearAllMocks()
  fx = await createBattleshipFixture()
  t = fx.tileIds
  await placeFleet(fx.teamAId, fx.bingoId, validFleet(t, 0))
  await placeFleet(fx.teamBId, fx.bingoId, validFleet(t, 1))
  // Team A sinks B's 2-ship (3, 4) and misses on 1; team B hits A's 0 and
  // misses on 7.
  await complete(fx.teamAId, t[3]!)
  await complete(fx.teamAId, t[4]!)
  await complete(fx.teamAId, t[1]!)
  await complete(fx.teamBId, t[0]!)
  await complete(fx.teamBId, t[7]!)
  // The clock starts after the event started.
  setClock(new Date(fx.startDate.getTime() + 60 * 1000))
})

afterEach(async () => {
  jest.useRealTimers()
  await fx.cleanup()
})

describe("getBattleshipWorkspaceInfo", () => {
  it("hands a team member only their own team's results", async () => {
    signInAs(fx.memberAId)
    const a = await info(fx.memberAId)
    expect(a.started).toBe(true)
    expect(a.bingoId).toBe(fx.bingoId)
    expect(a.marks.hitTileIds.sort()).toEqual([t[3]!, t[4]!].sort())
    expect(a.marks.missTileIds).toEqual([t[1]!])
    expect(a.marks.sunkTileIds.sort()).toEqual([t[3]!, t[4]!].sort())

    signInAs(fx.memberBId)
    const b = await info(fx.memberBId)
    expect(b.marks).toEqual({
      hitTileIds: [t[0]!],
      missTileIds: [t[7]!],
      sunkTileIds: [],
    })
  })

  it("never contains an opponent ship position that was not hit, nor the opponent's results", async () => {
    signInAs(fx.memberBId)
    const b = await info(fx.memberBId)
    // Team A's ships sit on 0, 3, 6 and 4, 5. Team B only completed 0 and 7,
    // so none of the others may show up in its marks, nor team A's own
    // results (1).
    for (const untouched of [t[3]!, t[6]!, t[4]!, t[5]!, t[1]!]) {
      expect(flat(b.marks)).not.toContain(untouched)
    }
    // ownShips holds team B's own positions (2, 5, 8, 3, 4), so only tiles
    // team B does not occupy can be asserted absent from the whole result:
    // team A's never-hit ship on 6 and team A's result on 1.
    expect(JSON.stringify(b)).not.toContain(t[6]!)
    expect(JSON.stringify(b)).not.toContain(t[1]!)
  })

  it("gives leaders the fleet rules and their team, and members no led team", async () => {
    signInAs(fx.leaderAId)
    expect((await info(fx.leaderAId)).ledTeamId).toBe(fx.teamAId)
    expect((await info(fx.memberAId)).ledTeamId).toBeNull()
  })

  it.each([
    ["an event manager on no team", () => fx.managerId],
    ["a participant without a team", () => fx.outsiderId],
    ["an anonymous visitor", () => null],
  ])("hands nothing to %s", async (_label, userId) => {
    const id = userId()
    signInAs(id)
    const result = await info(id ?? randomUUID())
    expect(result.marks).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })
    expect(result.ownShips).toEqual([])
  })

  it("hands out no results before the event starts, whatever was completed", async () => {
    setClock(new Date(fx.startDate.getTime() - DAY_MS / 2))
    signInAs(fx.memberAId)
    const early = await info(fx.memberAId)
    expect(early.started).toBe(false)
    expect(early.marks).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })
    expect(early.ownShips).toEqual([])
  })

  it("starts handing out results at the exact start instant", async () => {
    setClock(fx.startDate)
    signInAs(fx.memberAId)
    const result = await info(fx.memberAId)
    expect(result.marks.hitTileIds).toHaveLength(2)
    expect(result.ownShips).toHaveLength(2)
  })

  it("is empty one millisecond before the start", async () => {
    setClock(new Date(fx.startDate.getTime() - 1))
    signInAs(fx.memberAId)
    const result = await info(fx.memberAId)
    expect(result.started).toBe(false)
    expect(result.ownShips).toEqual([])
  })
})

describe("getBattleshipWorkspaceInfo ownShips", () => {
  const normalise = (ships: Array<{ length: number; tileIds: string[] }>) =>
    ships
      .map((ship) => ({
        length: ship.length,
        tileIds: [...ship.tileIds].sort(),
      }))
      .sort((a, b) => b.length - a.length)

  it("hands every member of a team exactly that team's fleet", async () => {
    for (const [userId, offset] of [
      [fx.leaderAId, 0],
      [fx.memberAId, 0],
      [fx.leaderBId, 1],
      [fx.memberBId, 1],
    ] as const) {
      signInAs(userId)
      expect(normalise((await info(userId)).ownShips)).toEqual(
        normalise(validFleet(t, offset))
      )
    }
  })

  it("does not leak a tile only the other team occupies", async () => {
    // Team A's ships sit on 0, 3, 6, 4, 5; team B's on 2, 5, 8, 3, 4. So 0
    // and 6 are only team A's, 2 and 8 only team B's.
    signInAs(fx.memberAId)
    const a = await info(fx.memberAId)
    expect(JSON.stringify(a.ownShips)).not.toContain(t[2]!)
    expect(JSON.stringify(a.ownShips)).not.toContain(t[8]!)

    signInAs(fx.memberBId)
    const b = await info(fx.memberBId)
    expect(JSON.stringify(b.ownShips)).not.toContain(t[0]!)
    expect(JSON.stringify(b.ownShips)).not.toContain(t[6]!)
  })

  it("carries no damage or sunk state, only length and tile ids", async () => {
    signInAs(fx.memberAId)
    const a = await info(fx.memberAId)
    for (const ship of a.ownShips) {
      expect(Object.keys(ship).sort()).toEqual(["length", "tileIds"])
    }
    // Team B hit tile 0 of team A's 3-ship; the layout stays intact.
    expect(a.ownShips.flatMap((s) => s.tileIds)).toContain(t[0]!)
  })
})

describe("getOwnShipLayout", () => {
  it("returns the ships of a team of the board's event", async () => {
    const layout = await getOwnShipLayout(fx.bingoId, fx.teamAId)
    expect(layout.flatMap((s) => s.tileIds).sort()).toEqual(
      [t[0]!, t[3]!, t[6]!, t[4]!, t[5]!].sort()
    )
  })

  it("is empty for a team of another event", async () => {
    const other = await createBattleshipFixture()
    try {
      await placeFleet(other.teamAId, other.bingoId, validFleet(other.tileIds))
      // The other event's team on this board, and this event's team on the
      // other board.
      expect(await getOwnShipLayout(fx.bingoId, other.teamAId)).toEqual([])
      expect(await getOwnShipLayout(other.bingoId, fx.teamAId)).toEqual([])
    } finally {
      await other.cleanup()
    }
  })

  it("is empty before the event starts", async () => {
    setClock(new Date(fx.startDate.getTime() - 1))
    expect(await getOwnShipLayout(fx.bingoId, fx.teamAId)).toEqual([])
  })

  it("is empty for a non-battleship board", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      setClock(new Date(standard.startDate.getTime() + 60 * 1000))
      expect(
        await getOwnShipLayout(standard.bingoId, standard.teamAId)
      ).toEqual([])
    } finally {
      await standard.cleanup()
    }
  })
})
