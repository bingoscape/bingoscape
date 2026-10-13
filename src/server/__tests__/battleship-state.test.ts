/**
 * @jest-environment node
 */
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  battleshipShips,
  battleshipShipTiles,
  teamTileSubmissions,
} from "@/server/db/schema"
import {
  getBattleshipBoardState,
  getBattleshipBoardStateForTeam,
  getTeamShipPlacements,
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

type Status = "incomplete" | "completed" | "needs_attention"

async function setStatus(
  teamId: string,
  tileId: string,
  status: Status
): Promise<void> {
  await db
    .insert(teamTileSubmissions)
    .values({ teamId, tileId, status })
    .onConflictDoUpdate({
      target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
      set: { status },
    })
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

const sorted = (ids: string[]) => [...ids].sort()

let fx: BattleshipFixture
// Team A ships: 0,3,6 (length 3) and 4,5 (length 2).
// Team B ships: 2,5,8 (length 3) and 3,4 (length 2).
let t: string[]

beforeEach(async () => {
  jest.clearAllMocks()
  fx = await createBattleshipFixture()
  t = fx.tileIds
  await placeFleet(fx.teamAId, fx.bingoId, validFleet(t, 0))
  await placeFleet(fx.teamBId, fx.bingoId, validFleet(t, 1))
  signInAs(fx.memberAId)
  // Marks are only handed out from the start on.
  setClock(new Date(fx.startDate.getTime() + DAY_MS / 24))
})

afterEach(async () => {
  jest.useRealTimers()
  await fx.cleanup()
})

describe("getBattleshipBoardState derived state", () => {
  it("is empty before anything is completed", async () => {
    expect(await getBattleshipBoardState(fx.bingoId)).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })
  })

  it("derives hits and misses from the viewer's completed tiles", async () => {
    await setStatus(fx.teamAId, t[2]!, "completed") // B ship -> hit
    await setStatus(fx.teamAId, t[1]!, "completed") // empty water -> miss
    await setStatus(fx.teamAId, t[0]!, "completed") // only A's own ship -> miss

    const state = await getBattleshipBoardState(fx.bingoId)
    expect(sorted(state.hitTileIds)).toEqual([t[2]!])
    expect(sorted(state.missTileIds)).toEqual(sorted([t[1]!, t[0]!]))
    expect(state.sunkTileIds).toEqual([])
  })

  it("marks a ship as sunk once every tile of it is hit", async () => {
    await setStatus(fx.teamAId, t[3]!, "completed")
    expect((await getBattleshipBoardState(fx.bingoId)).sunkTileIds).toEqual([])

    await setStatus(fx.teamAId, t[4]!, "completed")
    const state = await getBattleshipBoardState(fx.bingoId)
    expect(sorted(state.sunkTileIds)).toEqual(sorted([t[3]!, t[4]!]))
    expect(sorted(state.hitTileIds)).toEqual(sorted([t[3]!, t[4]!]))
  })

  it("un-completing a tile removes the hit and un-sinks the ship", async () => {
    await setStatus(fx.teamAId, t[3]!, "completed")
    await setStatus(fx.teamAId, t[4]!, "completed")
    await setStatus(fx.teamAId, t[4]!, "incomplete")

    const state = await getBattleshipBoardState(fx.bingoId)
    expect(state.hitTileIds).toEqual([t[3]!])
    expect(state.missTileIds).toEqual([])
    expect(state.sunkTileIds).toEqual([])
  })

  it("does not count needs_attention (or incomplete) tiles", async () => {
    await setStatus(fx.teamAId, t[2]!, "needs_attention")
    await setStatus(fx.teamAId, t[1]!, "incomplete")
    expect(await getBattleshipBoardState(fx.bingoId)).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })

    await setStatus(fx.teamAId, t[2]!, "completed")
    expect((await getBattleshipBoardState(fx.bingoId)).hitTileIds).toEqual([
      t[2]!,
    ])
  })

  it("answers for the viewer's own team: the other team has its own state", async () => {
    await setStatus(fx.teamAId, t[3]!, "completed")
    await setStatus(fx.teamAId, t[4]!, "completed")
    await setStatus(fx.teamBId, t[0]!, "completed") // hits A's 3-ship
    await setStatus(fx.teamBId, t[1]!, "completed") // miss

    signInAs(fx.leaderBId)
    const b = await getBattleshipBoardState(fx.bingoId)
    expect(b.hitTileIds).toEqual([t[0]!])
    expect(b.missTileIds).toEqual([t[1]!])
    expect(b.sunkTileIds).toEqual([])

    signInAs(fx.leaderAId)
    const a = await getBattleshipBoardState(fx.bingoId)
    expect(sorted(a.hitTileIds)).toEqual(sorted([t[3]!, t[4]!]))
    expect(a.missTileIds).toEqual([])
  })
})

