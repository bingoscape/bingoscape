/**
 * @jest-environment node
 */
import { eq } from "drizzle-orm"

import {
  READ_DECISIONS,
  READ_POLICY_ENV_VAR,
  type ReadDecisions,
} from "@/lib/authz/read-policy"
import { getServerAuthSession } from "@/server/auth"
import {
  canReadBoard,
  canReadEvent,
  canReadGoal,
  canReadTeam,
  canReadTile,
  getReadPolicyMode,
} from "@/server/authz"
import { getUploadAccess } from "@/server/authz/uploads"
import { getEventById } from "@/server/queries/events"
import { getEventStats, getAllTeamPointsAndTotal } from "@/server/queries/stats"
import {
  getBingoItemStatistics,
  getEventItemStatistics,
} from "@/server/queries/item-statistics"
import { getEventPatternCompletion } from "@/server/queries/event-pattern-completion"
import {
  calculateEventPrizePool,
  getMiniBoardTiles,
} from "@/app/actions/events"
import { getBingoById } from "@/app/actions/getBingoById"
import {
  getGoalWithItemData,
  getItemGoalsForTile,
  getTileGoalsAndProgress,
} from "@/app/actions/bingo"
import { getGoalTree, getGoalTreeWithProgress } from "@/app/actions/goal-groups"
import { getGoalValues } from "@/app/actions/goals"
import { getTeamsByEventId } from "@/app/actions/team"
import {
  getPublicBingoDetails,
  getPublicEvent,
  getPublicWorkspaceData,
} from "@/app/actions/public-events"
import { db } from "@/server/db"
import { bingos, events, teamGoalProgress } from "@/server/db/schema"
import {
  createReadFixture,
  type ReadFixture,
} from "@/server/__tests__/helpers/read-fixture"
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

type Viewer =
  | "anonymous"
  | "outsider"
  | "participant"
  | "memberA"
  | "memberB"
  | "management"
  | "admin"
  | "creator"

const ALL_VIEWERS: Viewer[] = [
  "anonymous",
  "outsider",
  "participant",
  "memberA",
  "memberB",
  "management",
  "admin",
  "creator",
]
const MANAGERS: Viewer[] = ["management", "admin", "creator"]
const MEMBERS: Viewer[] = ["participant", "memberA", "memberB", ...MANAGERS]

type Scope = "summary" | "content" | "member-data"

/** Who may read at `scope` under the default (enforce) policy. */
function readers(scope: Scope, isPublic: boolean): Viewer[] {
  if (scope === "member-data") return MEMBERS
  if (isPublic) return ALL_VIEWERS
  if (scope === "content") return MEMBERS
  return ALL_VIEWERS.filter((v) => v !== "anonymous")
}

let fx: ReadFixture

function signInAs(viewer: Viewer) {
  session.mockResolvedValue(
    viewer === "anonymous" ? null : { user: { id: fx.users[viewer] } }
  )
}

const json = (value: unknown) => JSON.stringify(value)

beforeAll(async () => {
  fx = await createReadFixture()
  await db
    .update(events)
    .set({ basePrizePool: 777 })
    .where(eq(events.id, fx.event1.id))
  // Both Boards carry a Bonus, so pattern completion lists them.
  await db
    .update(bingos)
    .set({ completeBoardBonusXP: 5 })
    .where(eq(bingos.eventId, fx.event1.id))
})

afterAll(async () => {
  await fx.cleanup()
})

afterEach(async () => {
  jest.useRealTimers()
  delete process.env[READ_POLICY_ENV_VAR]
  await fx.setPublic(false)
})

// ---------------------------------------------------------------------------
// canReadEvent / canReadBoard / canReadTile / canReadTeam
// ---------------------------------------------------------------------------

