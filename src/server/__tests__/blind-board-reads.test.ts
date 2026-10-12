/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/server/queries/events"
import { getMiniBoardTiles } from "@/app/actions/events"
import { getBingoById } from "@/app/actions/getBingoById"
import { getAllTeamPointsAndTotal, getEventStats } from "@/app/actions/stats"
import {
  getBingoItemStatistics,
  getEventItemStatistics,
} from "@/app/actions/item-statistics"
import {
  getPublicBingoDetails,
  getPublicWorkspaceData,
} from "@/app/actions/public-events"
import {
  getAllSubmissionsForTeam,
  getGoalWithItemData,
  getItemGoalsForTile,
  getTileGoalsAndProgress,
} from "@/app/actions/bingo"
import { getGoalTree, getGoalTreeWithProgress } from "@/app/actions/goal-groups"
import { getGoalValues } from "@/app/actions/goals"
import { getNotifications } from "@/app/actions/notifications"
import { db } from "@/server/db"
import { notifications, tiles } from "@/server/db/schema"
import {
  createBlindFixture,
  expectNoSecrets,
  expectSecret,
  type BlindFixture,
} from "@/server/__tests__/helpers/blind-fixture"
import { setClock } from "@/server/__tests__/helpers/battleship-fixture"

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
// Item statistics price items through the network.
jest.mock("@/lib/osrs-ge-prices", () => ({
  getItemAveragePrices: jest.fn(
    async (ids: number[]) => new Map(ids.map((id) => [id, 100]))
  ),
}))

const session = getServerAuthSession as jest.Mock

function signInAs(userId: string | null) {
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)
}

afterEach(() => {
  jest.useRealTimers()
})

type Phase = keyof BlindFixture["clock"]
const OPEN_PHASES: Phase[] = ["atStart", "afterStart", "afterEnd"]

interface PathConfig {
  name: string
  /** Reads the path as the currently signed-in viewer. */
  read: (fx: BlindFixture) => Promise<unknown>
  /** A string the full (unredacted) result carries. Omit for paths that never carry content. */
  visibleSecret?: (fx: BlindFixture) => string
  /** Public paths ignore the session; there is no manager view. */
  publicPath?: boolean
  /** Only members of team A (and managers) may call the path at all. */
  teamAOnly?: boolean
}

/**
 * The matrix every read path goes through: redacted for a participant and an
 * outsider before the start, full for a manager before the start, full for
 * everyone from the start (also after the end), never redacted on a standard
 * board.
 */
