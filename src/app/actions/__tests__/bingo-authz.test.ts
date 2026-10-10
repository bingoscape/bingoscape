/**
 * @jest-environment node
 */
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { getUserRole } from "@/app/actions/events"
import {
  createItemGoal,
  createMetricGoal,
  deleteSubmission,
  initializeTeamTierProgress,
  submitImage,
  updateGoalProgress,
  updateTeamTileSubmissionStatus,
} from "@/app/actions/bingo"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("@/app/actions/events", () => ({ getUserRole: jest.fn() }))
jest.mock("@/app/actions/notifications", () => ({
  createNotification: jest.fn(),
}))
jest.mock("@/lib/discord-webhook", () => ({
  sendDiscordWebhook: jest.fn(),
  createSubmissionEmbed: jest.fn(),
}))
jest.mock("@/lib/getRandomFrog", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock("@/server/db", () => {
  const table = () => ({ findFirst: jest.fn(), findMany: jest.fn() })
  return {
    db: {
      query: {
        bingos: table(),
        tiles: table(),
        goals: table(),
        goalGroups: table(),
        goalValues: table(),
        submissions: table(),
        teamTileSubmissions: table(),
        teams: table(),
        teamMembers: table(),
      },
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    },
  }
})

const session = getServerAuthSession as jest.Mock
const role = getUserRole as jest.Mock
const mockDb = db as unknown as {
  query: Record<string, { findFirst: jest.Mock; findMany: jest.Mock }>
  select: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  transaction: jest.Mock
}
const q = mockDb.query

function expectNoWrites() {
  expect(mockDb.insert).not.toHaveBeenCalled()
  expect(mockDb.update).not.toHaveBeenCalled()
  expect(mockDb.delete).not.toHaveBeenCalled()
  expect(mockDb.transaction).not.toHaveBeenCalled()
}

/** db.select() chain whose .execute() resolves the queued results in order. */
function queueSelects(...results: unknown[][]) {
  mockDb.select.mockImplementation(() => {
    const chain: Record<string, unknown> = {}
    for (const m of ["from", "where", "leftJoin", "innerJoin", "limit"]) {
      chain[m] = jest.fn(() => chain)
    }
    chain.execute = jest.fn(async () => results.shift() ?? [])
    return chain
  })
}

const tileInEvent = (eventId: string, extra: object = {}) => ({
  bingoId: "bingo-1",
  isHidden: false,
  bingo: { eventId },
  ...extra,
})

beforeEach(() => {
  jest.resetAllMocks()
  session.mockResolvedValue({ user: { id: "user-1" } })
  role.mockResolvedValue("participant")
  q.tiles!.findFirst.mockResolvedValue(tileInEvent("event-1"))
  q.goals!.findFirst.mockResolvedValue({
    tileId: "tile-1",
    tile: { bingoId: "bingo-1", bingo: { eventId: "event-1" } },
  })
  q.teamTileSubmissions!.findFirst.mockResolvedValue({ tileId: "tile-1" })
  q.submissions!.findFirst.mockResolvedValue({ teamTileSubmissionId: "tts-1" })
  q.teams!.findFirst.mockResolvedValue({ eventId: "event-1" })
  q.teamMembers!.findFirst.mockResolvedValue(undefined)
})

describe("goal/Tile mutations in bingo.ts reject non-managers", () => {
  it("createItemGoal", async () => {
    const result = await createItemGoal("tile-1", 1, "Item", "Item", "img", 1)
    expect(result.success).toBe(false)
    expectNoWrites()
  })

  it("createMetricGoal", async () => {
    const result = await createMetricGoal("tile-1", "overall", "Overall", 10)
    expect(result.success).toBe(false)
    expectNoWrites()
  })

  it("updateGoalProgress", async () => {
    const result = await updateGoalProgress("goal-1", "team-1", 50)
    expect(result.success).toBe(false)
    expectNoWrites()
  })

  it("updateTeamTileSubmissionStatus (manually completing a Tile)", async () => {
    const result = await updateTeamTileSubmissionStatus("tts-1", "completed")
    expect(result.success).toBe(false)
    expectNoWrites()
  })

  it("deleteSubmission", async () => {
    const result = await deleteSubmission("sub-1")
    expect(result.success).toBe(false)
    expectNoWrites()
  })

  it("initializeTeamTierProgress for a Team the caller is not in", async () => {
    const result = await initializeTeamTierProgress("team-1", "bingo-1")
    expect(result.success).toBe(false)
    expectNoWrites()
  })
})

describe("updateGoalProgress for a manager of another Event", () => {
  it("refuses a Team from a different Event", async () => {
    role.mockResolvedValue("admin")
    q.teams!.findFirst.mockResolvedValue({ eventId: "event-2" })
    const result = await updateGoalProgress("goal-1", "team-of-event-2", 5)
    expect(result.success).toBe(false)
    expectNoWrites()
  })
})

describe("submitImage participant checks", () => {
  function form(teamId = "team-1") {
    const fd = new FormData()
    fd.set("tileId", "tile-1")
    fd.set("teamId", teamId)
    fd.set("image", new File(["x"], "proof.png", { type: "image/png" }))
    return fd
  }

  beforeEach(() => {
    q.bingos!.findFirst.mockResolvedValue({
      id: "bingo-1",
      eventId: "event-1",
      title: "Board",
      event: { id: "event-1", title: "Event" },
    })
  })

  it("rejects a participant who is not a member of the Team", async () => {
    queueSelects(
      [
        {
          id: "tile-1",
          bingoId: "bingo-1",
          title: "T",
          description: "D",
          isHidden: false,
        },
      ],
      [{ id: "team-1", name: "Team", eventId: "event-1" }]
    )
    const result = await submitImage(form())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not a member/)
    expectNoWrites()
  })

  it("rejects a Team from a different Event", async () => {
    queueSelects(
      [
        {
          id: "tile-1",
          bingoId: "bingo-1",
          title: "T",
          description: "D",
          isHidden: false,
        },
      ],
      [{ id: "team-9", name: "Other", eventId: "event-2" }]
    )
    const result = await submitImage(form("team-9"))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/does not belong/)
    expectNoWrites()
  })

  it("rejects participants submitting to a hidden Tile", async () => {
    q.teamMembers!.findFirst.mockResolvedValue({ id: "m" })
    queueSelects(
      [
        {
          id: "tile-1",
          bingoId: "bingo-1",
          title: "T",
          description: "D",
          isHidden: true,
        },
      ],
      [{ id: "team-1", name: "Team", eventId: "event-1" }]
    )
    const result = await submitImage(form())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Tile not found/)
    expectNoWrites()
  })
})