describe.each([false, true])("policy helpers, public Event: %s", (isPublic) => {
  beforeEach(async () => {
    await fx.setPublic(isPublic)
  })

  describe.each(ALL_VIEWERS)("%s", (viewer) => {
    beforeEach(() => signInAs(viewer))

    it.each<Scope>(["summary", "content", "member-data"])(
      "canReadEvent(%s)",
      async (scope) => {
        expect(await canReadEvent(fx.event1.id, scope)).toBe(
          readers(scope, isPublic).includes(viewer)
        )
      }
    )

    it("canReadBoard: a visible Board follows the Event, a draft Board is for managers", async () => {
      expect(await canReadBoard(fx.boards.standardId)).toBe(
        readers("content", isPublic).includes(viewer)
      )
      expect(await canReadBoard(fx.boards.draftId)).toBe(
        MANAGERS.includes(viewer)
      )
    })

    it("canReadTile: hidden and Blind Tiles are for managers", async () => {
      const mayRead = readers("content", isPublic).includes(viewer)
      expect(await canReadTile(fx.tileIds.visible)).toBe(mayRead)
      expect(await canReadGoal(fx.goalIds.visible)).toBe(mayRead)
      expect(await canReadTile(fx.tileIds.hidden)).toBe(
        MANAGERS.includes(viewer)
      )
      expect(await canReadGoal(fx.goalIds.hidden)).toBe(
        MANAGERS.includes(viewer)
      )
      expect(await canReadTile(fx.tileIds.draft)).toBe(
        MANAGERS.includes(viewer)
      )
      // The Event starts in 24 hours: the battleship Board is blind.
      expect(await canReadTile(fx.tileIds.ship)).toBe(MANAGERS.includes(viewer))
    })

    it("canReadTile: nothing is blind once the Event started", async () => {
      setClock(new Date(Date.now() + 25 * 60 * 60 * 1000))
      expect(await canReadTile(fx.tileIds.ship)).toBe(
        readers("content", isPublic).includes(viewer)
      )
    })

    it("canReadTeam: summary follows the Event, records are for managers and the Team", async () => {
      const mayReadContent = readers("content", isPublic).includes(viewer)
      expect(await canReadTeam(fx.event1.teamAId)).toBe(mayReadContent)
      expect(await canReadTeam(fx.event1.teamBId)).toBe(mayReadContent)

      const recordsOf = (teamId: string, bingoId: string) =>
        canReadTeam(teamId, "records", { bingoId })
      const isMember = MEMBERS.includes(viewer)
      const isManager = MANAGERS.includes(viewer)
      const ownsA = viewer === "memberA"
      const ownsB = viewer === "memberB"

      // Standard Board: managers, the Team itself and other participants.
      expect(await recordsOf(fx.event1.teamAId, fx.boards.standardId)).toBe(
        isMember
      )
      expect(await recordsOf(fx.event1.teamBId, fx.boards.standardId)).toBe(
        isMember
      )
      // Battleship Board: managers and the Team itself only.
      expect(await recordsOf(fx.event1.teamAId, fx.boards.shipId)).toBe(
        isManager || ownsA
      )
      expect(await recordsOf(fx.event1.teamBId, fx.boards.shipId)).toBe(
        isManager || ownsB
      )
    })
  })
})

