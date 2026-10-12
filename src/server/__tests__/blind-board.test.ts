/**
 * @jest-environment node
 */
import { and, eq } from "drizzle-orm"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { eventParticipants } from "@/server/db/schema"
import { canReadGoal, canReadTile } from "@/server/authz"
import {
  applyBlindBoard,
  blindTileTitle,
  isBlindBoard,
  redactBlindTile,
} from "@/server/blind-board"
import {
  isBingoBlindForViewer,
  isTileBlindForViewer,
} from "@/server/blind-board-viewer"
import {
  createBlindFixture,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"
import { setClock } from "@/server/__tests__/helpers/battleship-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

afterEach(() => {
  jest.useRealTimers()
})

describe("isBlindBoard", () => {
  const DAY = 24 * 60 * 60 * 1000
  const start = new Date(Math.floor(Date.now() / 1000) * 1000 + 7 * DAY)
  const before = new Date(start.getTime() - 1)
  const after = new Date(start.getTime() + 1)
  const ended = new Date(start.getTime() + 30 * DAY)

  const viewer = (
    overrides: Partial<Parameters<typeof isBlindBoard>[0]> = {}
  ) => ({
    bingoType: "battleship" as const,
    startDate: start,
    isManager: false,
    ...overrides,
  })

  it("is blind for a non-manager before the event starts", () => {
    expect(isBlindBoard(viewer(), before)).toBe(true)
  })

  it("is not blind at the exact start instant", () => {
    expect(isBlindBoard(viewer(), start)).toBe(false)
  })

  it("is not blind after the start", () => {
    expect(isBlindBoard(viewer(), after)).toBe(false)
  })

  it("stays open after the event ended (never blind again)", () => {
    expect(isBlindBoard(viewer(), ended)).toBe(false)
  })

  it("is never blind for a manager", () => {
    expect(isBlindBoard(viewer({ isManager: true }), before)).toBe(false)
  })

  it.each(["standard", "progression"] as const)(
    "is never blind for a %s board",
    (bingoType) => {
      expect(isBlindBoard(viewer({ bingoType }), before)).toBe(false)
    }
  )

  it("accepts string and number start dates", () => {
    expect(
      isBlindBoard(viewer({ startDate: start.toISOString() }), before)
    ).toBe(true)
    expect(isBlindBoard(viewer({ startDate: start.getTime() }), after)).toBe(
      false
    )
  })

  it("uses the current clock by default", () => {
    setClock(before)
    expect(isBlindBoard(viewer())).toBe(true)
    jest.setSystemTime(after)
    expect(isBlindBoard(viewer())).toBe(false)
  })
})

describe("redactBlindTile", () => {
  const tile = {
    id: "tile-1",
    bingoId: "bingo-1",
    index: 4,
    tier: 0,
    isHidden: false,
    title: "Secret",
    description: "Secret description",
    headerImage: "https://example.test/secret.png",
    weight: 50,
    goals: [{ id: "g", description: "Secret goal" }],
    goalGroups: [{ id: "gg", name: "Secret group" }],
    teamTileSubmissions: [{ id: "tts", submissions: [{ id: "s" }] }],
  }

  it("replaces the title with a 1-based position placeholder", () => {
    expect(blindTileTitle(0)).toBe("Tile 1")
    expect(redactBlindTile(tile).title).toBe("Tile 5")
  })

  it("empties all content and marks the tile blind", () => {
    const redacted = redactBlindTile(tile)
    expect(redacted).toMatchObject({
      isBlind: true,
      title: "Tile 5",
      description: "",
      headerImage: null,
      weight: 0,
      goals: [],
      goalGroups: [],
      teamTileSubmissions: [],
    })
    expect(JSON.stringify(redacted)).not.toContain("Secret")
  })

  it("keeps the identity and geometry fields", () => {
    expect(redactBlindTile(tile)).toMatchObject({
      id: "tile-1",
      bingoId: "bingo-1",
      index: 4,
      tier: 0,
      isHidden: false,
    })
  })

  it("only touches the fields that are present on narrow projections", () => {
    const narrow = { id: "t", index: 2, title: "Secret", isHidden: false }
    expect(redactBlindTile(narrow)).toEqual({
      id: "t",
      index: 2,
      title: "Tile 3",
      isHidden: false,
      isBlind: true,
    })
  })

  it("does not mutate its input", () => {
    const copy = JSON.parse(JSON.stringify(tile)) as typeof tile
    redactBlindTile(tile)
    expect(tile).toEqual(copy)
  })
})

describe("applyBlindBoard", () => {
  const boardTiles = [
    { id: "a", index: 0, title: "Alpha", description: "x" },
    { id: "b", index: 1, title: "Beta", description: "y" },
  ]

  it("redacts every tile of a blind board", () => {
    const result = applyBlindBoard(boardTiles, true)
    expect(result.map((t) => [t.id, t.title, t.isBlind])).toEqual([
      ["a", "Tile 1", true],
      ["b", "Tile 2", true],
    ])
  })

  it("leaves content alone but stamps isBlind: false otherwise", () => {
    expect(applyBlindBoard(boardTiles, false)).toEqual([
      { id: "a", index: 0, title: "Alpha", description: "x", isBlind: false },
      { id: "b", index: 1, title: "Beta", description: "y", isBlind: false },
    ])
  })
})

describe("blind resolvers and canReadTile / canReadGoal", () => {
  let fx: BlindFixture
  let standard: BlindFixture

  beforeEach(async () => {
    jest.clearAllMocks()
    fx = await createBlindFixture()
    standard = await createBlindFixture({ bingoType: "standard" })
  })

  afterEach(async () => {
    await fx.cleanup()
    await standard.cleanup()
  })

  it.each([
    ["before the start", "beforeStart", true],
    ["at the start", "atStart", false],
    ["after the start", "afterStart", false],
    ["after the end", "afterEnd", false],
  ] as const)(
    "a participant is blind exactly when the event has not started: %s",
    async (_label, phase, expectedBlind) => {
      setClock(fx.clock[phase])
      signInAs(fx.memberAId)

      expect(await isBingoBlindForViewer(fx.bingoId)).toBe(expectedBlind)
      expect(await isTileBlindForViewer(fx.tileIds[3]!)).toBe(expectedBlind)
      expect(await canReadTile(fx.tileIds[3]!)).toBe(!expectedBlind)
      expect(await canReadGoal(fx.itemGoalId)).toBe(!expectedBlind)
    }
  )

  it("signed-out and outsider viewers are blind before the start", async () => {
    setClock(fx.clock.beforeStart)

    signInAs(null)
    expect(await isBingoBlindForViewer(fx.bingoId)).toBe(true)
    expect(await canReadTile(fx.tileIds[0]!)).toBe(false)

    signInAs(fx.outsiderId)
    expect(await isBingoBlindForViewer(fx.bingoId)).toBe(true)
    expect(await canReadTile(fx.tileIds[0]!)).toBe(false)
  })

  it("the other team's leader is blind before the start", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.leaderBId)
    expect(await canReadTile(fx.tileIds[0]!)).toBe(false)
  })

  it("the creator (admin) is never blind", async () => {
    signInAs(fx.managerId)
    for (const phase of ["beforeStart", "afterStart", "afterEnd"] as const) {
      setClock(fx.clock[phase])
      expect(await isBingoBlindForViewer(fx.bingoId)).toBe(false)
      expect(await canReadTile(fx.tileIds[0]!)).toBe(true)
      expect(await canReadGoal(fx.itemGoalId)).toBe(true)
    }
  })

  it("a management participant is never blind", async () => {
    await db
      .update(eventParticipants)
      .set({ role: "management" })
      .where(
        and(
          eq(eventParticipants.eventId, fx.eventId),
          eq(eventParticipants.userId, fx.outsiderId)
        )
      )

    setClock(fx.clock.beforeStart)
    signInAs(fx.outsiderId)
    expect(await isBingoBlindForViewer(fx.bingoId)).toBe(false)
    expect(await canReadTile(fx.tileIds[0]!)).toBe(true)
  })

  it("a non-battleship board is never blind", async () => {
    setClock(standard.clock.beforeStart)
    signInAs(standard.memberAId)
    expect(await isBingoBlindForViewer(standard.bingoId)).toBe(false)
    expect(await isTileBlindForViewer(standard.tileIds[0]!)).toBe(false)
    expect(await canReadTile(standard.tileIds[0]!)).toBe(true)
    expect(await canReadGoal(standard.itemGoalId)).toBe(true)
  })

  it("unknown boards and tiles are not blind (and not readable)", async () => {
    signInAs(fx.memberAId)
    const unknown = "00000000-0000-4000-8000-000000000000"
    expect(await isBingoBlindForViewer(unknown)).toBe(false)
    expect(await isTileBlindForViewer(unknown)).toBe(false)
    expect(await canReadTile(unknown)).toBe(false)
    expect(await canReadGoal(unknown)).toBe(false)
  })
})