function describeReadPath(config: PathConfig) {
  describe(config.name, () => {
    let fx: BlindFixture

    beforeEach(async () => {
      jest.clearAllMocks()
      fx = await createBlindFixture()
    })

    afterEach(async () => {
      await fx.cleanup()
    })

    const viewer = (fixture: BlindFixture, who: "member" | "outsider") =>
      config.publicPath
        ? null
        : who === "member"
          ? fixture.memberAId
          : fixture.outsiderId

    it("hands a participant no tile content before the start", async () => {
      setClock(fx.clock.beforeStart)
      signInAs(viewer(fx, "member"))
      expectNoSecrets(await config.read(fx), fx.secrets)
    })

    if (!config.teamAOnly) {
      it("hands an outsider no tile content before the start", async () => {
        setClock(fx.clock.beforeStart)
        signInAs(viewer(fx, "outsider"))
        expectNoSecrets(await config.read(fx), fx.secrets)
      })
    }

    if (config.visibleSecret) {
      const secretOf = config.visibleSecret

      if (!config.publicPath) {
        it("hands the manager the full data before the start", async () => {
          setClock(fx.clock.beforeStart)
          signInAs(fx.managerId)
          expectSecret(await config.read(fx), secretOf(fx))
        })
      }

      it.each(OPEN_PHASES)("hands everyone the full data %s", async (phase) => {
        setClock(fx.clock[phase])
        signInAs(viewer(fx, "member"))
        expectSecret(await config.read(fx), secretOf(fx))
        if (!config.teamAOnly) {
          signInAs(viewer(fx, "outsider"))
          expectSecret(await config.read(fx), secretOf(fx))
        }
      })

      it("never redacts a non-battleship board", async () => {
        const standard = await createBlindFixture({ bingoType: "standard" })
        try {
          setClock(standard.clock.beforeStart)
          signInAs(viewer(standard, "member"))
          expectSecret(await config.read(standard), secretOf(standard))
        } finally {
          await standard.cleanup()
        }
      })
    } else {
      it.each(OPEN_PHASES)("never carries tile content %s", async (phase) => {
        setClock(fx.clock[phase])
        signInAs(viewer(fx, "member"))
        expectNoSecrets(await config.read(fx), fx.secrets)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Event workspace data (page -> slimEvent)
// ---------------------------------------------------------------------------

describeReadPath({
  name: "getEventById (event workspace, tile panel, ?tile=)",
  read: async (fx) => getEventById(fx.eventId),
  visibleSecret: (fx) => fx.titleOf(0),
})

describeReadPath({
  name: "getMiniBoardTiles",
  read: async (fx) => getMiniBoardTiles(fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
})

describeReadPath({
  name: "getBingoById (submissions page, tier modal)",
  read: async (fx) => getBingoById(fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
})

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describeReadPath({
  name: "getAllTeamPointsAndTotal (board stats)",
  read: async (fx) => getAllTeamPointsAndTotal(fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
})

describeReadPath({
  name: "getBingoItemStatistics",
  read: async (fx) => getBingoItemStatistics(fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
})

describeReadPath({
  name: "getEventItemStatistics",
  read: async (fx) => getEventItemStatistics(fx.eventId),
  visibleSecret: (fx) => fx.titleOf(0),
})

describeReadPath({
  name: "getEventStats (teams panel; aggregates only)",
  read: async (fx) => getEventStats(fx.eventId),
})

// ---------------------------------------------------------------------------
// Public pages (anonymous viewers)
// ---------------------------------------------------------------------------

describeReadPath({
  name: "getPublicBingoDetails (public page, OG image)",
  read: async (fx) => getPublicBingoDetails(fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
  publicPath: true,
})

describeReadPath({
  name: "getPublicWorkspaceData (public workspace)",
  read: async (fx) => getPublicWorkspaceData(fx.eventId, fx.bingoId),
  visibleSecret: (fx) => fx.titleOf(0),
  publicPath: true,
})

// ---------------------------------------------------------------------------
// Tile and goal readers behind canReadTile / canReadGoal
// ---------------------------------------------------------------------------

describeReadPath({
  name: "getGoalTree",
  read: async (fx) => getGoalTree(fx.tileIds[0]!),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getGoalTreeWithProgress",
  read: async (fx) => getGoalTreeWithProgress(fx.tileIds[0]!, fx.teamAId),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getTileGoalsAndProgress",
  read: async (fx) => getTileGoalsAndProgress(fx.tileIds[0]!),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getItemGoalsForTile",
  read: async (fx) => getItemGoalsForTile(fx.tileIds[0]!),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getGoalWithItemData",
  read: async (fx) => getGoalWithItemData(fx.itemGoalId),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getGoalValues",
  read: async (fx) => getGoalValues(fx.itemGoalId),
  visibleSecret: (fx) => fx.tag,
})

describeReadPath({
  name: "getAllSubmissionsForTeam (team submissions with their tiles)",
  read: async (fx) => getAllSubmissionsForTeam(fx.bingoId, fx.teamAId),
  visibleSecret: (fx) => fx.titleOf(0),
  teamAOnly: true,
})

// ---------------------------------------------------------------------------
// Shape of the redacted tiles (what the placement page and the board need)
// ---------------------------------------------------------------------------

describe("redacted tile shape", () => {
  let fx: BlindFixture

  beforeEach(async () => {
    fx = await createBlindFixture()
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  it("getEventById keeps id, index and geometry and marks tiles blind", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)

    const data = await getEventById(fx.eventId)
    const bingo = data!.event.bingos![0]!
    expect(bingo.rows).toBe(3)
    expect(bingo.columns).toBe(3)
    expect(bingo.tiles!.map((t) => t.id)).toEqual(fx.tileIds)
    expect(bingo.tiles!.map((t) => t.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
    for (const [index, tile] of bingo.tiles!.entries()) {
      expect(tile).toMatchObject({
        isBlind: true,
        isHidden: false,
        title: `Tile ${index + 1}`,
        description: "",
        headerImage: null,
        weight: 0,
        goals: [],
        goalGroups: [],
        teamTileSubmissions: [],
      })
    }
  })

  it("marks tiles isBlind: false for managers and after the start", async () => {
    signInAs(fx.managerId)
    setClock(fx.clock.beforeStart)
    const asManager = await getEventById(fx.eventId)
    expect(asManager!.event.bingos![0]!.tiles!.every((t) => !t.isBlind)).toBe(
      true
    )
    expect(asManager!.event.bingos![0]!.tiles![0]!.title).toBe(fx.titleOf(0))

    signInAs(fx.memberAId)
    setClock(fx.clock.afterEnd)
    const afterEnd = await getEventById(fx.eventId)
    const tile = afterEnd!.event.bingos![0]!.tiles![0]!
    expect(tile.isBlind).toBe(false)
    expect(tile.title).toBe(fx.titleOf(0))
    expect(tile.goals).toHaveLength(1)
  })

  it("a hidden tile on a blind board stays hidden and blind", async () => {
    await db
      .update(tiles)
      .set({ isHidden: true })
      .where(eq(tiles.id, fx.tileIds[4]!))

    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)
    const data = await getEventById(fx.eventId)
    const tile = data!.event.bingos![0]!.tiles![4]!
    expect(tile).toMatchObject({ id: fx.tileIds[4], isHidden: true, isBlind: true })
    expectNoSecrets(data, fx.secrets)
  })

  it("getMiniBoardTiles keeps id and index with a placeholder title", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)
    const miniTiles = await getMiniBoardTiles(fx.bingoId)
    expect(miniTiles.map((t) => [t.id, t.index, t.title, t.isBlind])).toEqual(
      fx.tileIds.map((id, i) => [id, i, `Tile ${i + 1}`, true])
    )
  })

  it("board stats list tiles by position only", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)
    const stats = await getAllTeamPointsAndTotal(fx.bingoId)
    expect(stats.tileCompletions).toHaveLength(9)
    expect(
      stats.tileCompletions.every(
        (t) => /^Tile [1-9]$/.test(t.title) && t.weight === 0
      )
    ).toBe(true)
  })

  it("item statistics are empty for a blind board", async () => {
    setClock(fx.clock.beforeStart)
    signInAs(fx.memberAId)
    expect((await getBingoItemStatistics(fx.bingoId)).totalSubmissions).toBe(0)
    expect((await getEventItemStatistics(fx.eventId)).totalSubmissions).toBe(0)

    setClock(fx.clock.afterStart)
    expect((await getBingoItemStatistics(fx.bingoId)).totalSubmissions).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Notifications carry tile titles
// ---------------------------------------------------------------------------

describe("getNotifications", () => {
  let fx: BlindFixture

  beforeEach(async () => {
    fx = await createBlindFixture()
    await db.insert(notifications).values({
      userId: fx.managerId,
      eventId: fx.eventId,
      tileId: fx.tileIds[0]!,
      teamId: fx.teamAId,
      message: "Team A submitted",
    })
  })

  afterEach(async () => {
    await fx.cleanup()
  })

  it("only returns notifications of the signed-in user", async () => {
    signInAs(fx.managerId)
    expectSecret(await getNotifications(fx.managerId), fx.titleOf(0))

    signInAs(fx.memberAId)
    expect(await getNotifications(fx.managerId)).toEqual([])

    signInAs(null)
    expect(await getNotifications(fx.managerId)).toEqual([])
  })
})
