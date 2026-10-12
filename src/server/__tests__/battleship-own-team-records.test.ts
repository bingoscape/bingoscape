/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/server/queries/events"
import { db } from "@/server/db"
import { bingos, teamTileSubmissions } from "@/server/db/schema"
import {
  createBattleshipFixture,
  setClock,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

let fx: BattleshipFixture

async function recordsSeenBy(userId: string | null) {
  signInAs(userId)
  const data = await getEventById(fx.eventId)
  const board = data?.event.bingos?.find((b) => b.id === fx.bingoId)
  return (board?.tiles ?? []).flatMap((tile) =>
    (tile.teamTileSubmissions ?? []).map((tts) => ({
      tileId: tile.id,
      teamId: tts.teamId,
    }))
  )
}

async function setUp(bingoType: "battleship" | "standard") {
  fx = await createBattleshipFixture({ bingoType })
  await db
    .update(bingos)
    .set({ visible: true })
    .where(eq(bingos.id, fx.bingoId))
  await db.insert(teamTileSubmissions).values([
    { teamId: fx.teamAId, tileId: fx.tileIds[0]!, status: "completed" },
    { teamId: fx.teamBId, tileId: fx.tileIds[1]!, status: "completed" },
    { teamId: fx.teamBId, tileId: fx.tileIds[2]!, status: "completed" },
  ])
  setClock(new Date(fx.startDate.getTime() + 60 * 1000))
}

afterEach(async () => {
  jest.useRealTimers()
  await fx.cleanup()
})

describe("getEventById on a battleship board", () => {
  beforeEach(() => setUp("battleship"))

  it("gives a player only their own team's records, not what the opponent completed", async () => {
    expect(await recordsSeenBy(fx.memberAId)).toEqual([
      { tileId: fx.tileIds[0], teamId: fx.teamAId },
    ])
    expect(
      (await recordsSeenBy(fx.leaderBId)).map((r) => r.tileId).sort()
    ).toEqual([fx.tileIds[1]!, fx.tileIds[2]!].sort())
  })

  it("gives people on no team nothing", async () => {
    expect(await recordsSeenBy(fx.outsiderId)).toEqual([])
  })

  it("leaves managers the full picture", async () => {
    const seen = await recordsSeenBy(fx.managerId)
    expect(seen).toHaveLength(3)
    expect(new Set(seen.map((r) => r.teamId))).toEqual(
      new Set([fx.teamAId, fx.teamBId])
    )
  })
})

describe("getEventById on a standard board", () => {
  beforeEach(() => setUp("standard"))

  it("still gives players every team's records", async () => {
    expect(await recordsSeenBy(fx.memberAId)).toHaveLength(3)
  })
})