describe("getBattleshipBoardState does not leak the opponent", () => {
  it("never returns opponent ship tiles the viewer did not complete", async () => {
    await setStatus(fx.teamAId, t[2]!, "completed")
    await setStatus(fx.teamAId, t[7]!, "completed")

    const state = await getBattleshipBoardState(fx.bingoId)
    const returned = [
      ...state.hitTileIds,
      ...state.missTileIds,
      ...state.sunkTileIds,
    ]
    // Team B's ships also sit on 5, 8, 3, 4: none of them may appear.
    for (const hidden of [t[5]!, t[8]!, t[3]!, t[4]!]) {
      expect(returned).not.toContain(hidden)
    }
    expect(
      sorted(returned.filter((id, i) => returned.indexOf(id) === i))
    ).toEqual(sorted([t[2]!, t[7]!]))
  })

  it("ignores the opponent's completions for the viewer's state", async () => {
    await setStatus(fx.teamBId, t[0]!, "completed")
    await setStatus(fx.teamBId, t[6]!, "completed")
    expect(await getBattleshipBoardState(fx.bingoId)).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })
  })

  it.each([
    ["anonymous", () => null],
    ["a participant without a team", () => fx.outsiderId],
    ["the event creator who is on no team", () => fx.managerId],
  ])("returns an empty state for %s", async (_label, userId) => {
    await setStatus(fx.teamAId, t[2]!, "completed")
    await setStatus(fx.teamBId, t[0]!, "completed")
    signInAs(userId())
    expect(await getBattleshipBoardState(fx.bingoId)).toEqual({
      hitTileIds: [],
      missTileIds: [],
      sunkTileIds: [],
    })
  })

  it("returns an empty state for non-battleship boards", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      await setStatus(standard.teamAId, standard.tileIds[0]!, "completed")
      signInAs(standard.leaderAId)
      expect(await getBattleshipBoardState(standard.bingoId)).toEqual({
        hitTileIds: [],
        missTileIds: [],
        sunkTileIds: [],
      })
    } finally {
      await standard.cleanup()
    }
  })

  it("does not use a team from another event", async () => {
    const other = await createBattleshipFixture()
    try {
      signInAs(other.leaderAId)
      expect(await getBattleshipBoardState(fx.bingoId)).toEqual({
        hitTileIds: [],
        missTileIds: [],
        sunkTileIds: [],
      })
    } finally {
      await other.cleanup()
    }
  })
})

describe("getBattleshipBoardStateForTeam", () => {
  const empty = { hitTileIds: [], missTileIds: [], sunkTileIds: [] }

  it("answers for the given team without a session", async () => {
    signInAs(null)
    await setStatus(fx.teamAId, t[2]!, "completed")
    await setStatus(fx.teamBId, t[0]!, "completed")

    expect(
      (await getBattleshipBoardStateForTeam(fx.bingoId, fx.teamAId)).hitTileIds
    ).toEqual([t[2]!])
    expect(
      (await getBattleshipBoardStateForTeam(fx.bingoId, fx.teamBId)).hitTileIds
    ).toEqual([t[0]!])
  })

  it("is empty before the event starts, for the wrapper too", async () => {
    await setStatus(fx.teamAId, t[2]!, "completed")
    setClock(new Date(fx.startDate.getTime() - DAY_MS / 24))

    expect(
      await getBattleshipBoardStateForTeam(fx.bingoId, fx.teamAId)
    ).toEqual(empty)
    expect(await getBattleshipBoardState(fx.bingoId)).toEqual(empty)

    setClock(fx.startDate)
    expect(
      (await getBattleshipBoardStateForTeam(fx.bingoId, fx.teamAId)).hitTileIds
    ).toEqual([t[2]!])
  })

  it("is empty for a team of another event and for other board types", async () => {
    await setStatus(fx.teamAId, t[2]!, "completed")
    const other = await createBattleshipFixture()
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      await setStatus(standard.teamAId, standard.tileIds[0]!, "completed")
      expect(
        await getBattleshipBoardStateForTeam(fx.bingoId, other.teamAId)
      ).toEqual(empty)
      expect(
        await getBattleshipBoardStateForTeam(standard.bingoId, standard.teamAId)
      ).toEqual(empty)
    } finally {
      await other.cleanup()
      await standard.cleanup()
    }
  })
})

describe("getTeamShipPlacements", () => {
  it("rejects anonymous callers", async () => {
    signInAs(null)
    await expect(getTeamShipPlacements(fx.bingoId, fx.teamAId)).rejects.toThrow(
      "Unauthorized"
    )
  })

  it.each([
    ["a plain member", () => fx.memberAId],
    ["the leader of the other team", () => fx.leaderBId],
    ["an outsider", () => fx.outsiderId],
  ])("rejects %s", async (_label, userId) => {
    signInAs(userId())
    await expect(getTeamShipPlacements(fx.bingoId, fx.teamAId)).rejects.toThrow(
      /Forbidden/
    )
  })

  it.each([
    ["the team leader", () => fx.leaderAId],
    ["the event creator", () => fx.managerId],
  ])("returns the fleet to %s", async (_label, userId) => {
    signInAs(userId())
    const ships = await getTeamShipPlacements(fx.bingoId, fx.teamAId)
    expect(ships.map((s) => s.length).sort()).toEqual([2, 3])
    expect(sorted(ships.flatMap((s) => s.tileIds))).toEqual(
      sorted(validFleet(t, 0).flatMap((s) => s.tileIds))
    )
  })

  it("rejects non-battleship boards and boards of another event", async () => {
    const standard = await createBattleshipFixture({ bingoType: "standard" })
    try {
      signInAs(standard.leaderAId)
      await expect(
        getTeamShipPlacements(standard.bingoId, standard.teamAId)
      ).rejects.toThrow("Not a battleship board")
      await expect(
        getTeamShipPlacements(fx.bingoId, standard.teamAId)
      ).rejects.toThrow(/not found/)
    } finally {
      await standard.cleanup()
    }
  })
})