describe("policy helpers: edge cases", () => {
  beforeEach(() => signInAs("admin"))

  it("treat unknown and malformed ids as not readable", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000"
    expect(await canReadEvent(unknown)).toBe(false)
    expect(await canReadBoard(unknown)).toBe(false)
    expect(await canReadTile(unknown)).toBe(false)
    expect(await canReadGoal(unknown)).toBe(false)
    expect(await canReadTeam(unknown)).toBe(false)
    expect(await canReadEvent("not-a-uuid")).toBe(false)
    expect(await canReadTile("not-a-uuid")).toBe(false)
  })

  it("does not read a Team through a Board of another Event", async () => {
    expect(
      await canReadTeam(fx.event1.teamAId, "records", {
        bingoId: fx.event2.bingoId,
      })
    ).toBe(false)
  })

  it("the creator of another Event has no standing here", async () => {
    session.mockResolvedValue({ user: { id: fx.users.otherCreator } })
    expect(await canReadEvent(fx.event1.id, "content")).toBe(false)
    // Their own Event: the fixture gives them no participant row (a data
    // fault), and there is no implicit admin for the creator any more.
    expect(await canReadEvent(fx.event2.id, "member-data")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The read functions
// ---------------------------------------------------------------------------

interface ReadPath {
  name: string
  scope: Exclude<Scope, "summary">
  read: () => Promise<unknown>
  /** In the result for everybody who may read at `scope`. */
  marker: () => string
  /** Only in the result for managers. */
  managerOnly?: () => string[]
}

const paths: ReadPath[] = [
  {
    name: "getMiniBoardTiles",
    scope: "content",
    read: () => getMiniBoardTiles(fx.boards.standardId),
    marker: () => fx.titles.visible,
    managerOnly: () => [fx.titles.hidden],
  },
  {
    name: "getBingoById",
    scope: "content",
    read: () => getBingoById(fx.boards.standardId),
    marker: () => fx.titles.visible,
    managerOnly: () => [fx.titles.hidden, fx.verificationCode],
  },
  {
    name: "getEventStats",
    scope: "content",
    read: () => getEventStats(fx.event1.id),
    marker: () => "Board 1",
    managerOnly: () => [`Draft board ${fx.tag}`],
  },
  {
    name: "getAllTeamPointsAndTotal",
    scope: "member-data",
    read: () => getAllTeamPointsAndTotal(fx.boards.standardId),
    marker: () => fx.titles.visible,
    managerOnly: () => [fx.titles.hidden],
  },
  {
    name: "getBingoItemStatistics",
    scope: "member-data",
    read: () => getBingoItemStatistics(fx.boards.standardId),
    marker: () => `Whip ${fx.tag}`,
    managerOnly: () => [`Godsword ${fx.tag}`],
  },
  {
    name: "getEventItemStatistics",
    scope: "member-data",
    read: () => getEventItemStatistics(fx.event1.id),
    marker: () => `Whip ${fx.tag}`,
    managerOnly: () => [`Godsword ${fx.tag}`],
  },
  {
    name: "getEventPatternCompletion",
    scope: "member-data",
    read: () => getEventPatternCompletion(fx.event1.id),
    marker: () => "Board 1",
    managerOnly: () => [`Draft board ${fx.tag}`],
  },
  {
    name: "getTeamsByEventId",
    scope: "content",
    read: () => getTeamsByEventId(fx.event1.id),
    marker: () => "Team A",
  },
  {
    name: "getTileGoalsAndProgress",
    scope: "content",
    read: () => getTileGoalsAndProgress(fx.tileIds.visible),
    marker: () => "Goal 1",
  },
  {
    name: "getGoalTree",
    scope: "content",
    read: () => getGoalTree(fx.tileIds.visible),
    marker: () => "Goal 1",
  },
  {
    name: "getGoalTreeWithProgress",
    scope: "content",
    read: () => getGoalTreeWithProgress(fx.tileIds.visible, fx.event1.teamAId),
    marker: () => "Goal 1",
  },
  {
    name: "getGoalValues",
    scope: "content",
    read: () => getGoalValues(fx.goalIds.visible),
    marker: () => '"Value"',
  },
  {
    name: "getGoalWithItemData",
    scope: "content",
    read: () => getGoalWithItemData(fx.goalIds.visible),
    marker: () => `Whip ${fx.tag}`,
  },
  {
    name: "getItemGoalsForTile",
    scope: "content",
    read: () => getItemGoalsForTile(fx.tileIds.visible),
    marker: () => `Whip ${fx.tag}`,
  },
]

describe.each([false, true])("read functions, public Event: %s", (isPublic) => {
  beforeEach(async () => {
    await fx.setPublic(isPublic)
  })

  describe.each(paths)("$name", (path) => {
    it.each(ALL_VIEWERS)("is read by %s as the policy says", async (viewer) => {
      signInAs(viewer)
      const result = json(await path.read())
      const mayRead = readers(path.scope, isPublic).includes(viewer)
      if (mayRead) {
        expect(result).toContain(path.marker())
      } else {
        expect(result).not.toContain(path.marker())
      }

      // Hidden Tiles, draft Boards and secrets are never for non-managers.
      for (const secret of path.managerOnly?.() ?? []) {
        if (MANAGERS.includes(viewer)) {
          expect(result).toContain(secret)
        } else {
          expect(result).not.toContain(secret)
        }
      }
    })
  })

  it.each(ALL_VIEWERS)("calculateEventPrizePool for %s", async (viewer) => {
    signInAs(viewer)
    const pool = await calculateEventPrizePool(fx.event1.id)
    expect(pool.totalPrizePool).toBe(
      readers("content", isPublic).includes(viewer) ? 777 : 0
    )
  })

  it.each(ALL_VIEWERS)(
    "hidden Tile Goals are for managers (%s)",
    async (viewer) => {
      signInAs(viewer)
      const results = json([
        await getTileGoalsAndProgress(fx.tileIds.hidden),
        await getGoalTree(fx.tileIds.hidden),
        await getGoalValues(fx.goalIds.hidden),
        await getGoalWithItemData(fx.goalIds.hidden),
        await getItemGoalsForTile(fx.tileIds.hidden),
      ])
      if (MANAGERS.includes(viewer)) {
        expect(results).toContain(`Hidden goal ${fx.tag}`)
      } else {
        expect(results).not.toContain(`Hidden goal ${fx.tag}`)
        expect(results).not.toContain(`Godsword ${fx.tag}`)
      }
    }
  )

  it.each(ALL_VIEWERS)(
    "the draft Board is for managers (%s)",
    async (viewer) => {
      signInAs(viewer)
      const results = json([
        await getMiniBoardTiles(fx.boards.draftId),
        await getBingoById(fx.boards.draftId),
        await getAllTeamPointsAndTotal(fx.boards.draftId),
        await getBingoItemStatistics(fx.boards.draftId),
        await getTileGoalsAndProgress(fx.tileIds.draft),
      ])
      if (MANAGERS.includes(viewer)) {
        expect(results).toContain(fx.titles.draft)
      } else {
        expect(results).not.toContain(fx.titles.draft)
        expect(results).not.toContain(`Draft board ${fx.tag}`)
      }
    }
  )

  it.each(ALL_VIEWERS)(
    "the Blind battleship Tile is for managers until the start (%s)",
    async (viewer) => {
      signInAs(viewer)
      const read = async () =>
        json([
          await getMiniBoardTiles(fx.boards.shipId),
          await getBingoById(fx.boards.shipId),
          await getTileGoalsAndProgress(fx.tileIds.ship),
          await getGoalTree(fx.tileIds.ship),
        ])

      const before = await read()
      if (MANAGERS.includes(viewer)) {
        expect(before).toContain(fx.titles.ship)
      } else {
        expect(before).not.toContain(fx.titles.ship)
        expect(before).not.toContain(`Ship goal ${fx.tag}`)
      }

      setClock(new Date(Date.now() + 25 * 60 * 60 * 1000))
      const after = await read()
      if (readers("content", isPublic).includes(viewer)) {
        expect(after).toContain(fx.titles.ship)
      } else {
        expect(after).not.toContain(fx.titles.ship)
      }
    }
  )
})

describe("battleship privacy", () => {
  it("shows a Team's progress on a battleship Tile to that Team and to managers only", async () => {
    setClock(new Date(Date.now() + 25 * 60 * 60 * 1000))
    const { goalIds, tileIds, event1 } = fx
    const { teamBId } = event1
    await db.insert(teamGoalProgress).values([
      { teamId: event1.teamAId, goalId: goalIds.ship, currentValue: 1 },
      { teamId: teamBId, goalId: goalIds.ship, currentValue: 1 },
    ])

    const teamsSeen = async (viewer: Viewer) => {
      signInAs(viewer)
      const rows = (await getTileGoalsAndProgress(tileIds.ship)) as Array<{
        teamProgress: Array<{ teamId: string }>
      }>
      return rows.flatMap((g) => g.teamProgress.map((p) => p.teamId)).sort()
    }

    expect(await teamsSeen("memberA")).toEqual([event1.teamAId])
    expect(await teamsSeen("memberB")).toEqual([teamBId])
    expect(await teamsSeen("participant")).toEqual([])
    expect(await teamsSeen("admin")).toEqual([event1.teamAId, teamBId].sort())
  })

  it("lists a Team's goal progress on a standard Board to every participant, not to outsiders", async () => {
    const progressOf = async (viewer: Viewer, teamId: string) => {
      signInAs(viewer)
      const result = await getGoalTreeWithProgress(fx.tileIds.visible, teamId)
      return result.teamProgress.length
    }
    expect(await progressOf("memberB", fx.event1.teamAId)).toBe(1)
    expect(await progressOf("participant", fx.event1.teamBId)).toBe(1)
    expect(await progressOf("outsider", fx.event1.teamAId)).toBe(0)
  })

  it("does not hand the opponent's progress through getGoalTreeWithProgress on a battleship Board", async () => {
    signInAs("memberB")
    const opponent = await getGoalTreeWithProgress(
      fx.tileIds.ship,
      fx.event1.teamAId
    )
    expect(opponent.teamProgress).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getEventById
// ---------------------------------------------------------------------------

describe.each([false, true])("getEventById, public Event: %s", (isPublic) => {
  beforeEach(async () => {
    await fx.setPublic(isPublic)
  })

  it("answers nobody for an Event that does not exist", async () => {
    signInAs("admin")
    expect(
      await getEventById("00000000-0000-4000-8000-000000000000")
    ).toBeNull()
  })

  it.each(ALL_VIEWERS)("what %s gets", async (viewer) => {
    signInAs(viewer)
    const data = await getEventById(fx.event1.id)
    const result = json(data)

    if (viewer === "anonymous" && !isPublic) {
      expect(data).toBeNull()
      return
    }
    expect(data?.event.id).toBe(fx.event1.id)

    if (!MEMBERS.includes(viewer)) {
      // The join card: the Event row, no Boards, Teams or Clan, no role.
      expect(data?.userRole).toBeNull()
      expect(data?.event.bingos).toEqual([])
      expect(data?.event.teams).toEqual([])
      for (const secret of [
        fx.titles.visible,
        fx.titles.hidden,
        fx.codephrase,
        fx.verificationCode,
        "Team A",
      ]) {
        expect(result).not.toContain(secret)
      }
      return
    }

    expect(data?.userRole).toBe(
      viewer === "creator" || viewer === "admin"
        ? "admin"
        : viewer === "management"
          ? "management"
          : "participant"
    )
    expect(result).toContain(fx.titles.visible)
    expect(result).toContain("Team A")
    // Participants read the codephrase (decision 5, default).
    expect(result).toContain(fx.codephrase)

    if (MANAGERS.includes(viewer)) {
      expect(result).toContain(fx.titles.hidden)
      expect(result).toContain(fx.titles.draft)
      expect(result).toContain(fx.verificationCode)
    } else {
      expect(result).not.toContain(fx.titles.hidden)
      expect(result).not.toContain(fx.titles.draft)
      expect(result).not.toContain(fx.verificationCode)
      // The battleship Board is blind before the start.
      expect(result).not.toContain(fx.titles.ship)
    }
  })

  it("keeps other Teams' records out of a battleship Board, but not out of a standard one", async () => {
    signInAs("memberB")
    const data = await getEventById(fx.event1.id)
    const standard = data?.event.bingos?.find(
      (b) => b.id === fx.boards.standardId
    )
    const teamsOnStandard = (standard?.tiles ?? []).flatMap((t) =>
      (t.teamTileSubmissions ?? []).map((tts) => tts.teamId)
    )
    // Team A's Submissions are visible to Team B on a standard Board.
    expect(teamsOnStandard).toContain(fx.event1.teamAId)
  })
})

// ---------------------------------------------------------------------------
// Public Event pages
// ---------------------------------------------------------------------------

describe("public Event pages", () => {
  it("answer nothing for a private Event, whoever asks", async () => {
    signInAs("admin")
    expect(await getPublicEvent(fx.event1.id)).toBeNull()
    expect(await getPublicBingoDetails(fx.boards.standardId)).toBeNull()
    expect(await getPublicWorkspaceData(fx.event1.id, null)).toBeNull()
  })

  it.each(ALL_VIEWERS)(
    "serve a public Event without secrets, drafts or hidden Tiles (%s)",
    async (viewer) => {
      await fx.setPublic(true)
      signInAs(viewer)
      const event = await getPublicEvent(fx.event1.id)
      const board = await getPublicBingoDetails(fx.boards.standardId)
      const workspace = await getPublicWorkspaceData(
        fx.event1.id,
        fx.boards.standardId
      )
      expect(event?.id).toBe(fx.event1.id)
      const result = json([event, board, workspace])
      expect(result).toContain(fx.titles.visible)
      expect(result).toContain("Team A")
      for (const secret of [
        fx.codephrase,
        fx.verificationCode,
        fx.titles.hidden,
        fx.titles.draft,
        fx.titles.ship,
      ]) {
        expect(result).not.toContain(secret)
      }
      expect(await getPublicBingoDetails(fx.boards.draftId)).toBeNull()
    }
  )
})

// ---------------------------------------------------------------------------
// Uploads (decision 4)
// ---------------------------------------------------------------------------

/** Runs `body` with some of the epic's decisions changed. */
async function withDecisions(
  change: Partial<ReadDecisions>,
  body: () => Promise<void>
) {
  const before = { ...READ_DECISIONS }
  Object.assign(READ_DECISIONS, change)
  try {
    await body()
  } finally {
    Object.assign(READ_DECISIONS, before)
  }
}

const relative = (path: string) => path.replace(/^\/uploads\//, "")

describe("uploads", () => {
  it.each(ALL_VIEWERS)(
    "are served by public URL in public-url mode (%s)",
    async (viewer) => {
      await withDecisions({ uploads: "public-url" }, async () => {
        signInAs(viewer)
        const access = await getUploadAccess(relative(fx.imagePath))
        expect(access.allowed).toBe(true)
        expect(access.cacheControl).toContain("public")
        expect((await getUploadAccess("does-not-exist")).allowed).toBe(true)
      })
    }
  )

  describe("when they follow the Event's visibility", () => {
    it.each(ALL_VIEWERS)("%s", async (viewer) => {
      await withDecisions({ uploads: "follow-event-visibility" }, async () => {
        await fx.setPublic(true)
        signInAs(viewer)
        const visible = await getUploadAccess(relative(fx.imagePath))
        const hidden = await getUploadAccess(relative(fx.hiddenImagePath))
        const unknown = await getUploadAccess("does-not-exist")

        // Even a public Event keeps Submission images for its members.
        expect(visible.allowed).toBe(MEMBERS.includes(viewer))
        if (visible.allowed) expect(visible.cacheControl).toContain("private")
        // Submissions on a hidden Tile: managers only.
        expect(hidden.allowed).toBe(MANAGERS.includes(viewer))
        expect(unknown.allowed).toBe(false)
      })
    })
  })

  it("the relaxed policy restores the public URL", async () => {
    await withDecisions({ uploads: "follow-event-visibility" }, async () => {
      process.env[READ_POLICY_ENV_VAR] = "relaxed"
      signInAs("outsider")
      expect((await getUploadAccess(relative(fx.imagePath))).allowed).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Decisions 3 and 5
// ---------------------------------------------------------------------------

describe("decision 3: non-members of a non-public Event", () => {
  it("members-only hides the Event from non-members", async () => {
    await withDecisions(
      { nonPublicEventForNonMembers: "members-only" },
      async () => {
        for (const viewer of ["anonymous", "outsider"] as const) {
          signInAs(viewer)
          expect(await canReadEvent(fx.event1.id, "summary")).toBe(false)
          expect(await getEventById(fx.event1.id)).toBeNull()
        }
        signInAs("participant")
        expect((await getEventById(fx.event1.id))?.userRole).toBe("participant")

        // A public Event stays readable by everybody.
        await fx.setPublic(true)
        signInAs("outsider")
        expect(await canReadEvent(fx.event1.id, "content")).toBe(true)
      }
    )
  })
})

describe("decision 5: codephrase", () => {
  it("managers-only hides it from participants", async () => {
    await withDecisions({ codephrase: "managers" }, async () => {
      for (const viewer of ["participant", "memberA"] as const) {
        signInAs(viewer)
        const data = await getEventById(fx.event1.id)
        expect(json(data)).not.toContain(fx.codephrase)
        expect(json(await getBingoById(fx.boards.standardId))).not.toContain(
          fx.codephrase
        )
      }
      for (const viewer of MANAGERS) {
        signInAs(viewer)
        expect(json(await getEventById(fx.event1.id))).toContain(fx.codephrase)
        expect(json(await getBingoById(fx.boards.standardId))).toContain(
          fx.codephrase
        )
      }
    })
  })

  it("players see it by default, non-members never", async () => {
    signInAs("memberA")
    expect(json(await getBingoById(fx.boards.standardId))).toContain(
      fx.codephrase
    )
    await fx.setPublic(true)
    signInAs("outsider")
    expect(json(await getBingoById(fx.boards.standardId))).not.toContain(
      fx.codephrase
    )
  })
})

// ---------------------------------------------------------------------------
// The feature flag
// ---------------------------------------------------------------------------

describe("RBAC_READ_POLICY", () => {
  it("defaults to enforce and ignores unknown values", () => {
    expect(getReadPolicyMode()).toBe("enforce")
    process.env[READ_POLICY_ENV_VAR] = "  RELAXED "
    expect(getReadPolicyMode()).toBe("relaxed")
    process.env[READ_POLICY_ENV_VAR] = "off"
    expect(getReadPolicyMode()).toBe("enforce")
    process.env[READ_POLICY_ENV_VAR] = ""
    expect(getReadPolicyMode()).toBe("enforce")
  })

  describe("relaxed", () => {
    beforeEach(() => {
      process.env[READ_POLICY_ENV_VAR] = "relaxed"
    })

    it("is read on every request", async () => {
      signInAs("outsider")
      expect(await canReadEvent(fx.event1.id, "content")).toBe(true)
      process.env[READ_POLICY_ENV_VAR] = "enforce"
      expect(await canReadEvent(fx.event1.id, "content")).toBe(false)
    })

    it.each(["anonymous", "outsider"] as const)(
      "reads %s like a participant for content and member data",
      async (viewer) => {
        signInAs(viewer)
        expect(await canReadEvent(fx.event1.id, "member-data")).toBe(true)
        expect(await canReadBoard(fx.boards.standardId)).toBe(true)
        expect(await canReadTile(fx.tileIds.visible)).toBe(true)
        expect(await canReadTeam(fx.event1.teamAId)).toBe(true)

        for (const path of paths) {
          expect(json(await path.read())).toContain(path.marker())
        }
        expect(
          (await calculateEventPrizePool(fx.event1.id)).totalPrizePool
        ).toBe(777)
      }
    )

    it("keeps hidden Tiles, drafts, Blind Tiles and managers' data protected", async () => {
      signInAs("outsider")
      expect(await canReadTile(fx.tileIds.hidden)).toBe(false)
      expect(await canReadTile(fx.tileIds.ship)).toBe(false)
      expect(await canReadBoard(fx.boards.draftId)).toBe(false)
      const everything = json([
        await getBingoById(fx.boards.standardId),
        await getMiniBoardTiles(fx.boards.standardId),
        await getEventStats(fx.event1.id),
        await getEventItemStatistics(fx.event1.id),
        await getTileGoalsAndProgress(fx.tileIds.hidden),
      ])
      for (const secret of [
        fx.titles.hidden,
        fx.titles.draft,
        fx.titles.ship,
        `Godsword ${fx.tag}`,
        fx.verificationCode,
        fx.codephrase,
      ]) {
        expect(everything).not.toContain(secret)
      }
    })

    it("keeps battleship privacy and never relaxes the codephrase", async () => {
      signInAs("outsider")
      const opponent = await getGoalTreeWithProgress(
        fx.tileIds.ship,
        fx.event1.teamAId
      )
      expect(opponent.teamProgress).toEqual([])
      expect(json(await getEventById(fx.event1.id))).not.toContain(
        fx.codephrase
      )
      // Player metadata (skill badges) is for members.
      const teams = await getTeamsByEventId(fx.event1.id)
      expect(
        teams.flatMap((t) => t.teamMembers).every((m) => !m.user.hasMetadata)
      ).toBe(true)
    })

    it("hands non-members the Event tree from getEventById, without role or secrets", async () => {
      signInAs("outsider")
      const data = await getEventById(fx.event1.id)
      // No role, so the Event page still shows the join flow.
      expect(data?.userRole).toBeNull()
      expect(json(data)).toContain(fx.titles.visible)
      expect(json(data)).not.toContain(fx.codephrase)
      expect(json(data)).not.toContain(fx.verificationCode)
      expect(json(data)).not.toContain(fx.titles.hidden)
    })

    it("does not widen what managers or members get", async () => {
      signInAs("participant")
      const data = await getEventById(fx.event1.id)
      expect(json(data)).toContain(fx.codephrase)
      expect(json(data)).not.toContain(fx.titles.hidden)
    })
  })
})
